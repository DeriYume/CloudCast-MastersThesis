package com.cloudcast.app.ui.filedetail

import android.graphics.Bitmap
import android.graphics.BitmapFactory
import android.graphics.Canvas
import android.graphics.Color
import android.graphics.pdf.PdfRenderer
import android.net.Uri
import android.os.ParcelFileDescriptor
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.core.httpStatus
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.FolderRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.core.EVENT_COALESCE_MS
import com.cloudcast.app.core.RefreshGate
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.withFavorite
import com.cloudcast.app.data.network.FolderDto
import com.cloudcast.app.core.ZipTools
import com.cloudcast.app.ui.sharing.ShareController
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import com.cloudcast.app.core.Formats
import java.io.File

enum class PreviewKind { IMAGE, VIDEO, AUDIO, PDF, ZIP, TEXT, OTHER }

private val TEXT_APP_MIMES = setOf(
    "application/json", "application/xml", "application/javascript",
    "application/x-yaml", "application/yaml", "application/x-sh",
)

fun previewKindOf(mime: String, name: String): PreviewKind {
    val m = mime.lowercase()
    val n = name.lowercase()
    val ext = n.substringAfterLast('.', "")
    return when {
        m.startsWith("image/") -> PreviewKind.IMAGE
        m.startsWith("video/") -> PreviewKind.VIDEO
        m.startsWith("audio/") -> PreviewKind.AUDIO
        m == "application/pdf" || n.endsWith(".pdf") -> PreviewKind.PDF
        m.contains("zip") || n.endsWith(".zip") -> PreviewKind.ZIP
        m.startsWith("text/") || m in TEXT_APP_MIMES ||
            ext in Formats.TEXT_EXTS || ext in Formats.CODE_EXTS -> PreviewKind.TEXT
        else -> PreviewKind.OTHER
    }
}

private const val MAX_PDF_PAGES = 30
private const val PDF_TARGET_WIDTH = 1080

private const val MAX_PREVIEW_PX = 2048

private const val MAX_PDF_PIXELS = 12_000_000

data class FileDetailUiState(
    val file: FileDto? = null,
    val image: ImageBitmap? = null,
    val pdfPages: List<ImageBitmap>? = null,
    val videoFile: File? = null,
    val audioFile: File? = null,

    val zipEntries: List<ZipTools.Entry>? = null,
    val zipTruncated: Boolean = false,
    val textContent: String? = null,
    val textTruncated: Boolean = false,
    val loading: Boolean = true,
    val downloading: Boolean = false,

    val saving: Boolean = false,
    val error: String? = null,
    val message: String? = null,
    val showMoveDialog: Boolean = false,
    val folders: List<FolderDto> = emptyList(),
    val foldersLoading: Boolean = false,
    val moving: Boolean = false,
    val moveError: String? = null,

    val showExpiryDialog: Boolean = false,

    val aiSummary: String? = null,
    val aiModel: String? = null,
    val aiLoading: Boolean = false,
    val aiError: String? = null,
    val aiAvailable: Boolean = false,
    val analysisOn: Boolean = false,
) {
    val previewKind: PreviewKind
        get() = file?.let { previewKindOf(it.mime_type, it.original_name) } ?: PreviewKind.OTHER
    val isImage: Boolean get() = previewKind == PreviewKind.IMAGE

    val isAnalyzable: Boolean
        get() = (previewKind == PreviewKind.IMAGE || previewKind == PreviewKind.TEXT) &&
            analysisOn && aiAvailable
}

