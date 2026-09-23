package com.cloudcast.app.ui.common

import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp

@Composable
fun ErrorText(
    message: String,
    modifier: Modifier = Modifier,
    textAlign: TextAlign? = TextAlign.Center,
) {
    Text(
        message,
        color = MaterialTheme.colorScheme.error,
        textAlign = textAlign,
        modifier = modifier
            .fillMaxWidth()
            .padding(horizontal = 24.dp, vertical = 8.dp),
    )
}
