package com.cloudcast.app.ui.account

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.unit.dp
import com.cloudcast.app.core.passwordIsValid
import com.cloudcast.app.ui.auth.AuthFieldKind
import com.cloudcast.app.ui.auth.AuthInput
import com.cloudcast.app.ui.common.ErrorText

@Composable
fun ChangePasswordDialog(
    busy: Boolean,
    error: String?,
    onConfirm: (current: String, new: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var current by remember { mutableStateOf("") }
    var newPass by remember { mutableStateOf("") }
    var confirm by remember { mutableStateOf("") }

    val newValid = passwordIsValid(newPass)
    val match = confirm.isNotEmpty() && confirm == newPass
    val canSubmit = current.isNotEmpty() && newValid && match && !busy

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change password") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "Current password",
                    value = current,
                    onValueChange = { current = it },
                )
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "New password",
                    value = newPass,
                    onValueChange = { newPass = it },
                    isError = newPass.isNotEmpty() && !newValid,
                    helperText = if (newPass.isNotEmpty() && !newValid)
                        "8+ chars with upper, lower, digit and symbol" else null,
                )
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "Confirm new password",
                    value = confirm,
                    onValueChange = { confirm = it },
                    isError = confirm.isNotEmpty() && !match,
                    helperText = if (confirm.isNotEmpty() && !match) "Passwords don't match" else null,
                )
                if (error != null) {
                    ErrorText(error)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSubmit,
                onClick = { onConfirm(current, newPass) },
            ) { Text("Update") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
