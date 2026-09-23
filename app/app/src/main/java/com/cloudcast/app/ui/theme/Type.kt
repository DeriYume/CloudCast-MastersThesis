package com.cloudcast.app.ui.theme

import androidx.compose.material3.Typography
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp

object AppWeights {
    val Regular = FontWeight(400)
    val Medium = FontWeight(500)
    val Semibold = FontWeight(600)
    val Bold = FontWeight(700)
}

object AppType {
    val display = TextStyle(
        fontFamily = HeadingFamily,
        fontSize = 32.sp,
        fontWeight = FontWeight(700),
        lineHeight = 36.8.sp,
        letterSpacing = -0.64.sp,
    )
    val headline = TextStyle(
        fontFamily = HeadingFamily,
        fontSize = 24.sp,
        fontWeight = FontWeight(700),
        lineHeight = 28.8.sp,
        letterSpacing = -0.48.sp,
    )
    val title = TextStyle(
        fontFamily = HeadingFamily,
        fontSize = 20.sp,
        fontWeight = FontWeight(700),
        lineHeight = 25.0.sp,
        letterSpacing = -0.40.sp,
    )
    val subtitle = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 16.sp,
        fontWeight = FontWeight(600),
        lineHeight = 22.4.sp,
        letterSpacing = 0.00.sp,
    )
    val body = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 14.sp,
        fontWeight = FontWeight(400),
        lineHeight = 21.0.sp,
        letterSpacing = 0.00.sp,
    )
    val bodySmall = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 13.sp,
        fontWeight = FontWeight(400),
        lineHeight = 18.8.sp,
        letterSpacing = 0.00.sp,
    )
    val label = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 12.sp,
        fontWeight = FontWeight(500),
        lineHeight = 16.2.sp,
        letterSpacing = 0.00.sp,
    )
    val caption = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 11.sp,
        fontWeight = FontWeight(600),
        lineHeight = 14.3.sp,
        letterSpacing = 0.11.sp,
    )
    val button = TextStyle(
        fontFamily = BodyFamily,
        fontSize = 14.sp,
        fontWeight = FontWeight(600),
        lineHeight = 16.8.sp,
        letterSpacing = 0.00.sp,
    )
    val mono = TextStyle(
        fontFamily = MonoFamily,
        fontSize = 11.sp,
        fontWeight = FontWeight(600),
        lineHeight = 14.3.sp,
        letterSpacing = 0.11.sp,
    )
}

val AppTypography = Typography(
    displayLarge = AppType.display,
    displayMedium = AppType.headline,
    displaySmall = AppType.title,
    headlineLarge = AppType.headline,
    headlineMedium = AppType.title,
    headlineSmall = AppType.subtitle,
    titleLarge = AppType.title,
    titleMedium = AppType.subtitle,
    titleSmall = AppType.body,
    bodyLarge = AppType.body,
    bodyMedium = AppType.body,
    bodySmall = AppType.bodySmall,
    labelLarge = AppType.button,
    labelMedium = AppType.label,
    labelSmall = AppType.caption,
)
