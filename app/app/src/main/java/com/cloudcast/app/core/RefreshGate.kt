package com.cloudcast.app.core

const val EVENT_COALESCE_MS = 1_200L

class RefreshGate(private val minIntervalMs: Long = DEFAULT_MIN_INTERVAL_MS) {

    @Volatile
    private var lastReadAtMs: Long = 0L

    fun shouldRefresh(): Boolean =
        System.currentTimeMillis() - lastReadAtMs >= minIntervalMs

    fun mark() {
        lastReadAtMs = System.currentTimeMillis()
    }

    private companion object {

        const val DEFAULT_MIN_INTERVAL_MS = 20_000L
    }
}
