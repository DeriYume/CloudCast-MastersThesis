package com.cloudcast.app.ui.sharing

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TimePicker
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.material3.rememberTimePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.cloudcast.app.core.formatDateTime
import com.cloudcast.app.core.toIsoFromLocal

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExpiryDialog(
    itemName: String,
    currentExpiresAt: String?,
    onConfirm: (String?) -> Unit,
    onDismiss: () -> Unit,
) {
    var showDatePicker by remember { mutableStateOf(false) }
    var showTimePicker by remember { mutableStateOf(false) }

    val dateState = rememberDatePickerState()
    val timeState = rememberTimePickerState(initialHour = 23, initialMinute = 59)

    val pickedIso = remember(
        dateState.selectedDateMillis, timeState.hour, timeState.minute,
    ) {
        val millis = dateState.selectedDateMillis
        if (millis == null) null
        else toIsoFromLocal(millis / 86_400_000L, timeState.hour, timeState.minute)
    }

    AlertDialog(
        onDismissRequest = onDismiss,
        title = { Text("Set expiry") },
        text = {
            Column {
                Text(
                    "\"$itemName\" will be unavailable after the chosen time.",
                    style = MaterialTheme.typography.bodyMedium,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                )
                Spacer(Modifier.size(12.dp))

                currentExpiresAt?.let {
                    Text(
                        "Current: ${formatDateTime(it)}",
                        style = MaterialTheme.typography.bodySmall,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                    Spacer(Modifier.size(8.dp))
                }

                TextButton(onClick = { showDatePicker = true }) {
                    Text(
                        dateState.selectedDateMillis?.let { "Date selected" } ?: "Pick a date",
                    )
                }
                TextButton(onClick = { showTimePicker = true }) {
                    Text("Time: %02d:%02d".format(timeState.hour, timeState.minute))
                }

                pickedIso?.let {
                    Spacer(Modifier.size(8.dp))
                    Text(
                        "Expires: ${formatDateTime(it)}",
                        style = MaterialTheme.typography.bodyMedium,
                    )
                }
            }
        },
        confirmButton = {
            Row(horizontalArrangement = Arrangement.End) {
                if (currentExpiresAt != null) {
                    TextButton(onClick = { onConfirm(null) }) { Text("Clear") }
                }
                TextButton(
                    enabled = pickedIso != null,
                    onClick = { pickedIso?.let { onConfirm(it) } },
                ) { Text("Set") }
            }
        },
        dismissButton = {
            TextButton(onClick = onDismiss) { Text("Cancel") }
        },
    )

    if (showDatePicker) {
        DatePickerDialog(
            onDismissRequest = { showDatePicker = false },
            confirmButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showDatePicker = false }) { Text("Cancel") }
            },
        ) {
            DatePicker(state = dateState)
        }
    }

    if (showTimePicker) {
        AlertDialog(
            onDismissRequest = { showTimePicker = false },
            title = { Text("Pick a time") },
            text = {
                Column(Modifier.fillMaxWidth().padding(top = 8.dp)) {
                    TimePicker(state = timeState)
                }
            },
            confirmButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("OK") }
            },
            dismissButton = {
                TextButton(onClick = { showTimePicker = false }) { Text("Cancel") }
            },
        )
    }
}
