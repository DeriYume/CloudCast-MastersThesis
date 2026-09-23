package com.cloudcast.app.data

import android.content.Context
import androidx.datastore.preferences.core.booleanPreferencesKey
import androidx.datastore.preferences.core.edit
import androidx.datastore.preferences.core.stringPreferencesKey
import androidx.datastore.preferences.preferencesDataStore
import com.cloudcast.app.ui.theme.ThemeMode
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.first
import kotlinx.coroutines.flow.map

private val Context.settingsDataStore by preferencesDataStore(name = "cloudcast_settings")

class SettingsStore(private val context: Context) {

    private val themeModeKey = stringPreferencesKey("theme_mode")

    val themeModeFlow: Flow<ThemeMode> =
        context.settingsDataStore.data.map { prefs ->
            ThemeMode.fromKey(prefs[themeModeKey])
        }

    suspend fun themeMode(): ThemeMode = themeModeFlow.first()

    suspend fun setThemeMode(mode: ThemeMode) {
        context.settingsDataStore.edit { prefs ->
            prefs[themeModeKey] = mode.key
        }
    }

    private val staySignedInKey = booleanPreferencesKey("stay_signed_in")

    val staySignedInFlow: Flow<Boolean> =
        context.settingsDataStore.data.map { it[staySignedInKey] ?: true }

    suspend fun staySignedIn(): Boolean = staySignedInFlow.first()

    suspend fun setStaySignedIn(enabled: Boolean) {
        context.settingsDataStore.edit { it[staySignedInKey] = enabled }
    }
}
