package com.cloudcast.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.KeyboardCapitalization
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.ui.common.ErrorText

@Composable
fun QrSignIn(
    viewModel: QrScanViewModel,
    onBack: () -> Unit,
    onSignedIn: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()

    LaunchedEffect(state.signedIn) {
        if (state.signedIn) onSignedIn()
    }

    if (state.manualEntry) {
        ManualCodeEntry(
            state = state,
            canSubmit = viewModel.typedCodeComplete(),
            onCodeChange = viewModel::onTypedCodeChange,
            onSubmit = viewModel::submitTypedCode,
            onUseCamera = { viewModel.showManualEntry(false) },
            onBack = onBack,
        )
        return
    }

    QrScannerOverlay(
        instruction = "Point your camera at the QR code shown on your other device.",
        busy = state.claiming || state.waiting,
        error = state.error,
        onCode = viewModel::onCodeScanned,
        onDismissError = viewModel::dismissError,
        onCancel = onBack,

        busyLabel = if (state.waiting) "Waiting for approval on your other device…" else "Claiming code…",
        secondaryActionLabel = "Enter the code instead",
        onSecondaryAction = { viewModel.showManualEntry(true) },
    )
}

@Composable
private fun ManualCodeEntry(
    state: QrScanUiState,
    canSubmit: Boolean,
    onCodeChange: (String) -> Unit,
    onSubmit: () -> Unit,
    onUseCamera: () -> Unit,
    onBack: () -> Unit,
) {
    Column(
        modifier = Modifier.fillMaxSize().padding(32.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Text(
            "On a device where you're already signed in, open \"Sign in another device\" " +
                "and enter the code it shows. Your keys transfer securely - no password " +
                "needed here.",
            style = MaterialTheme.typography.bodyMedium,
            textAlign = TextAlign.Center,
        )
        Spacer(Modifier.size(24.dp))

        if (state.waiting) {
            CircularProgressIndicator()
            Spacer(Modifier.size(16.dp))
            Text(
                "Waiting for approval on your other device…",
                style = MaterialTheme.typography.bodyMedium,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
        } else {
            OutlinedTextField(
                value = state.typedCode,
                onValueChange = onCodeChange,
                label = { Text("Sign-in code") },
                placeholder = { Text("XK4M-9PTW") },
                singleLine = true,
                enabled = !state.claiming,
                shape = RoundedCornerShape(14.dp),
                textStyle = MaterialTheme.typography.bodyLarge.copy(
                    fontFamily = FontFamily.Monospace,
                    letterSpacing = 3.sp,
                ),
                keyboardOptions = KeyboardOptions(

                    capitalization = KeyboardCapitalization.Characters,
                    autoCorrectEnabled = false,
                ),
                modifier = Modifier.fillMaxWidth(),
            )
            if (state.error != null) {
                Spacer(Modifier.size(16.dp))
                ErrorText(state.error)
            }
            Spacer(Modifier.size(20.dp))
            Button(
                onClick = onSubmit,

                enabled = !state.claiming && canSubmit,
                modifier = Modifier.fillMaxWidth(),
            ) { Text("Sign in") }
            Spacer(Modifier.size(8.dp))
            TextButton(onClick = onUseCamera) { Text("Scan a QR code instead") }
        }

        Spacer(Modifier.size(8.dp))
        TextButton(onClick = onBack) { Text("Back to email & password") }
    }
}
