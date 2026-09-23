package com.cloudcast.app.ui.auth

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.text.input.PasswordVisualTransformation
import androidx.compose.ui.text.input.VisualTransformation
import androidx.compose.ui.unit.dp
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons

enum class AuthFieldKind { EMAIL, PASSWORD }

@Composable
fun AuthInput(
    kind: AuthFieldKind,
    label: String,
    value: String,
    onValueChange: (String) -> Unit,
    modifier: Modifier = Modifier,
    isError: Boolean = false,
    helperText: String? = null,
) {
    var show by remember { mutableStateOf(false) }
    val isPassword = kind == AuthFieldKind.PASSWORD

    OutlinedTextField(
        value = value,
        onValueChange = onValueChange,
        label = { Text(label) },
        singleLine = true,
        isError = isError,
        shape = RoundedCornerShape(14.dp),
        supportingText = helperText?.let { { Text(it) } },
        visualTransformation =
            if (isPassword && !show) PasswordVisualTransformation() else VisualTransformation.None,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (isPassword) KeyboardType.Password else KeyboardType.Email,
            autoCorrectEnabled = false,
        ),
        trailingIcon = if (isPassword) {
            {
                IconButton(onClick = { show = !show }) {
                    MaterialSymbol(
                        name = if (show) AppIcons.visibilityOff else AppIcons.visibility,
                        size = 24,
                        contentDescription = if (show) "Hide password" else "Show password",
                    )
                }
            }
        } else null,
        modifier = modifier.fillMaxWidth(),
    )
}
