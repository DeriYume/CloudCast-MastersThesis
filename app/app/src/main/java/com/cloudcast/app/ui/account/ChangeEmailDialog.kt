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
import com.cloudcast.app.core.emailIsValid
import com.cloudcast.app.ui.auth.AuthFieldKind
import com.cloudcast.app.ui.auth.AuthInput
import com.cloudcast.app.ui.common.ErrorText

@Composable
fun ChangeEmailDialog(
    currentEmail: String,
    busy: Boolean,
    error: String?,
    onConfirm: (password: String, newEmail: String) -> Unit,
    onDismiss: () -> Unit,
) {
    var password by remember { mutableStateOf("") }
    var oldEmail by remember { mutableStateOf("") }
    var newEmail by remember { mutableStateOf("") }

    val emailValid = emailIsValid(newEmail)

    val oldMatches = oldEmail.trim().equals(currentEmail.trim(), ignoreCase = true)
    val canSubmit = password.isNotEmpty() && oldMatches && emailValid && !busy

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Change email") },
        text = {
            Column(verticalArrangement = Arrangement.spacedBy(16.dp)) {
                AuthInput(
                    kind = AuthFieldKind.EMAIL,
                    label = "Current email",
                    value = oldEmail,
                    onValueChange = { oldEmail = it },
                    isError = oldEmail.isNotEmpty() && !oldMatches,
                    helperText = if (oldEmail.isNotEmpty() && !oldMatches) "That's not this account's address" else null,
                )
                AuthInput(
                    kind = AuthFieldKind.EMAIL,
                    label = "New email",
                    value = newEmail,
                    onValueChange = { newEmail = it },
                    isError = newEmail.isNotEmpty() && !emailValid,
                    helperText = if (newEmail.isNotEmpty() && !emailValid) "Enter a valid email" else null,
                )
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "Current password",
                    value = password,
                    onValueChange = { password = it },
                )
                if (error != null) {
                    ErrorText(error)
                }
            }
        },
        confirmButton = {
            TextButton(
                enabled = canSubmit,
                onClick = { onConfirm(password, newEmail) },
            ) { Text("Update") }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )
}
