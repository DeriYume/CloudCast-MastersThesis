package com.cloudcast.app

import android.os.Bundle
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.Surface
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.fragment.app.FragmentActivity
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.withStarted
import com.cloudcast.app.crypto.Session
import com.cloudcast.app.data.SessionPersistence
import com.cloudcast.app.ui.navigation.AppNavigation
import com.cloudcast.app.ui.theme.CloudCastTheme
import kotlinx.coroutines.launch
import kotlinx.coroutines.runBlocking

class MainActivity : FragmentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        enableEdgeToEdge()
        val services = (application as CloudCastApplication).services

        services.sessionPersistence.attach(this)

        val hasToken = runBlocking { services.tokenStore.currentToken() != null }
        val alreadyUnlocked = Session.isUnlocked()

        val initialThemeMode = runBlocking { services.settingsStore.themeMode() }

        var gate by mutableStateOf(
            when {
                alreadyUnlocked && hasToken -> Gate.SignedIn
                !hasToken -> Gate.SignedOut
                else -> Gate.Restoring
            },
        )

        if (gate == Gate.Restoring) {
            lifecycleScope.launch {

                lifecycle.withStarted { }
                val outcome = services.sessionPersistence.restore(this@MainActivity)
                if (outcome != SessionPersistence.Outcome.RESTORED) {

                    services.tokenStore.clearSessionKeepEmail()
                }
                gate = if (outcome == SessionPersistence.Outcome.RESTORED) {
                    Gate.SignedIn
                } else {
                    Gate.SignedOut
                }
            }
        }

        setContent {
            val themeMode by services.settingsStore.themeModeFlow
                .collectAsState(initial = initialThemeMode)
            CloudCastTheme(themeMode = themeMode) {

                Surface(
                    modifier = Modifier.fillMaxSize(),
                    color = MaterialTheme.colorScheme.background,
                ) {
                    if (gate == Gate.Restoring) {
                        Box(Modifier.fillMaxSize(), contentAlignment = Alignment.Center) {
                            CircularProgressIndicator()
                        }
                    } else {
                        AppNavigation(
                            authRepository = services.authRepository,
                            folderRepository = services.folderRepository,
                            fileRepository = services.fileRepository,
                            shareRepository = services.shareRepository,
                            settingsStore = services.settingsStore,
                            eventStream = services.eventStream,
                            startLoggedIn = gate == Gate.SignedIn,
                            sessionExpired = services.sessionExpired,
                        )
                    }
                }
            }
        }
    }

    private enum class Gate { Restoring, SignedIn, SignedOut }
}
