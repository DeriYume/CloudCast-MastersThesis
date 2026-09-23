package com.cloudcast.app.ui.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.auth.AuthFieldKind
import com.cloudcast.app.ui.auth.AuthInput
import com.cloudcast.app.ui.common.ErrorText

@Composable
fun DeleteAccountDialog(
    email: String,
    graceDays: Int,
    busy: Boolean,
    error: String?,
    onConfirm: (password: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    val canSubmit = password.isNotEmpty() && !busy

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Delete your account?") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                Text(
                    "This schedules your account and every file in it for permanent deletion. Your files " +
                        "are encrypted with keys only you hold - once they're gone, nobody can " +
                        "recover them.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Text(
                    "Nothing is erased straight away: the deletion runs after a $graceDays-day " +
                        "grace period, during which your data is kept and you can cancel by " +
                        "signing back in. Anyone you've shared files with is notified so they " +
                        "can save a copy first.",
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "Confirm your password",
                    value = password,
                    onValueChange = { password = it },
                )
                if (error != null) ErrorText(error)
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSubmit,
                onClick = { onConfirm(password) },
            ) {
                Text("Delete account", color = MaterialTheme.colorScheme.error)
            }
        },
        dismissButton = { TextButton(onClick = onDismiss) { Text("Cancel") } },
    )
}
