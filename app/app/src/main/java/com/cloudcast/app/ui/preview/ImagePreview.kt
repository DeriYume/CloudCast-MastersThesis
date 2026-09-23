package com.cloudcast.app.ui.preview

import androidx.compose.foundation.Image
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.unit.dp

@Composable
fun ImagePreview(
    image: ImageBitmap?,
    onImageClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    if (image != null) {
        val ratio = image.width.toFloat() / image.height.toFloat()

        BoxWithConstraints(
            modifier = modifier.fillMaxSize(),
            contentAlignment = Alignment.Center,
        ) {
            val paneRatio = maxWidth / maxHeight
            val fit = if (ratio >= paneRatio) Modifier.fillMaxWidth() else Modifier.fillMaxHeight()
            Image(
                bitmap = image,
                contentDescription = "Preview",
                contentScale = ContentScale.Fit,
                modifier = fit
                    .aspectRatio(ratio)
                    .clickable(onClick = onImageClick),
            )
        }
    } else {
        CircularProgressIndicator(modifier.padding(16.dp))
    }
}
