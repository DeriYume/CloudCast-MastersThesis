package com.cloudcast.app.ui.auth

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.core.SignInCode
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun QrIssueDialog(
    state: QrIssueUiState,
    onApprove: () -> Unit,
    onDeny: () -> Unit,
    onRetry: () -> Unit,
    onDismiss: () -> Unit,
) {
    val phase = state.phase

    val dismissible = phase !is QrIssuePhase.Approving

    AlertDialog(
        onDismissRequest = { if (dismissible) onDismiss() },
        title = { Text(if (phase is QrIssuePhase.Confirm) "A device wants in" else "Sign in another device") },
        text = {
            Column(
                horizontalAlignment = Alignment.CenterHorizontally,
                modifier = Modifier.fillMaxWidth(),
            ) {
                when (phase) {
                    QrIssuePhase.Loading -> Busy()

                    is QrIssuePhase.Showing -> {
                        Text(
                            "On the new device, choose \"Sign in with a code\" and enter this:",
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.size(20.dp))
                        Text(

                            text = SignInCode.format(phase.code),
                            fontFamily = FontFamily.Monospace,
                            fontSize = 28.sp,
                            fontWeight = FontWeight.Bold,
                            letterSpacing = 4.sp,
                            textAlign = TextAlign.Center,
                            modifier = Modifier.fillMaxWidth(),
                        )
                        Spacer(Modifier.size(10.dp))
                        Text(
                            "Refreshes in ${phase.secondsRemaining}s",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                        )
                        Spacer(Modifier.size(20.dp))
                        Text(
                            "Only enter this on a device that's yours. Whoever types it in " +
                                "can be given access to your account.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.error,
                            textAlign = TextAlign.Center,
                        )
                    }

                    is QrIssuePhase.Confirm -> {
                        MaterialSymbol(AppIcons.qrCodeScanner, size = 40)
                        Spacer(Modifier.size(16.dp))
                        Text(
                            "Approve only if you just entered ${SignInCode.format(phase.code)} " +
                                "on your own device.",
                            style = MaterialTheme.typography.bodyMedium,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.size(8.dp))
                        Text(
                            "You stay signed in here; the other device gets its own session.",
                            style = MaterialTheme.typography.bodySmall,
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            textAlign = TextAlign.Center,
                        )
                        Spacer(Modifier.size(20.dp))
                        Row(
                            horizontalArrangement = Arrangement.spacedBy(12.dp),
                            modifier = Modifier.fillMaxWidth(),
                        ) {
                            OutlinedButton(onClick = onDeny, modifier = Modifier.weight(1f)) {
                                Text("Deny")
                            }
                            Button(onClick = onApprove, modifier = Modifier.weight(1f)) {
                                Text("Approve")
                            }
                        }
                    }

                    QrIssuePhase.Approving -> Busy("Approving…")

                    QrIssuePhase.Done -> Text(
                        "Approved. The other device is signing in now - no password needed there.",
                        style = MaterialTheme.typography.bodyMedium,
                        textAlign = TextAlign.Center,
                    )

                    is QrIssuePhase.Error -> {
                        ErrorText(phase.message)
                        Spacer(Modifier.size(16.dp))
                        Button(onClick = onRetry) { Text("Try again") }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(enabled = dismissible, onClick = onDismiss) {
                Text(if (phase is QrIssuePhase.Done) "Done" else "Close")
            }
        },
    )
}

@Composable
private fun Busy(label: String? = null) {
    Column(
        horizontalAlignment = Alignment.CenterHorizontally,
        modifier = Modifier.fillMaxWidth().padding(vertical = 24.dp),
    ) {
        CircularProgressIndicator()
        if (label != null) {
            Spacer(Modifier.size(16.dp))
            Text(label, style = MaterialTheme.typography.bodyMedium)
        }
    }
}
