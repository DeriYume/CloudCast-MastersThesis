package com.cloudcast.app.ui.sharing

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.clickable
import androidx.compose.foundation.text.KeyboardActions
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.DropdownMenu
import androidx.compose.material3.DropdownMenuItem
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.platform.LocalSoftwareKeyboardController
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.input.ImeAction
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.core.SharePermissions
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.ui.common.ConfirmDialog
import com.cloudcast.app.ui.common.ErrorText
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.OverflowMenu
import com.cloudcast.app.ui.common.OverflowMenuItem
import com.cloudcast.app.ui.common.RadioOptionRow
import com.cloudcast.app.ui.theme.AppIcons

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ShareDialog(
    itemName: String,
    shares: List<ShareRepository.ShareItem>,
    loading: Boolean,
    busy: Boolean,
    error: String?,
    onAddShare: (recipient: String, expiresAt: String?, permission: String) -> Unit,
    onRevoke: (shareId: String) -> Unit,
    onChangePermission: (shareId: String, permission: String) -> Unit,
    onChangeExpiry: (shareId: String, expiresAt: String?) -> Unit,
    onDismiss: () -> Unit,

    contacts: List<ShareRepository.Contact> = emptyList(),

    onSetExpiryForAll: ((String?) -> Unit)? = null,

    onStopSharing: (() -> Unit)? = null,
) {
    var recipient by remember { mutableStateOf("") }
    var showExpiryPicker by remember { mutableStateOf(false) }
    var showBulkExpiryPicker by remember { mutableStateOf(false) }
    var confirmStopSharing by remember { mutableStateOf(false) }
    var expiresAt by remember { mutableStateOf<String?>(null) }
    var permission by remember { mutableStateOf(SharePermissions.VIEW) }
    var permissionMenuOpen by remember { mutableStateOf(false) }
    var editingShareId by remember { mutableStateOf<String?>(null) }
    val keyboard = LocalSoftwareKeyboardController.current
    val focusManager = LocalFocusManager.current

    fun dropKeyboard() {
        keyboard?.hide()
        focusManager.clearFocus()
    }

    val canAdd = recipient.isNotBlank() && !busy

    fun reset() {
        recipient = ""
        expiresAt = null
        permission = SharePermissions.VIEW
    }

    val query = recipient.trim().lowercase()
    val suggestions = if (query.isEmpty()) emptyList() else contacts
        .filter { it.label.lowercase().contains(query) }
        .filter { it.label.lowercase() != query }
        .take(6)

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text(
                    "Share $itemName",
                    fontWeight = FontWeight.Bold,
                    fontSize = 16.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                    modifier = Modifier.weight(1f),
                )
                if (shares.isNotEmpty()) {
                    OverflowMenu(contentDescription = "Sharing options") { close ->
                        if (onSetExpiryForAll != null) {
                            OverflowMenuItem(
                                "Set expiry for everyone",
                                AppIcons.schedule,
                                onClick = { close(); showBulkExpiryPicker = true },
                            )
                        }
                        if (onStopSharing != null) {
                            OverflowMenuItem(
                                "Stop sharing",
                                AppIcons.close,
                                onClick = { close(); confirmStopSharing = true },
                            )
                        }
                    }
                }
            }
        },
        text = {
            Column {
                OutlinedTextField(
                    value = recipient,
                    onValueChange = { recipient = it },
                    label = { Text("Email address") },
                    singleLine = true,
                    shape = RoundedCornerShape(14.dp),
                    colors = fieldColors(),
                    keyboardOptions = KeyboardOptions(
                        keyboardType = KeyboardType.Email,
                        autoCorrectEnabled = false,
                        imeAction = ImeAction.Done,
                    ),
                    keyboardActions = KeyboardActions(onDone = { dropKeyboard() }),
                    modifier = Modifier.fillMaxWidth(),
                )

                if (suggestions.isNotEmpty()) {
                    Spacer(Modifier.size(6.dp))
                    Surface(
                        shape = RoundedCornerShape(8.dp),
                        color = MaterialTheme.colorScheme.surface,
                        border = BorderStroke(1.dp, MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f)),
                        modifier = Modifier.fillMaxWidth(),
                    ) {
                        Column {
                            suggestions.forEach { contact ->
                                ContactRow(contact) { recipient = contact.label; dropKeyboard() }
                            }
                        }
                    }
                }

                Spacer(Modifier.size(10.dp))

                PickerField(
                    label = "Permission",
                    value = SharePermissions.label(permission),
                    onClick = { dropKeyboard(); permissionMenuOpen = true },
                ) {
                    DropdownMenu(
                        expanded = permissionMenuOpen,
                        onDismissRequest = { permissionMenuOpen = false },
                    ) {
                        SharePermissions.selectable.forEach { level ->
                            DropdownMenuItem(
                                text = { Text(SharePermissions.label(level)) },
                                onClick = { permission = level; permissionMenuOpen = false },
                            )
                        }
                    }
                }

                Spacer(Modifier.size(10.dp))

                Row(verticalAlignment = Alignment.CenterVertically) {
                    PickerField(
                        label = "Access expires",
                        value = expiresAt?.let { formatDateTime(it) } ?: "",
                        placeholder = "Optional",
                        onClick = { dropKeyboard(); showExpiryPicker = true },
                        modifier = Modifier.weight(1f),
                    )
                    if (expiresAt != null) {
                        IconButton(onClick = { expiresAt = null }) {
                            MaterialSymbol(
                                AppIcons.close,
                                size = 20,
                                contentDescription = "Clear expiry",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }

                if (error != null) {
                    Spacer(Modifier.size(6.dp))
                    ErrorText(error)
                }

                Spacer(Modifier.size(14.dp))
                Text(
                    "PEOPLE WITH ACCESS" + if (shares.isNotEmpty()) " · ${shares.size}" else "",
                    fontFamily = FontFamily.Monospace,
                    fontSize = 11.sp,
                    fontWeight = FontWeight.SemiBold,
                    letterSpacing = 1.4.sp,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(bottom = 6.dp),
                )

                Box(Modifier.fillMaxWidth().heightIn(min = 56.dp, max = 220.dp)) {
                    when {
                        loading -> CircularProgressIndicator(Modifier.align(Alignment.Center))
                        shares.isEmpty() -> Text(
                            "Not shared with anyone yet.",
                            color = MaterialTheme.colorScheme.onSurfaceVariant,
                            fontSize = 13.sp,
                            modifier = Modifier.align(Alignment.Center).padding(8.dp),
                        )
                        else -> LazyColumn(Modifier.fillMaxWidth()) {
                            items(shares, key = { it.id }) { share ->
                                AccessRow(
                                    share = share,
                                    busy = busy,
                                    onClick = { dropKeyboard(); editingShareId = share.id },
                                    onRevoke = { onRevoke(share.id) },
                                )
                            }
                        }
                    }
                }

            }
        },
        confirmButton = {
            TextButton(
                enabled = canAdd,
                onClick = {
                    dropKeyboard()
                    onAddShare(recipient.trim(), expiresAt, permission)
                    reset()
                },
            ) { Text("Share") }
        },
        dismissButton = {
            TextButton(onClick = { dropKeyboard(); onDismiss() }) { Text("Done") }
        },
    )

    editingShareId?.let { id ->
        val share = shares.firstOrNull { it.id == id }
        if (share == null) {
            editingShareId = null
        } else {
            RecipientDialog(
                share = share,
                busy = busy,
                onChangePermission = { onChangePermission(share.id, it) },
                onChangeExpiry = { onChangeExpiry(share.id, it) },
                onRevoke = { onRevoke(share.id) },
                onDismiss = { editingShareId = null },
            )
        }
    }

    if (showExpiryPicker) {
        ExpiryDialog(
            itemName = "share",
            currentExpiresAt = expiresAt,
            onConfirm = { iso -> expiresAt = iso; showExpiryPicker = false },
            onDismiss = { showExpiryPicker = false },
        )
    }

    if (showBulkExpiryPicker && onSetExpiryForAll != null) {
        ExpiryDialog(
            itemName = "everyone's access",

            currentExpiresAt = null,
            onConfirm = { iso -> onSetExpiryForAll(iso); showBulkExpiryPicker = false },
            onDismiss = { showBulkExpiryPicker = false },
        )
    }

    if (confirmStopSharing && onStopSharing != null) {
        ConfirmDialog(
            title = "Stop sharing?",
            message = "Everyone will lose access to “$itemName”. It stays in your own files.",
            confirmLabel = "Stop sharing",
            onConfirm = { onStopSharing(); confirmStopSharing = false },
            onDismiss = { confirmStopSharing = false },
        )
    }
}

