package com.cloudcast.app.di

import android.content.Context
import com.cloudcast.app.BuildConfig
import com.cloudcast.app.core.ApiConfig
import com.cloudcast.app.data.repository.AuthRepository
import com.cloudcast.app.data.repository.FavoritesStore
import com.cloudcast.app.data.repository.FileRepository
import com.cloudcast.app.data.repository.FolderRepository
import com.cloudcast.app.data.repository.ShareRepository
import com.cloudcast.app.data.SessionPersistence
import com.cloudcast.app.data.SettingsStore
import com.cloudcast.app.data.TokenStore
import com.cloudcast.app.data.network.ApiService
import com.cloudcast.app.data.network.EventStream
import com.cloudcast.app.data.network.AuthInterceptor
import com.google.gson.GsonBuilder
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.asSharedFlow
import okhttp3.OkHttpClient
import okhttp3.logging.HttpLoggingInterceptor
import retrofit2.Retrofit
import retrofit2.converter.gson.GsonConverterFactory
import java.util.concurrent.TimeUnit

class ServiceLocator(context: Context) {

    val tokenStore = TokenStore(context.applicationContext)
    val settingsStore = SettingsStore(context.applicationContext)

    private val logging = HttpLoggingInterceptor().apply {
        level = if (BuildConfig.DEBUG) HttpLoggingInterceptor.Level.BASIC
                else HttpLoggingInterceptor.Level.NONE
    }

    private val _sessionExpired = MutableSharedFlow<Unit>(replay = 0, extraBufferCapacity = 1)
    val sessionExpired: SharedFlow<Unit> = _sessionExpired.asSharedFlow()

    private val okHttp = OkHttpClient.Builder()
        .addInterceptor(AuthInterceptor(tokenStore) { _sessionExpired.tryEmit(Unit) })
        .addInterceptor(logging)

        .connectTimeout(20, TimeUnit.SECONDS)
        .readTimeout(120, TimeUnit.SECONDS)
        .writeTimeout(60, TimeUnit.SECONDS)
        .build()

    private val retrofit = Retrofit.Builder()
        .baseUrl(ApiConfig.BASE_URL)
        .client(okHttp)
        .addConverterFactory(GsonConverterFactory.create(GsonBuilder().create()))
        .build()

    val api: ApiService = retrofit.create(ApiService::class.java)

    val sessionPersistence = SessionPersistence(context.applicationContext, tokenStore, settingsStore)

    val authRepository = AuthRepository(api, tokenStore, sessionPersistence, ::clearCaches)
    val folderRepository = FolderRepository(api)

    val shareRepository = ShareRepository(api, tokenStore)

    val favoritesStore = FavoritesStore(api)

    val fileRepository = FileRepository(api, context.applicationContext, favoritesStore)

    val eventStream = EventStream(tokenStore)

    private fun clearCaches() {
        favoritesStore.clear()
        fileRepository.clearAiCaches()
    }
}
