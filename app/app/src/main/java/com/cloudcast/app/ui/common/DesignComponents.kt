package com.cloudcast.app.ui.common

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.text.font.FontFamily
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.res.painterResource
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.cloudcast.app.R
import com.cloudcast.app.ui.theme.ExpiryOrange
import com.cloudcast.app.ui.theme.ExpiryOrangeBg
import com.cloudcast.app.ui.theme.ExpiryOrangeBgDark
import com.cloudcast.app.ui.theme.FavoriteAmber
import com.cloudcast.app.ui.theme.AppIcons
import com.cloudcast.app.ui.theme.isAppInDarkTheme

@Composable
fun CardCell(
    modifier: Modifier = Modifier,
    content: @Composable () -> Unit,
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.surface,
        border = androidx.compose.foundation.BorderStroke(1.dp, MaterialTheme.colorScheme.outline),
        modifier = modifier,
    ) { content() }
}

@Composable
fun TypeTile(
    icon: String,
    modifier: Modifier = Modifier,
    size: Int = 40,
) {
    Surface(
        shape = RoundedCornerShape(8.dp),
        color = MaterialTheme.colorScheme.primaryContainer,
        modifier = modifier.size(size.dp),
    ) {
        Box(contentAlignment = Alignment.Center) {
            MaterialSymbol(icon, size = (size * 0.52f).toInt(), tint = MaterialTheme.colorScheme.primary)
        }
    }
}

@Composable
fun MetaText(text: String, modifier: Modifier = Modifier) {
    Text(
        text = text,
        fontFamily = FontFamily.Monospace,
        fontSize = 11.sp,
        fontWeight = FontWeight.Medium,
        letterSpacing = 0.2.sp,
        color = MaterialTheme.colorScheme.onSurfaceVariant,
        modifier = modifier,
    )
}

@Composable
fun SectionLabel(label: String, count: Int? = null, modifier: Modifier = Modifier) {
    Row(
        verticalAlignment = Alignment.CenterVertically,
        modifier = modifier.padding(start = 16.dp, end = 16.dp, top = 14.dp, bottom = 6.dp),
    ) {
        Text(
            text = label.uppercase(),
            fontFamily = FontFamily.Monospace,
            fontSize = 11.sp,
            fontWeight = FontWeight.SemiBold,
            letterSpacing = 1.6.sp,
            color = MaterialTheme.colorScheme.onSurfaceVariant,
        )
        if (count != null) {
            Spacer(Modifier.width(8.dp))
            Surface(
                shape = RoundedCornerShape(7.dp),
                color = MaterialTheme.colorScheme.surfaceVariant,
            ) {
                Text(
                    text = count.toString(),
                    fontFamily = FontFamily.Monospace,
                    fontSize = 10.sp,
                    fontWeight = FontWeight.SemiBold,
                    color = MaterialTheme.colorScheme.onSurfaceVariant,
                    modifier = Modifier.padding(horizontal = 7.dp, vertical = 1.dp),
                )
            }
        }
    }
}

private enum class ChipTone { VIOLET, EXPIRY, OUTLINE }

@Composable
private fun MetaChip(
    label: String,
    icon: String?,
    tone: ChipTone,
    modifier: Modifier = Modifier,
) {
    val dark = isAppInDarkTheme()
    val (bg, fg) = when (tone) {
        ChipTone.VIOLET -> MaterialTheme.colorScheme.primaryContainer to MaterialTheme.colorScheme.onPrimaryContainer
        ChipTone.EXPIRY -> (if (dark) ExpiryOrangeBgDark else ExpiryOrangeBg) to ExpiryOrange
        ChipTone.OUTLINE -> MaterialTheme.colorScheme.surfaceVariant to MaterialTheme.colorScheme.onSurfaceVariant
    }
    Surface(
        shape = RoundedCornerShape(7.dp),
        color = bg,
        modifier = modifier,
    ) {
        Row(
            verticalAlignment = Alignment.CenterVertically,
            horizontalArrangement = Arrangement.spacedBy(3.dp),
            modifier = Modifier.padding(horizontal = 7.dp, vertical = 1.dp),
        ) {
            if (icon != null) {
                MaterialSymbol(icon, size = 12, tint = fg)
            }
            if (label.isNotEmpty()) {
                Text(label, color = fg, fontSize = 10.5.sp, fontWeight = FontWeight.Medium)
            }
        }
    }
}

@Composable
fun ShareChip(label: String, modifier: Modifier = Modifier) =
    MetaChip(label = label, icon = AppIcons.group, tone = ChipTone.VIOLET, modifier = modifier)

@Composable
fun LocationChip(label: String, modifier: Modifier = Modifier) =
    MetaChip(label = label, icon = AppIcons.folder, tone = ChipTone.OUTLINE, modifier = modifier)

@Composable
fun AuthorChip(label: String, modifier: Modifier = Modifier) =
    MetaChip(label = label, icon = AppIcons.person, tone = ChipTone.VIOLET, modifier = modifier)

@Composable
fun ExpiryChip(label: String, modifier: Modifier = Modifier) =
    MetaChip(label = label, icon = AppIcons.schedule, tone = ChipTone.EXPIRY, modifier = modifier)

@Composable
fun FavoriteToggle(
    isFavorite: Boolean,
    onToggle: () -> Unit,
    modifier: Modifier = Modifier,
) {
    IconButton(onClick = onToggle, modifier = modifier.size(36.dp)) {
        MaterialSymbol(
            name = AppIcons.star,
            fill = isFavorite,
            size = 20,
            tint = if (isFavorite) FavoriteAmber else MaterialTheme.colorScheme.onSurfaceVariant,
            contentDescription = if (isFavorite) "Remove from favourites" else "Add to favourites",
        )
    }
}

@Composable
fun LogoMark(boxSize: Int = 58, modifier: Modifier = Modifier) {
    Icon(
        painter = painterResource(R.drawable.logo_mark),
        contentDescription = "CloudCast",
        tint = MaterialTheme.colorScheme.primary,
        modifier = modifier.size(boxSize.dp),
    )
}

@Composable
fun PrimaryUploadButton(onClick: () -> Unit, modifier: Modifier = Modifier, enabled: Boolean = true) {
    Button(
        onClick = onClick,
        enabled = enabled,
        shape = RoundedCornerShape(12.dp),
        modifier = modifier,
    ) {
        MaterialSymbol(AppIcons.add, size = 18)
        Spacer(Modifier.width(8.dp))
        Text("Upload a file", fontWeight = FontWeight.SemiBold)
    }
}
