package com.cloudcast.app.ui.auth

import androidx.compose.foundation.background
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.systemBarsPadding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Checkbox
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.platform.LocalClipboardManager
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.core.PASSWORD_RULES
import com.cloudcast.app.core.emailIsValid
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.LoadingContent
import com.cloudcast.app.ui.common.LogoMark
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.PrimaryButton
import com.cloudcast.app.ui.common.SecondaryButton
import com.cloudcast.app.ui.theme.AppIcons

@Composable
fun LoginScreen(
    viewModel: AuthViewModel,
    onAuthenticated: () -> Unit,
    onUseQr: () -> Unit = {},
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val authed by viewModel.authenticated.collectAsStateWithLifecycle()
    val focusManager = LocalFocusManager.current

    LaunchedEffect(authed) {
        if (authed) onAuthenticated()
    }

    val emailInvalid = state.email.isNotEmpty() && !emailIsValid(state.email)
    val confirmMismatch = state.confirm.isNotEmpty() && state.confirm != state.password

    Column(
        modifier = Modifier
            .fillMaxSize()
            .background(MaterialTheme.colorScheme.background)
            .pointerInput(Unit) {
                detectTapGestures(onTap = { focusManager.clearFocus() })
            }
            .systemBarsPadding()
            .padding(24.dp)
            .verticalScroll(rememberScrollState()),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) {
        Column(
            modifier = Modifier.widthIn(max = 360.dp).fillMaxWidth(),

            horizontalAlignment = Alignment.CenterHorizontally,
        ) {

            LogoMark(boxSize = 58)

            Spacer(Modifier.height(24.dp))
            Text(
                if (state.mode == AuthMode.LOGIN) "Welcome back" else "Create your cloud",
                fontWeight = FontWeight.Bold,
                fontSize = 27.sp,
                letterSpacing = (-0.5).sp,
                color = MaterialTheme.colorScheme.onSurface,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(5.dp))
            Text(
                if (state.mode == AuthMode.LOGIN) "Sign in to your cloud." else "Set up your cloud.",
                color = MaterialTheme.colorScheme.onSurfaceVariant,
                textAlign = TextAlign.Center,
            )
            Spacer(Modifier.height(24.dp))

            state.error?.let {

                ErrorText(
                    it,
                    modifier = Modifier.fillMaxWidth().padding(bottom = 12.dp),
                    textAlign = TextAlign.Center,
                )
            }

            if (state.recoverySucceeded) {
                Text(
                    "Password reset. Sign in with your new password.",
                    color = MaterialTheme.colorScheme.primary,
                    textAlign = TextAlign.Center,
                    modifier = Modifier.padding(bottom = 12.dp),
                )
            }

            AuthInput(
                kind = AuthFieldKind.EMAIL,
                label = "Email",
                value = state.email,
                onValueChange = viewModel::setEmail,
                isError = emailInvalid,
                helperText = if (emailInvalid) "Enter a valid email address" else null,
            )
            Spacer(Modifier.height(8.dp))

            if (state.mode == AuthMode.RECOVER) {
                AuthInput(
                    kind = AuthFieldKind.EMAIL,
                    label = "Recovery code",
                    value = state.recoveryInput,
                    onValueChange = viewModel::setRecoveryInput,
                    helperText = "The code you saved when you created the account.",
                )
                Spacer(Modifier.height(8.dp))
            }

            AuthInput(
                kind = AuthFieldKind.PASSWORD,
                label = if (state.mode == AuthMode.RECOVER) "New password" else "Password",
                value = state.password,
                onValueChange = viewModel::setPassword,
            )

            if (state.mode == AuthMode.REGISTER || state.mode == AuthMode.RECOVER) {
                Spacer(Modifier.height(8.dp))
                AuthInput(
                    kind = AuthFieldKind.PASSWORD,
                    label = "Confirm password",
                    value = state.confirm,
                    onValueChange = viewModel::setConfirm,
                    isError = confirmMismatch,
                    helperText = if (confirmMismatch) "Passwords don't match" else null,
                )
                if (state.password.isNotEmpty()) {
                    Spacer(Modifier.height(8.dp))
                    Column(Modifier.fillMaxWidth()) {
                        PASSWORD_RULES.forEach { rule ->
                            val ok = rule.test(state.password)
                            Text(
                                text = (if (ok) "✓ " else "○ ") + rule.label,
                                color = if (ok) MaterialTheme.colorScheme.primary
                                else MaterialTheme.colorScheme.onSurfaceVariant,
                                style = MaterialTheme.typography.bodySmall,
                            )
                        }
                    }
                }
            }

            Spacer(Modifier.height(20.dp))
            PrimaryButton(
                onClick = viewModel::submit,
                enabled = viewModel.canSubmit(state) && !state.loading,
            ) {
                LoadingContent(
                    isLoading = state.loading,
                    spinnerColor = MaterialTheme.colorScheme.onPrimary,
                ) {
                    Text(
                        when (state.mode) {
                            AuthMode.LOGIN -> "Sign in"
                            AuthMode.REGISTER -> "Create account"
                            AuthMode.RECOVER -> "Reset password"
                        },
                    )
                }
            }

            if (state.mode == AuthMode.LOGIN) {
                TextButton(onClick = viewModel::showRecover, enabled = !state.loading) {
                    Text("Forgot password?")
                }
            }
            if (state.mode == AuthMode.RECOVER) {
                TextButton(onClick = viewModel::showLogin, enabled = !state.loading) {
                    Text("Back to sign in")
                }
            }

            if (state.mode == AuthMode.LOGIN) {
                Spacer(Modifier.height(12.dp))
                SecondaryButton(
                    onClick = onUseQr,
                    enabled = !state.loading,
                    modifier = Modifier.fillMaxWidth(),
                    contentColor = MaterialTheme.colorScheme.onSurface,
                ) {
                    MaterialSymbol(
                        AppIcons.qrCode2,
                        size = 24,
                        tint = MaterialTheme.colorScheme.primary,
                    )
                    Spacer(Modifier.height(0.dp))
                    Text("  Use another device")
                }
            }

            Spacer(Modifier.height(16.dp))
            Row(
                modifier = Modifier.fillMaxWidth(),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.Center,
            ) {
                Text(
                    if (state.mode == AuthMode.LOGIN) "No account yet? " else "Already have an account? ",
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                TextButton(onClick = viewModel::toggleMode) {
                    Text(if (state.mode == AuthMode.LOGIN) "Create one" else "Sign in")
                }
            }
        }
    }

    state.recoveryCode?.let { code ->
        RecoveryCodeDialog(code = code, onAcknowledge = viewModel::acknowledgeRecoveryCode)
    }
}

@Composable
private fun RecoveryCodeDialog(code: String, onAcknowledge: () -> Unit) {
    val clipboard = LocalClipboardManager.current
    var confirmed by remember { mutableStateOf(false) }

    AlertDialog(

        onDismissRequest = {},
        title = { Text("Save your recovery code") },
        text = {
            Column {
                Text(
                    "This is the only way to get back into your account if you forget your " +
                        "password. We can't show it again or reset it for you - store it somewhere safe.",
                    style = MaterialTheme.typography.bodyMedium,
                )
                Spacer(Modifier.height(16.dp))
                Surface(
                    color = MaterialTheme.colorScheme.surfaceVariant,
                    shape = RoundedCornerShape(8.dp),
                    modifier = Modifier.fillMaxWidth(),
                ) {
                    Text(
                        code,
                        modifier = Modifier.padding(12.dp),
                        style = MaterialTheme.typography.bodyMedium,
                        fontFamily = FontFamily.Monospace,
                    )
                }
                Spacer(Modifier.height(8.dp))
                TextButton(onClick = { clipboard.setText(AnnotatedString(code)) }) {
                    Text("Copy code")
                }
                Spacer(Modifier.height(8.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Checkbox(checked = confirmed, onCheckedChange = { confirmed = it })
                    Text("I've saved my recovery code", style = MaterialTheme.typography.bodyMedium)
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onAcknowledge, enabled = confirmed) {
                Text("Continue")
            }
        },
    )
}
