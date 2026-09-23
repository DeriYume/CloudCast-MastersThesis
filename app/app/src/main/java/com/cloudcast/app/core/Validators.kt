package com.cloudcast.app.core

val EMAIL_REGEX = Regex("^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\\.[A-Za-z]{2,}$")

data class PasswordRule(val label: String, val test: (String) -> Boolean)

val PASSWORD_RULES = listOf(
    PasswordRule("At least 8 characters") { it.length >= 8 },
    PasswordRule("An uppercase letter") { p -> p.any { it.isUpperCase() } },
    PasswordRule("A lowercase letter") { p -> p.any { it.isLowerCase() } },
    PasswordRule("A digit") { p -> p.any { it.isDigit() } },
    PasswordRule("A special character") { p -> p.any { !it.isLetterOrDigit() } },
)

fun emailIsValid(email: String): Boolean = EMAIL_REGEX.matches(email.trim())

fun displayNameFromEmail(email: String?): String {
    if (email.isNullOrBlank()) return "User"
    return email.substringBefore("@").ifBlank { email }
}

fun passwordIsValid(password: String): Boolean = PASSWORD_RULES.all { it.test(password) }
