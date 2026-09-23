package com.cloudcast.app.ui.notifications

import androidx.lifecycle.ViewModel
import androidx.lifecycle.ViewModelProvider
import androidx.lifecycle.viewModelScope
import com.cloudcast.app.core.friendlyError
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.NotificationDto
import com.cloudcast.app.data.repository.FileRepository
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch

data class NotificationsUiState(
    val items: List<NotificationDto> = emptyList(),
    val unread: Int = 0,
    val loading: Boolean = false,
    val error: String? = null,
    val open: Boolean = false,
)

class NotificationsViewModel(
    private val files: FileRepository,
    private val events: EventStream,
) : ViewModel() {

    private val _state = MutableStateFlow(NotificationsUiState())
    val state: StateFlow<NotificationsUiState> = _state.asStateFlow()

    init {
        refresh()

        viewModelScope.launch {
            events.events().collect { event ->
                if (event == "notification") refresh(silent = true)
            }
        }
    }

    fun refresh(silent: Boolean = false) {
        val hasContent = _state.value.items.isNotEmpty()
        _state.update { it.copy(loading = !(silent || hasContent), error = null) }
        viewModelScope.launch {
            try {
                val (items, unread) = files.notifications()
                _state.update { it.copy(items = items, unread = unread, loading = false) }
            } catch (e: Exception) {
                _state.update { it.copy(loading = false, error = friendlyError(e, "Couldn't load notifications")) }
            }
        }
    }

    fun open() {
        _state.update { it.copy(open = true) }
        refresh()
    }

    fun dismiss() = _state.update { it.copy(open = false) }

    fun remove(id: String) {
        val removed = _state.value.items.find { it.id == id } ?: return
        _state.update { s ->
            s.copy(
                items = s.items.filterNot { it.id == id },
                unread = (s.unread - 1).coerceAtLeast(0),
            )
        }
        viewModelScope.launch {
            try {
                files.deleteNotification(id)
            } catch (e: Exception) {
                _state.update { s ->
                    s.copy(
                        items = (s.items + removed).sortedByDescending { it.created_at },
                        unread = s.unread + 1,
                        error = friendlyError(e, "Couldn't dismiss that notification"),
                    )
                }
            }
        }
    }

    fun clearAll() {
        val previous = _state.value
        if (previous.items.isEmpty()) return
        _state.update { it.copy(items = emptyList(), unread = 0) }
        viewModelScope.launch {
            try {
                files.clearNotifications()
            } catch (e: Exception) {
                _state.update {
                    it.copy(
                        items = previous.items,
                        unread = previous.unread,
                        error = friendlyError(e, "Couldn't clear notifications"),
                    )
                }
            }
        }
    }
}

class NotificationsViewModelFactory(
    private val files: FileRepository,
    private val events: EventStream,
) : ViewModelProvider.Factory {
    @Suppress("UNCHECKED_CAST")
    override fun <T : ViewModel> create(modelClass: Class<T>): T =
        NotificationsViewModel(files, events) as T
}
