package com.cloudcast.app.ui.files

import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.PrimaryUploadButton
import com.cloudcast.app.ui.theme.AppIcons

@Composable
internal fun EmptyFilesState(
    atRoot: Boolean,
    onUpload: () -> Unit,
    uploading: Boolean = false,
    modifier: Modifier = Modifier,
) {
    androidx.compose.foundation.layout.Column(
        modifier = modifier.padding(40.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Surface(
            shape = androidx.compose.foundation.shape.RoundedCornerShape(22.dp),
            color = MaterialTheme.colorScheme.primaryContainer,
            modifier = Modifier.size(88.dp),
        ) {
            Box(contentAlignment = Alignment.Center) {
                MaterialSymbol(
                    AppIcons.cloudDone,
                    size = 46,
                    tint = MaterialTheme.colorScheme.primary,
                )
            }
        }
        Spacer(Modifier.size(22.dp))
        Text(
            if (atRoot) "Your cloud is ready" else "This folder is empty",
            style = MaterialTheme.typography.titleLarge,
            color = MaterialTheme.colorScheme.onSurface,
        )
        Spacer(Modifier.size(7.dp))
        Text(
            if (atRoot)
                "Nothing here yet. Add your first file."
            else
                "Nothing here yet. Upload a file or create a subfolder.",
            color = MaterialTheme.colorScheme.onSurfaceVariant,
            style = MaterialTheme.typography.bodyMedium,
            textAlign = androidx.compose.ui.text.style.TextAlign.Center,
        )
        if (atRoot) {
            Spacer(Modifier.size(24.dp))
            PrimaryUploadButton(onClick = onUpload, enabled = !uploading)
            Spacer(Modifier.size(16.dp))
        }
    }
}
