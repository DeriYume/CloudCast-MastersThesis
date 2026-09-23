package com.cloudcast.app.data.network

data class ServerKeyResponse(val public_key: String)

data class AiConfigResponse(
    val ai: Boolean = false,
    val semantic: Boolean = false,
    val preferences: AiPreferences = AiPreferences(),
)

data class AiPreferences(

    val auto_file_mode: String = "off",

    val analysis: Boolean = false,

    val semantic_search: Boolean = false,
)

data class AiGrantRequest(val wrapped_dek_for_server: String)

data class AnalyzeSealedResponse(val summary_sealed: String)

data class ClassifySealedResponse(val category_sealed: String)

data class OkResponse(val ok: Boolean = false)

data class KeywordsDto(
    val file_id: String,
    val keywords_enc: String? = null,
)

data class KeywordsResponse(val keywords: List<KeywordsDto> = emptyList())

data class ExtractKeywordsResponse(
    val ok: Boolean = false,
    val count: Int = 0,
    val skipped: String? = null,
)

data class FilingResponse(
    val embedding_enc: String,
    val suggested_name_enc: String,
)
