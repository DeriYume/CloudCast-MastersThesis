package com.cloudcast.app.ui.files

import androidx.compose.foundation.gestures.detectDragGesturesAfterLongPress
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.snapshots.SnapshotStateMap
import androidx.compose.ui.Modifier
import androidx.compose.ui.composed
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.geometry.Rect
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.LayoutCoordinates
import androidx.compose.ui.layout.boundsInRoot
import androidx.compose.ui.layout.onGloballyPositioned

class RowDragState {
    var active by mutableStateOf(false)
        private set
    var pointer by mutableStateOf(Offset.Zero)
        private set
    var hoveredFolderId by mutableStateOf<String?>(null)
        private set
    var badgeCount by mutableIntStateOf(0)
        private set

    val folderBounds: SnapshotStateMap<String, Rect> = mutableStateMapOf()

    fun start(root: Offset, count: Int) {
        active = true
        pointer = root
        badgeCount = count
        hoveredFolderId = null
    }

    fun update(delta: Offset) {
        pointer += delta
        hoveredFolderId = folderBounds.entries.firstOrNull { it.value.contains(pointer) }?.key
    }

    fun end(): String? {
        val target = hoveredFolderId
        active = false
        hoveredFolderId = null
        return target
    }

    fun cancel() {
        active = false
        hoveredFolderId = null
    }
}

fun Modifier.folderDropBounds(state: RowDragState, id: String): Modifier =
    this.onGloballyPositioned { state.folderBounds[id] = it.boundsInRoot() }

fun Modifier.draggableSelectedRow(
    state: RowDragState,
    count: Int,
    onDropToFolder: (String) -> Unit,
): Modifier = composed {
    var coords by remember { mutableStateOf<LayoutCoordinates?>(null) }
    this
        .onGloballyPositioned { coords = it }
        .pointerInput(count) {
            detectDragGesturesAfterLongPress(
                onDragStart = { offset ->
                    val root = coords?.localToRoot(offset) ?: offset
                    state.start(root, count)
                },
                onDrag = { change, dragAmount ->
                    change.consume()
                    state.update(dragAmount)
                },
                onDragEnd = { state.end()?.let(onDropToFolder) },
                onDragCancel = { state.cancel() },
            )
        }
}
