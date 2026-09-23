package com.cloudcast.app.ui.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.HorizontalDivider
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Scaffold
import androidx.compose.material3.SnackbarHost
import androidx.compose.material3.SnackbarHostState
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.lifecycle.compose.collectAsStateWithLifecycle
import com.cloudcast.app.core.AutoFileMode
import com.cloudcast.app.core.formatDate
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.core.timeLeft
import com.cloudcast.app.ui.auth.QrIssueDialog
import com.cloudcast.app.ui.auth.QrIssueViewModel
import com.cloudcast.app.ui.common.AppTopBar
import com.cloudcast.app.ui.common.CardCell
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.ThemeMode

@Composable
fun ProfileScreen(
    viewModel: ProfileViewModel,

    qrIssueViewModel: QrIssueViewModel,
    onBack: () -> Unit,
    onLoggedOut: () -> Unit,
) {
    val state by viewModel.state.collectAsStateWithLifecycle()
    val loggedOut by viewModel.loggedOut.collectAsStateWithLifecycle()
    val snackbar = remember { SnackbarHostState() }

    var showThemeDialog by remember { mutableStateOf(false) }
    var showAutoFileDialog by remember { mutableStateOf(false) }
    var showCancelDeletionDialog by remember { mutableStateOf(false) }

    LaunchedEffect(loggedOut) { if (loggedOut) onLoggedOut() }
    LaunchedEffect(state.message) {
        state.message?.let { snackbar.showSnackbar(it); viewModel.messageShown() }
    }

    val name = state.displayName.ifBlank { state.email }

    Scaffold(
        topBar = { AppTopBar(title = "Profile", onBack = onBack) },
        snackbarHost = { SnackbarHost(snackbar) },
    ) { padding ->

        Column(
            modifier = Modifier
                .fillMaxSize()
                .padding(padding)
                .verticalScroll(rememberScrollState())
                .padding(24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Spacer(Modifier.size(16.dp))
            Surface(modifier = Modifier.size(88.dp), shape = CircleShape, color = MaterialTheme.colorScheme.primary) {
                Box(contentAlignment = Alignment.Center) {
                    Text(
                        text = name.take(1).uppercase(),
                        style = MaterialTheme.typography.headlineLarge,
                        color = MaterialTheme.colorScheme.onPrimary,
                    )
                }
            }
            Spacer(Modifier.size(16.dp))
            Text(name, style = MaterialTheme.typography.titleLarge)
            Text(state.email, style = MaterialTheme.typography.bodyMedium, color = MaterialTheme.colorScheme.onSurfaceVariant)

            state.createdAt?.let { created ->
                Spacer(Modifier.size(24.dp))
                Row(modifier = Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceBetween) {
                    Text("Member since", color = MaterialTheme.colorScheme.onSurfaceVariant)
                    Text(formatDate(created))
                }
            }

            Spacer(Modifier.size(28.dp))
            SettingsSectionLabel("Account")
            Spacer(Modifier.size(8.dp))
            CardCell(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {

                    SettingsRow("Change email", AppIcons.mail, viewModel::openEmailDialog)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingsRow("Change password", AppIcons.lock, viewModel::openPasswordDialog)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)

                    SettingsRow("Sign in another device", AppIcons.devices, viewModel::openApproveLoginDialog)
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingsRow("New recovery code", AppIcons.key, viewModel::openRegenerateDialog)
                }
            }

            Spacer(Modifier.size(24.dp))
            SettingsSectionLabel("Preferences")
            Spacer(Modifier.size(8.dp))
            CardCell(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {
                    SettingsRow(
                        label = "Appearance",
                        icon = AppIcons.darkMode,
                        onClick = { showThemeDialog = true },
                        value = themeLabel(state.themeMode),
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingsRow(
                        label = "Auto-file uploads",
                        icon = AppIcons.createNewFolder,
                        onClick = { showAutoFileDialog = true },
                        value = autoFileLabel(state.autoFileMode),
                    )
                    HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                    SettingsToggleRow(
                        label = "Stay signed in",
                        icon = AppIcons.lock,
                        checked = state.staySignedIn,
                        onCheckedChange = viewModel::setStaySignedIn,

                        description = "Keeps your keys on this device, encrypted by its " +
                            "secure hardware. Turn off to enter your password each time " +
                            "the app restarts.",
                    )

                    state.aiPreferences?.let { prefs ->
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsToggleRow(
                            label = "File analysis",
                            icon = AppIcons.autoAwesome,
                            checked = prefs.analysis && state.aiAvailable,
                            enabled = state.aiAvailable,
                            onCheckedChange = { viewModel.setAiPreference(analysis = it) },

                            description = if (state.aiAvailable) {
                                "Lets you ask for a summary of a file. The server is " +
                                    "given a one-time key to that single file, reads it, " +
                                    "and returns the summary encrypted to you."
                            } else {
                                "Unavailable - this server has AI switched off."
                            },
                        )
                        HorizontalDivider(color = MaterialTheme.colorScheme.outlineVariant)
                        SettingsToggleRow(
                            label = "Search by meaning",
                            icon = AppIcons.search,
                            checked = prefs.semantic_search && state.semanticAvailable,
                            enabled = state.semanticAvailable,
                            onCheckedChange = { viewModel.setAiPreference(semanticSearch = it) },
                            description = if (state.semanticAvailable) {
                                "Search by meaning as well as by name. Your search text " +
                                    "is sent to the server to be matched; the ranking " +
                                    "happens on your device."
                            } else {
                                "Unavailable - this server has semantic search switched off."
                            },
                        )
                    }
                }
            }

            Spacer(Modifier.size(24.dp))
            SettingsSectionLabel("Danger zone")
            Spacer(Modifier.size(8.dp))
            CardCell(modifier = Modifier.fillMaxWidth()) {
                Column(Modifier.fillMaxWidth()) {

                    val pending = state.pendingDeletion
                    if (pending != null) {
                        SettingsRow(
                            if (state.accountBusy) "Cancelling\u2026" else "Cancel deletion",
                            AppIcons.history,
                            { showCancelDeletionDialog = true },
                            value = "${formatDateTime(pending)} \u00b7 ${timeLeft(pending)}",
                            stackValue = true,
                            destructive = true,
                        )
                    } else {
                        SettingsRow(
                            "Delete account",
                            AppIcons.delete,
                            viewModel::openDeleteDialog,
                            destructive = true,
                        )
                    }
                }
            }

            Spacer(Modifier.size(24.dp))
            LogoutButton(
                onClick = viewModel::logout,
                modifier = Modifier.fillMaxWidth(),
            )
            Spacer(Modifier.size(16.dp))
        }
    }

    if (showCancelDeletionDialog) {
        val pending = state.pendingDeletion
        ConfirmDialog(
            title = "Cancel the deletion?",
            message = if (pending != null) {
                "Your account is scheduled for deletion on ${formatDateTime(pending)}. Cancelling " +
                    "keeps the account and everything in it, and the deletion will not run."
            } else {
                "Cancelling keeps the account and everything in it, and the deletion will not run."
            },
            confirmLabel = "Cancel deletion",
            dismissLabel = "Keep it scheduled",
            onConfirm = { viewModel.restoreAccount(); showCancelDeletionDialog = false },
            onDismiss = { showCancelDeletionDialog = false },
        )
    }

    if (state.showRegenerateDialog) {
        RegenerateRecoveryDialog(
            busy = state.accountBusy,
            error = state.accountError,
            onConfirm = { password -> viewModel.regenerateRecoveryCode(password) },
            onDismiss = viewModel::dismissDialogs,
        )
    }

    state.newRecoveryCode?.let { code ->
        NewRecoveryCodeDialog(code = code, onAcknowledge = viewModel::recoveryCodeAcknowledged)
    }

    if (state.showDeleteDialog) {
        DeleteAccountDialog(
            email = state.email,
            graceDays = state.graceDays,
            busy = state.accountBusy,
            error = state.accountError,
            onConfirm = { password -> viewModel.deleteAccount(password) },
            onDismiss = viewModel::dismissDialogs,
        )
    }

    if (state.showPasswordDialog) {
        ChangePasswordDialog(
            busy = state.accountBusy,
            error = state.accountError,
            onConfirm = { current, new -> viewModel.changePassword(current, new) },
            onDismiss = viewModel::dismissDialogs,
        )
    }

    if (state.showEmailDialog) {
        ChangeEmailDialog(
            currentEmail = state.email,
            busy = state.accountBusy,
            error = state.accountError,
            onConfirm = { password, newEmail -> viewModel.changeEmail(password, newEmail) },
            onDismiss = viewModel::dismissDialogs,
        )
    }

    if (state.showApproveLoginDialog) {
        val qrIssueState by qrIssueViewModel.state.collectAsStateWithLifecycle()

        LaunchedEffect(Unit) { qrIssueViewModel.begin() }
        QrIssueDialog(
            state = qrIssueState,
            onApprove = qrIssueViewModel::approve,

            onDeny = qrIssueViewModel::begin,
            onRetry = qrIssueViewModel::begin,
            onDismiss = {
                qrIssueViewModel.stop()
                viewModel.dismissDialogs()
            },
        )
    }

    if (showThemeDialog) {
        RadioPickerDialog(
            title = "Appearance",
            options = listOf(
                RadioPickerOption(ThemeMode.LIGHT, "Light"),
                RadioPickerOption(ThemeMode.DARK, "Dark"),
                RadioPickerOption(
                    ThemeMode.SYSTEM,
                    "System",
                    description = "Follow your device's light/dark setting.",
                ),
            ),
            selected = state.themeMode,
            onSelect = { mode -> viewModel.setThemeMode(mode); showThemeDialog = false },
            onDismiss = { showThemeDialog = false },
        )
    }

    if (showAutoFileDialog) {
        RadioPickerDialog(
            title = "Auto-file uploads",
            options = listOf(
                RadioPickerOption(
                    AutoFileMode.OFF,
                    "Off",
                    description = "Uploads stay where you put them.",
                ),
                RadioPickerOption(
                    AutoFileMode.TYPE,
                    "By type",
                    description = "Sorted into folders like Images, Videos and Documents by file type.",
                ),
                RadioPickerOption(
                    AutoFileMode.SMART,
                    "Smart (AI)",
                    description = if (state.aiAvailable) {
                        "Looks at the file's content to pick a folder, falling back to By type when it can't tell."
                    } else {
                        "Unavailable - this server has AI switched off."
                    },

                    enabled = state.aiAvailable,
                ),
            ),
            selected = state.autoFileMode,
            onSelect = { mode -> viewModel.setAutoFileMode(mode); showAutoFileDialog = false },
            onDismiss = { showAutoFileDialog = false },
        )
    }
}
