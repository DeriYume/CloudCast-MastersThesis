package com.cloudcast.app.ui.auth

enum class AuthMode { LOGIN, REGISTER, RECOVER }

data class AuthUiState(
    val mode: AuthMode = AuthMode.LOGIN,
    val email: String = "",
    val password: String = "",
    val confirm: String = "",
    val loading: Boolean = false,
    val error: String? = null,

    val recoveryCode: String? = null,

    val recoveryInput: String = "",

    val recoverySucceeded: Boolean = false,
)