class FileDetailViewModel(
    private val repo: FileRepository,
    private val folderRepo: FolderRepository,
    shareRepo: ShareRepository,
    private val events: EventStream,
    private val fileId: String,
) : ViewModel() {

    private val _state = MutableStateFlow(FileDetailUiState())
    val state: StateFlow<FileDetailUiState> = _state.asStateFlow()

    private val _deleted = MutableStateFlow(false)
    val deleted: StateFlow<Boolean> = _deleted.asStateFlow()

    val share = ShareController(shareRepo, viewModelScope)

    init {
        load()
        loadAiConfig()

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "prefs") loadAiConfig()
                if (event == "files" && eventGate.shouldRefresh()) {
                    eventGate.mark()
                    refreshMetadata()
                    share.refreshIfOpen()
                }
            }
        }
    }

    private val eventGate = RefreshGate(EVENT_COALESCE_MS)

    private fun loadAiConfig() {
        viewModelScope.launch {
            runCatching { repo.aiConfig() }.onSuccess { cfg ->
                _state.update {
                    it.copy(aiAvailable = cfg.ai, analysisOn = cfg.preferences.analysis)
                }
            }
        }
    }

    fun load() {
        _state.update { it.copy(loading = _state.value.file == null, error = null) }
        viewModelScope.launch {
            try {
                val file = repo.get(fileId)
                _state.update { it.copy(file = file, loading = false) }
                loadPreview(file)
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't load file"), loading = false) }
            }
        }
    }

    private fun refreshMetadata() {
        viewModelScope.launch {
            runCatching { repo.get(fileId) }
                .onSuccess { file -> _state.update { it.copy(file = file) } }
        }
    }

    private fun decodeSampled(bytes: ByteArray, maxPx: Int): android.graphics.Bitmap? {
        val bounds = BitmapFactory.Options().apply { inJustDecodeBounds = true }
        BitmapFactory.decodeByteArray(bytes, 0, bytes.size, bounds)
        val longest = maxOf(bounds.outWidth, bounds.outHeight)

        var sample = 1
        while (longest > 0 && longest / sample > maxPx) sample *= 2
        val opts = BitmapFactory.Options().apply {
            inSampleSize = sample

            inPreferredConfig = android.graphics.Bitmap.Config.ARGB_8888
        }
        return BitmapFactory.decodeByteArray(bytes, 0, bytes.size, opts)
    }

    private suspend fun loadPreview(file: FileDto) {

        val dek = file.wrapped_dek
        try {
            when (previewKindOf(file.mime_type, file.original_name)) {
                PreviewKind.IMAGE -> {
                    val bytes = repo.contentBytes(fileId, dek)
                    val bitmap = withContext(Dispatchers.Default) {
                        decodeSampled(bytes, MAX_PREVIEW_PX)?.asImageBitmap()
                    }
                    _state.update { it.copy(image = bitmap) }
                }
                PreviewKind.PDF -> {
                    val pdf = repo.cacheContent(fileId, ".pdf", dek)
                    val pages = withContext(Dispatchers.Default) { renderPdf(pdf) }
                    _state.update { it.copy(pdfPages = pages) }
                }
                PreviewKind.VIDEO -> {
                    val video = repo.cacheContent(fileId, ".mp4", dek)
                    _state.update { it.copy(videoFile = video) }
                }
                PreviewKind.AUDIO -> {
                    val audio = repo.cacheContent(fileId, ".audio", dek)
                    _state.update { it.copy(audioFile = audio) }
                }
                PreviewKind.ZIP -> {

                    val listing = repo.zipEntries(fileId, dek)
                    _state.update {
                        it.copy(zipEntries = listing.entries, zipTruncated = listing.truncated)
                    }
                }
                PreviewKind.TEXT -> {
                    val (txt, trunc) = repo.textContent(fileId, wrappedDek = dek)
                    _state.update { it.copy(textContent = txt, textTruncated = trunc) }
                }
                PreviewKind.OTHER -> Unit
            }
        } catch (_: Exception) {

        }
    }

    private fun renderPdf(file: File): List<ImageBitmap> {
        val pages = mutableListOf<ImageBitmap>()
        ParcelFileDescriptor.open(file, ParcelFileDescriptor.MODE_READ_ONLY).use { pfd ->
            PdfRenderer(pfd).use { renderer ->
                val count = minOf(renderer.pageCount, MAX_PDF_PAGES)
                var budget = MAX_PDF_PIXELS
                for (i in 0 until count) {
                    renderer.openPage(i).use { page ->
                        val scale = (PDF_TARGET_WIDTH.toFloat() / page.width).coerceAtMost(2f)
                        val w = (page.width * scale).toInt().coerceAtLeast(1)
                        val h = (page.height * scale).toInt().coerceAtLeast(1)

                        if (w.toLong() * h > budget) return@use
                        budget -= w * h
                        val bmp = Bitmap.createBitmap(w, h, Bitmap.Config.ARGB_8888)
                        Canvas(bmp).drawColor(Color.WHITE)
                        page.render(bmp, null, null, PdfRenderer.Page.RENDER_MODE_FOR_DISPLAY)
                        pages.add(bmp.asImageBitmap())
                    }
                }
            }
        }
        return pages
    }

    fun download(dest: Uri) {
        val f = _state.value.file ?: return
        _state.update { it.copy(downloading = true, message = null, error = null) }
        viewModelScope.launch {
            try {
                repo.saveTo(f.id, dest)
                _state.update { it.copy(downloading = false, message = "Saved") }
            } catch (e: Exception) {
                _state.update { it.copy(downloading = false, error = friendlyError(e, "Download failed")) }
            }
        }
    }

    fun saveToCloud() {
        val f = _state.value.file ?: return
        if (_state.value.saving) return
        _state.update { it.copy(saving = true, error = null, message = null) }
        viewModelScope.launch {
            try {
                repo.saveSharedFile(f.id)
                _state.update { it.copy(saving = false, message = "Saved to your cloud") }
            } catch (e: Exception) {
                _state.update { it.copy(saving = false, error = friendlyError(e, "Couldn't save")) }
            }
        }
    }

    fun delete() {
        val f = _state.value.file ?: return
        viewModelScope.launch {
            try {
                repo.delete(f.id)
                _deleted.value = true
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Delete failed")) }
            }
        }
    }

    fun toggleFavorite() {
        val f = _state.value.file ?: return
        val newValue = !f.is_favorite
        viewModelScope.launch {
            try {

                repo.setFavorite(f.id, newValue)
                _state.update { it.copy(file = f.withFavorite(newValue)) }
            } catch (e: Exception) {
                _state.update { it.copy(error = friendlyError(e, "Couldn't update favorite")) }
            }
        }
    }

    fun messageShown() = _state.update { it.copy(message = null) }

    fun openMoveDialog() {
        _state.update { it.copy(showMoveDialog = true, moveError = null) }
        if (_state.value.folders.isEmpty()) {
            _state.update { it.copy(foldersLoading = true) }
            viewModelScope.launch {
                try {
                    val all = folderRepo.list()
                    _state.update { it.copy(folders = all, foldersLoading = false) }
                } catch (e: Exception) {
                    _state.update {
                        it.copy(foldersLoading = false, moveError = friendlyError(e, "Couldn't load folders"))
                    }
                }
            }
        }
    }

    fun dismissMoveDialog() = _state.update { it.copy(showMoveDialog = false, moveError = null) }

    fun move(targetFolderId: String?) {
        val f = _state.value.file ?: return
        _state.update { it.copy(moving = true, moveError = null) }
        viewModelScope.launch {
            try {
                val updated = repo.move(f.id, targetFolderId)
                _state.update {
                    it.copy(file = updated, moving = false, showMoveDialog = false, message = "Moved")
                }
            } catch (e: Exception) {
                _state.update { it.copy(moving = false, moveError = friendlyError(e, "Move failed")) }
            }
        }
    }

    fun openExpiryDialog() = _state.update { it.copy(showExpiryDialog = true) }
    fun dismissExpiryDialog() = _state.update { it.copy(showExpiryDialog = false) }

    fun setExpiry(expiresAt: String?) {
        val f = _state.value.file ?: return
        viewModelScope.launch {
            try {
                val updated = repo.setExpiry(f.id, expiresAt)
                _state.update {
                    it.copy(file = updated, showExpiryDialog = false, message = if (expiresAt == null) "Expiry cleared" else "Expiry set")
                }
            } catch (e: Exception) {
                _state.update { it.copy(showExpiryDialog = false, error = friendlyError(e, "Couldn't set expiry")) }
            }
        }
    }

    fun openShareDialog() {
        val name = _state.value.file?.original_name ?: return
        share.openForFile(fileId, name)
    }

    fun analyze(refresh: Boolean = false) {
        val f = _state.value.file ?: return
        if (_state.value.aiLoading) return
        _state.update { it.copy(aiLoading = true, aiError = null) }
        viewModelScope.launch {
            try {
                val summary = repo.analyze(f.id, f.wrapped_dek)
                _state.update {
                    it.copy(aiLoading = false, aiSummary = summary, aiModel = "local", aiError = null)
                }
            } catch (e: Exception) {
                val msg = when (httpStatus(e)) {
                    403 -> friendlyError(e, "Turn on AI analysis in Profile → AI to use this.")
                    503 -> "AI analysis isn't available right now."
                    422 -> "The model couldn't describe this file."
                    415 -> "This file type can't be analyzed."
                    413 -> "This image is too large to analyze."
                    429 -> "Too many analyses in progress. Try again in a moment."
                    else -> friendlyError(e, "Couldn't analyze this file")
                }
                _state.update { it.copy(aiLoading = false, aiError = msg) }
            }
        }
    }

}

class FileDetailViewModelFactory(
    private val repo: FileRepository,
    private val folderRepo: FolderRepository,
    private val shareRepo: ShareRepository,
    private val events: EventStream,
    private val fileId: String,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        FileDetailViewModel(repo, folderRepo, shareRepo, events, fileId) as T
}