@Composable
private fun ContactRow(contact: ShareRepository.Contact, onClick: () -> Unit) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 12.dp, vertical = 9.dp),
    ) {
        Avatar(contact.label)
        Spacer(Modifier.size(10.dp))
        Text(
            contact.label,
            fontWeight = FontWeight.SemiBold,
            fontSize = 13.sp,
            maxLines = 1,
            overflow = TextOverflow.Ellipsis,
            color = MaterialTheme.colorScheme.onSurface,
            modifier = Modifier.weight(1f),
        )
    }
}

@Composable
private fun AccessRow(
    share: ShareRepository.ShareItem,
    busy: Boolean,
    onClick: () -> Unit,
    onRevoke: () -> Unit,
) {
    val label = share.label.ifBlank { "Unknown recipient" }

    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = Modifier
            .fillMaxWidth()
            .clickable(enabled = !busy, onClick = onClick)
            .padding(vertical = 6.dp),
    ) {
        Avatar(label)
        Spacer(Modifier.size(10.dp))
        Column(Modifier.weight(1f)) {
            Text(
                label,
                fontWeight = FontWeight.SemiBold,
                fontSize = 13.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurface,
            )
            Text(
                SharePermissions.label(share.permission) +
                    (share.expiresAt?.let { " · until ${formatDateTime(it)}" } ?: ""),
                fontSize = 11.sp,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
                color = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
        IconButton(enabled = !busy, onClick = onRevoke) {
            MaterialSymbol(
                AppIcons.close,
                size = 24,
                contentDescription = "Stop sharing with $label",
                tint = MaterialTheme.colorScheme.onSurfaceVariant,
            )
        }
    }
}

@Composable
private fun RecipientDialog(
    share: ShareRepository.ShareItem,
    busy: Boolean,
    onChangePermission: (String) -> Unit,
    onChangeExpiry: (String?) -> Unit,
    onRevoke: () -> Unit,
    onDismiss: () -> Unit,
) {
    val label = share.label.ifBlank { "Unknown recipient" }
    var showExpiryPicker by remember { mutableStateOf(false) }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Avatar(label)
                Spacer(Modifier.size(10.dp))
                Text(
                    label,
                    fontWeight = FontWeight.Bold,
                    fontSize = 15.sp,
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                    color = MaterialTheme.colorScheme.onSurface,
                )
            }
        },
        text = {
            Column {
                SharePermissions.selectable.forEach { level ->
                    RadioOptionRow(
                        label = SharePermissions.label(level),
                        selected = share.permission == level,
                        onSelect = { if (level != share.permission) onChangePermission(level) },
                    )
                }

                Spacer(Modifier.size(12.dp))
                Row(verticalAlignment = Alignment.CenterVertically) {
                    PickerField(
                        label = "Access expires",
                        value = share.expiresAt?.let { formatDateTime(it) } ?: "",
                        placeholder = "Never",
                        onClick = { showExpiryPicker = true },
                        modifier = Modifier.weight(1f),
                    )
                    if (share.expiresAt != null) {
                        IconButton(enabled = !busy, onClick = { onChangeExpiry(null) }) {
                            MaterialSymbol(
                                AppIcons.close,
                                size = 20,
                                contentDescription = "Remove expiry",
                                tint = MaterialTheme.colorScheme.error,
                            )
                        }
                    }
                }
            }
        },
        confirmButton = {
            TextButton(onClick = onDismiss) { Text("Done") }
        },
        dismissButton = {
            TextButton(
                enabled = !busy,
                onClick = { onRevoke(); onDismiss() },
            ) {
                Text("Stop sharing", color = MaterialTheme.colorScheme.error)
            }
        },
    )

    if (showExpiryPicker) {
        ExpiryDialog(
            itemName = "access for $label",
            currentExpiresAt = share.expiresAt,
            onConfirm = { iso -> onChangeExpiry(iso); showExpiryPicker = false },
            onDismiss = { showExpiryPicker = false },
        )
    }
}

