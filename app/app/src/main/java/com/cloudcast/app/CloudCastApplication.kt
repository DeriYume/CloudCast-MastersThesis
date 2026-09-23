package com.cloudcast.app

import android.app.Application
import com.cloudcast.app.crypto.Sodium
import com.cloudcast.app.di.ServiceLocator

class CloudCastApplication : Application() {
    lateinit var services: ServiceLocator
        private set

    override fun onCreate() {
        super.onCreate()

        Sodium.ready()
        services = ServiceLocator(this)
    }
}
