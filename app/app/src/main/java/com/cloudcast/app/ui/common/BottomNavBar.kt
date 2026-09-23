package com.cloudcast.app.ui.common

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.semantics.Role
import com.cloudcast.app.ui.theme.AppIcons
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

enum class BottomTab { FILES, FAVOURITES, SHARED, EXPIRING }

@Composable
fun BottomNavBar(
    selected: BottomTab,
    onSelect: (BottomTab) -> Unit,
    modifier: Modifier = Modifier,
) {
    Surface(
        color = MaterialTheme.colorScheme.surface,
        modifier = modifier.fillMaxWidth(),
    ) {
        Box {

            Box(
                Modifier
                    .fillMaxWidth()
                    .height(1.dp)
                    .background(MaterialTheme.colorScheme.outline),
            )
            Row(
                modifier = Modifier
                    .fillMaxWidth()

                    .navigationBarsPadding()
                    .height(64.dp)
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                NavTab(
                    icon = AppIcons.cloud,
                    label = "Files",
                    active = selected == BottomTab.FILES,
                    modifier = Modifier.weight(1f),
                    onClick = { onSelect(BottomTab.FILES) },
                )
                NavTab(
                    icon = AppIcons.star,
                    label = "Favourites",
                    active = selected == BottomTab.FAVOURITES,
                    modifier = Modifier.weight(1f),
                    onClick = { onSelect(BottomTab.FAVOURITES) },
                )
                NavTab(
                    icon = AppIcons.group,
                    label = "Shared",
                    active = selected == BottomTab.SHARED,
                    modifier = Modifier.weight(1f),
                    onClick = { onSelect(BottomTab.SHARED) },
                )
                NavTab(
                    icon = AppIcons.schedule,
                    label = "Expiring",
                    active = selected == BottomTab.EXPIRING,
                    modifier = Modifier.weight(1f),
                    onClick = { onSelect(BottomTab.EXPIRING) },
                )
            }
        }
    }
}

@Composable
private fun NavTab(
    icon: String,
    label: String,
    active: Boolean,
    onClick: () -> Unit,
    modifier: Modifier = Modifier,
) {
    val tint = if (active) MaterialTheme.colorScheme.primary
    else MaterialTheme.colorScheme.onSurfaceVariant
    Column(
        modifier = modifier
            .clickable(role = Role.Tab, onClick = onClick)
            .padding(vertical = 6.dp),
        horizontalAlignment = Alignment.CenterHorizontally,
        verticalArrangement = Arrangement.Center,
    ) {
        MaterialSymbol(icon, size = 23, tint = tint, contentDescription = label)
        Spacer(Modifier.height(3.dp))
        Text(
            label,
            color = tint,
            fontSize = 9.5.sp,
            fontWeight = if (active) FontWeight.SemiBold else FontWeight.Medium,
        )
    }
}
