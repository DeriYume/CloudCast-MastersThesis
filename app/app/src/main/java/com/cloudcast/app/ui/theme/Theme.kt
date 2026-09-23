package com.cloudcast.app.ui.theme

import android.app.Activity
import androidx.compose.foundation.isSystemInDarkTheme
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.darkColorScheme
import androidx.compose.material3.lightColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.SideEffect
import androidx.compose.ui.graphics.luminance
import androidx.compose.ui.platform.LocalView
import androidx.compose.ui.unit.dp
import androidx.core.view.WindowCompat

enum class ThemeMode(val key: String) {
    LIGHT("light"),
    DARK("dark"),
    SYSTEM("system");

    companion object {

        fun fromKey(key: String?): ThemeMode =
            entries.firstOrNull { it.key == key } ?: LIGHT
    }
}

private val LightColors = lightColorScheme(
    primary = Purple,
    onPrimary = White,
    primaryContainer = PrimaryContainerLight,
    onPrimaryContainer = Purple,
    secondary = MutedText,
    onSecondary = White,
    background = Lavender,
    onBackground = DarkPlum,
    surface = SurfaceWhite,
    onSurface = DarkPlum,
    surfaceVariant = Lavender,
    onSurfaceVariant = MutedText,
    outline = OutlineLight,
    outlineVariant = OutlineLight,
    secondaryContainer = SelectionBarBg,
    onSecondaryContainer = DarkPlum,
)

private val DarkColors = darkColorScheme(
    primary = Purple,
    onPrimary = White,
    primaryContainer = PrimaryContainerDark,
    onPrimaryContainer = AccentOnDark,
    secondary = DarkSecondaryText,
    onSecondary = DarkBackground,
    background = DarkBackground,
    onBackground = DarkOnSurface,
    surface = DarkSurface,
    onSurface = DarkOnSurface,
    surfaceVariant = DarkSurface,
    onSurfaceVariant = DarkSecondaryText,
    outline = OutlineDark,
    outlineVariant = OutlineDark,
    secondaryContainer = PrimaryContainerDark,
    onSecondaryContainer = DarkOnSurface,
)

private val AppShapes = Shapes(
    extraSmall = RoundedCornerShape(7.dp),
    small = RoundedCornerShape(8.dp),
    medium = RoundedCornerShape(10.dp),
    large = RoundedCornerShape(12.dp),
    extraLarge = RoundedCornerShape(16.dp),
)

@Composable
fun CloudCastTheme(

    themeMode: ThemeMode = ThemeMode.LIGHT,
    content: @Composable () -> Unit,
) {
    val dark = when (themeMode) {
        ThemeMode.LIGHT -> false
        ThemeMode.DARK -> true
        ThemeMode.SYSTEM -> isSystemInDarkTheme()
    }

    val view = LocalView.current
    if (!view.isInEditMode) {
        SideEffect {
            val window = (view.context as Activity).window
            val controller = WindowCompat.getInsetsController(window, view)
            controller.isAppearanceLightStatusBars = !dark
            controller.isAppearanceLightNavigationBars = !dark
        }
    }
    MaterialTheme(
        colorScheme = if (dark) DarkColors else LightColors,
        shapes = AppShapes,
        typography = AppTypography,
        content = content,
    )
}

@Composable
fun isAppInDarkTheme(): Boolean =
    MaterialTheme.colorScheme.background.luminance() < 0.5f
