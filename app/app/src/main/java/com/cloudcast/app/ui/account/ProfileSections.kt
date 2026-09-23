package com.cloudcast.app.ui.account

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.selection.selectableGroup
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Switch
import androidx.compose.material3.SwitchDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import com.cloudcast.app.core.AutoFileMode
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.common.RadioOptionRow
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.ThemeMode

internal fun themeLabel(mode: ThemeMode): String = when (mode) {
    ThemeMode.LIGHT -> "Light"
    ThemeMode.DARK -> "Dark"
    ThemeMode.SYSTEM -> "System"
}

internal fun autoFileLabel(mode: AutoFileMode): String = when (mode) {
    AutoFileMode.OFF -> "Off"
    AutoFileMode.TYPE -> "By type"
    AutoFileMode.SMART -> "Smart (AI)"
}

@Composable
internal fun SettingsSectionLabel(text: String) {
    Text(
        text,
        modifier = Modifier.fillMaxWidth(),
        style = MaterialTheme.typography.labelLarge,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        textAlign = TextAlign.Start,
    )
}

@Composable
internal fun SettingsRow(
    label: String,
    icon: String,
    onClick: () -> Unit,
    value: String? = null,
    stackValue: Boolean = false,
    destructive: Boolean = false,
) {
    val accent = if (destructive) {
        MaterialTheme.colorScheme.error
    } else {
        MaterialTheme.colorScheme.primary
    }
    Row(
        modifier = Modifier
            .fillMaxWidth()
            .clickable(onClick = onClick)
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MaterialSymbol(icon, size = 24, tint = accent)
        Spacer(Modifier.size(16.dp))
        if (stackValue && value != null) {
            Column(Modifier.weight(1f)) {
                Text(label, color = if (destructive) accent else Color.Unspecified)
                Text(
                    value,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
            }
            Spacer(Modifier.size(8.dp))
        } else {
            Text(
                label,
                modifier = Modifier.weight(1f),

                color = if (destructive) accent else Color.Unspecified,
            )
            value?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.size(8.dp))
            }
        }
        MaterialSymbol(
            AppIcons.chevronRight,
            size = 24,
            tint = MaterialTheme.colorScheme.onSurfaceVariant,
        )
    }
}

@Composable
internal fun SettingsToggleRow(
    label: String,
    icon: String,
    checked: Boolean,
    onCheckedChange: (Boolean) -> Unit,
    description: String? = null,

    enabled: Boolean = true,
) {
    val dim = if (enabled) 1f else 0.5f
    Row(
        modifier = Modifier
            .fillMaxWidth()

            .clickable(enabled = enabled) { onCheckedChange(!checked) }
            .padding(horizontal = 16.dp, vertical = 14.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        MaterialSymbol(
            icon,
            size = 24,
            tint = MaterialTheme.colorScheme.primary.copy(alpha = dim),
        )
        Spacer(Modifier.size(16.dp))
        Column(Modifier.weight(1f)) {
            Text(label, color = MaterialTheme.colorScheme.onSurface.copy(alpha = dim))
            description?.let {
                Text(
                    it,
                    style = MaterialTheme.typography.bodySmall,
                    color = MaterialTheme.colorScheme.onSurfaceVariant.copy(alpha = dim),
                )
            }
        }
        Spacer(Modifier.size(8.dp))
        Switch(
            checked = checked,
            onCheckedChange = onCheckedChange,
            enabled = enabled,
            colors = SwitchDefaults.colors(
                uncheckedThumbColor = MaterialTheme.colorScheme.onSurfaceVariant,
                uncheckedTrackColor = MaterialTheme.colorScheme.surfaceVariant,
                uncheckedBorderColor = MaterialTheme.colorScheme.onSurfaceVariant,
            ),
        )
    }
}

internal data class RadioPickerOption<T>(
    val value: T,
    val label: String,
    val description: String? = null,

    val enabled: Boolean = true,
)

@Composable
internal fun <T> RadioPickerDialog(
    title: String,
    options: List<RadioPickerOption<T>>,
    selected: T,
    onSelect: (T) -> Unit,
    onDismiss: () -> Unit,
) {
    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text(title) },
        text = {
            Column(Modifier.selectableGroup()) {
                options.forEach { option ->
                    RadioOptionRow(
                        label = option.label,
                        description = option.description,
                        selected = option.value == selected,
                        onSelect = { onSelect(option.value) },
                        enabled = option.enabled,
                    )
                }
            }
        },
        confirmButton = { TextButton(onClick = onDismiss) { Text("Done") } },
    )
}
