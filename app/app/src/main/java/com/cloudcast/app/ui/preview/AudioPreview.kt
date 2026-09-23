package com.cloudcast.app.ui.preview

import android.net.Uri
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Slider
import androidx.compose.material3.SliderDefaults
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.DisposableEffect
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TileMode
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.media3.common.MediaItem
import androidx.media3.common.Player
import androidx.media3.exoplayer.ExoPlayer
import com.cloudcast.app.core.formatDurationMs
import com.cloudcast.app.ui.common.MaterialSymbol
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.SuccessGreen
import kotlinx.coroutines.delay
import java.io.File

@Composable
private fun diagonalStripeBrush(base: Color): Brush {
    val stripeWidthPx = with(LocalDensity.current) { 22.dp.toPx() }
    val stripe = base.copy(alpha = base.alpha * 0.6f)
    return remember(base, stripeWidthPx) {
        Brush.linearGradient(
            colorStops = arrayOf(0f to base, 0.5f to base, 0.5f to stripe, 1f to stripe),
            start = Offset.Zero,
            end = Offset(stripeWidthPx, stripeWidthPx),
            tileMode = TileMode.Repeated,
        )
    }
}

@Composable
fun AudioPreview(
    file: File,
    modifier: Modifier = Modifier,
) {
    val context = LocalContext.current

    val player = remember(file.path) {
        ExoPlayer.Builder(context).build().apply {
            setMediaItem(MediaItem.fromUri(Uri.fromFile(file)))
            prepare()
            playWhenReady = false
        }
    }

    DisposableEffect(player) {
        onDispose { player.release() }
    }

    var isPlaying by remember { mutableStateOf(false) }
    var hasEnded by remember { mutableStateOf(false) }

    var volume by remember { mutableStateOf(1f) }
    var preMuteVolume by remember { mutableStateOf(1f) }
    var positionMs by remember { mutableStateOf(0L) }
    var durationMs by remember { mutableStateOf(0L) }

    var seekPreviewMs by remember { mutableStateOf<Long?>(null) }

    DisposableEffect(player) {
        val listener = object : Player.Listener {
            override fun onIsPlayingChanged(playing: Boolean) {
                isPlaying = playing
            }

            override fun onPlaybackStateChanged(state: Int) {
                hasEnded = state == Player.STATE_ENDED
            }
        }
        player.addListener(listener)
        onDispose { player.removeListener(listener) }
    }

    LaunchedEffect(player, volume) {
        player.volume = volume
    }

    LaunchedEffect(player) {
        while (true) {
            if (seekPreviewMs == null) {
                positionMs = player.currentPosition.coerceAtLeast(0L)
                durationMs = player.duration.coerceAtLeast(0L)
            }
            delay(200)
        }
    }

    Box(
        modifier = modifier
            .fillMaxSize()
            .background(diagonalStripeBrush(MaterialTheme.colorScheme.primaryContainer)),
        contentAlignment = Alignment.Center,
    ) {
        Column(
            modifier = Modifier
                .fillMaxWidth()
                .widthIn(max = 420.dp)
                .padding(horizontal = 24.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(20.dp),
        ) {
            Surface(
                shape = RoundedCornerShape(16.dp),
                color = MaterialTheme.colorScheme.surface,
                modifier = Modifier
                    .align(Alignment.CenterHorizontally)
                    .size(72.dp),
            ) {
                Box(contentAlignment = Alignment.Center) {
                    MaterialSymbol(
                        AppIcons.musicNote,
                        size = 34,
                        tint = SuccessGreen,
                    )
                }
            }

            Column(modifier = Modifier.fillMaxWidth()) {
                val durationForSlider = durationMs.coerceAtLeast(1L)
                val shownPositionMs = seekPreviewMs ?: positionMs
                Slider(
                    value = (shownPositionMs.toFloat() / durationForSlider.toFloat()).coerceIn(0f, 1f),
                    onValueChange = { fraction -> seekPreviewMs = (fraction * durationForSlider).toLong() },
                    onValueChangeFinished = {
                        seekPreviewMs?.let { player.seekTo(it) }
                        seekPreviewMs = null
                    },
                    colors = SliderDefaults.colors(
                        thumbColor = SuccessGreen,
                        activeTrackColor = SuccessGreen,
                        inactiveTrackColor = MaterialTheme.colorScheme.primary.copy(alpha = 0.35f),
                    ),
                    modifier = Modifier.fillMaxWidth(),
                )
                Row(
                    modifier = Modifier
                        .fillMaxWidth()
                        .padding(horizontal = 4.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    Text(
                        formatDurationMs(shownPositionMs),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )

                    Row(
                        modifier = Modifier.weight(1f),
                        horizontalArrangement = Arrangement.Center,
                        verticalAlignment = Alignment.CenterVertically,
                    ) {
                        IconButton(
                            onClick = {
                                when {
                                    hasEnded -> {
                                        player.seekTo(0)
                                        player.play()
                                    }
                                    isPlaying -> player.pause()
                                    else -> player.play()
                                }
                            },
                            modifier = Modifier.size(44.dp),
                        ) {
                            MaterialSymbol(
                                name = when {
                                    hasEnded -> AppIcons.replay
                                    isPlaying -> AppIcons.pause
                                    else -> AppIcons.playArrow
                                },
                                size = 28,
                                contentDescription = when {
                                    hasEnded -> "Replay"
                                    isPlaying -> "Pause"
                                    else -> "Play"
                                },
                                tint = MaterialTheme.colorScheme.onSurface,
                            )
                        }

                        val isMuted = volume == 0f
                        IconButton(
                            onClick = {
                                if (volume > 0f) {
                                    preMuteVolume = volume
                                    volume = 0f
                                } else {
                                    volume = preMuteVolume.takeIf { it > 0f } ?: 1f
                                }
                            },
                            modifier = Modifier.size(44.dp),
                        ) {
                            MaterialSymbol(
                                if (isMuted) AppIcons.volumeOff else AppIcons.volumeUp,
                                size = 24,
                                contentDescription = if (isMuted) "Unmute" else "Mute",
                                tint = MaterialTheme.colorScheme.onSurfaceVariant,
                            )
                        }
                    }

                    Text(
                        formatDurationMs(durationMs),
                        fontFamily = FontFamily.Monospace,
                        fontSize = 12.sp,
                        color = MaterialTheme.colorScheme.onSurfaceVariant,
                    )
                }
            }
        }
    }
}
