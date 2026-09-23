package com.cloudcast.app.ui.files

import com.cloudcast.app.core.AutoFileMode
import com.cloudcast.app.data.network.ConflictInfo
import com.cloudcast.app.data.network.FileDto
import com.cloudcast.app.data.network.FolderDto

data class ConflictPrompt(val info: ConflictInfo, val bulk: Boolean)

data class AutoFilePrompt(val targetName: String, val count: Int)

data class FilesUiState(
    val allFolders: List<FolderDto> = emptyList(),
    val files: List<FileDto> = emptyList(),
    val favoriteFiles: List<FileDto> = emptyList(),
    val currentParentId: String? = null,
    val loading: Boolean = false,
    val uploading: Boolean = false,
    val error: String? = null,

    val selectionMode: Boolean = false,
    val selectedFileIds: Set<String> = emptySet(),
    val selectedFolderIds: Set<String> = emptySet(),
    val bulkDeleting: Boolean = false,
    val bulkMoving: Boolean = false,

    val zipping: Boolean = false,

    val conflict: ConflictPrompt? = null,

    val autoFileMode: AutoFileMode = AutoFileMode.OFF,
    val smartFiling: Boolean = false,
    val autoFilePrompt: AutoFilePrompt? = null,
    val filingReview: List<FilingRow>? = null,

    val filedNotice: String? = null,
) {

    val visibleFolders: List<FolderDto> by lazy {
        allFolders
            .filter { it.parent_id == currentParentId }
            .sortedBy { it.name.lowercase() }
    }

    val currentFolder: FolderDto?
        get() = allFolders.find { it.id == currentParentId }

    val atRoot: Boolean get() = currentParentId == null

    val isEmpty: Boolean get() = visibleFolders.isEmpty() && files.isEmpty()

    val selectedCount: Int get() = selectedFileIds.size + selectedFolderIds.size

    val selectableFileIds: Set<String> by lazy { files.mapTo(HashSet()) { it.id } }
    val selectableFolderIds: Set<String> by lazy { visibleFolders.mapTo(HashSet()) { it.id } }

    val allSelected: Boolean
        get() {
            val total = selectableFileIds.size + selectableFolderIds.size
            return total > 0 && selectedCount == total
        }

    fun isFileSelected(id: String): Boolean = id in selectedFileIds
    fun isFolderSelected(id: String): Boolean = id in selectedFolderIds
}

data class FilingRow(
    val fileId: String,
    val fileName: String,
    val suggestedName: String,
    val decision: FilingDecision,
)

sealed interface FilingDecision {
    data class Existing(val folderId: String) : FilingDecision
    data class New(val name: String) : FilingDecision
    data object Root : FilingDecision
}
