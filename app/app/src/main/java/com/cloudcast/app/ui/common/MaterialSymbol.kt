package com.cloudcast.app.ui.common

import androidx.compose.material3.LocalContentColor
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.text.ExperimentalTextApi
import androidx.compose.ui.text.font.Font
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontVariation
import androidx.compose.ui.unit.sp
import com.cloudcast.app.R

@OptIn(ExperimentalTextApi::class)
@Composable
fun MaterialSymbol(
    name: String,
    size: Int = 20,
    fill: Boolean = false,
    tint: Color = LocalContentColor.current,
    contentDescription: String? = null,
    modifier: Modifier = Modifier,
) {
    val semantics = if (contentDescription != null) {
        Modifier.clearAndSetSemantics { this.contentDescription = contentDescription }
    } else {
        Modifier.clearAndSetSemantics { }
    }
    val family = remember(fill, size) {
        FontFamily(
            Font(
                R.font.material_symbols_rounded,
                variationSettings = FontVariation.Settings(
                    FontVariation.Setting("FILL", if (fill) 1f else 0f),
                    FontVariation.weight(400),
                    FontVariation.Setting("GRAD", 0f),
                    FontVariation.Setting("opsz", size.toFloat()),
                ),
            ),
        )
    }
    Text(
        text = name,
        fontFamily = family,
        fontSize = size.sp,
        color = tint,
        modifier = modifier.then(semantics),
    )
}