@Composable
private fun PickerField(
    label: String,
    value: String,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
    placeholder: String? = null,
    menu: @Composable () -> Unit = {},
) {
    Box(modifier) {
        OutlinedTextField(
            value = value,
            onValueChange = {},
            readOnly = true,
            singleLine = true,
            label = { Text(label) },
            placeholder = placeholder?.let { { Text(it) } },
            shape = RoundedCornerShape(14.dp),
            colors = fieldColors(),
            trailingIcon = {
                MaterialSymbol(
                    AppIcons.expandMore,
                    size = 20,
                    tint = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            },
            modifier = Modifier.fillMaxWidth(),
        )
        Box(Modifier.matchParentSize().clickable(onClick = onClick))
        menu()
    }
}

@Composable
private fun fieldColors() = OutlinedTextFieldDefaults.colors(
    unfocusedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = 0.45f),
    focusedBorderColor = MaterialTheme.colorScheme.primary,
)

private fun initials(label: String): String {
    val local = label.substringBefore("@").ifBlank { label }
    val parts = local.split('.', '_', '-').filter { it.isNotBlank() }
    val chars = if (parts.size >= 2) "${parts[0].first()}${parts[1].first()}" else local.take(2)
    return chars.uppercase()
}

@Composable
private fun Avatar(seed: String) {
    Surface(
        shape = CircleShape,
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = Modifier.size(34.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            Text(
                initials(seed),
                color = MaterialTheme.colorScheme.primary,
                fontWeight = FontWeight.SemiBold,
                fontSize = 11.5.sp,
            )
        }
    }
}
