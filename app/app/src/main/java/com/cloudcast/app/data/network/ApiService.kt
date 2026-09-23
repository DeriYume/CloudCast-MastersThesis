package com.cloudcast.app.data.network

import okhttp3.MultipartBody
import okhttp3.RequestBody
import okhttp3.ResponseBody
import retrofit2.http.Body
import retrofit2.http.DELETE
import retrofit2.http.GET
import retrofit2.http.Multipart
import retrofit2.http.PATCH
import retrofit2.http.POST
import retrofit2.http.PUT
import retrofit2.http.Part
import retrofit2.http.Path
import retrofit2.http.Query
import retrofit2.http.Streaming

interface ApiService {

    @POST("auth/register")
    suspend fun register(@Body body: RegisterRequest): RegisterResult

    @POST("auth/srp/challenge")
    suspend fun srpChallenge(@Body body: SrpChallengeRequest): SrpChallengeResponse

    @POST("auth/srp/authenticate")
    suspend fun srpAuthenticate(@Body body: SrpAuthenticateRequest): SrpAuthenticateResponse

    @POST("auth/recover/challenge")
    suspend fun recoverChallenge(@Body body: RecoverChallengeRequest): RecoverChallengeResponse

    @POST("auth/recover")
    suspend fun recoverSubmit(@Body body: RecoverRequest): RecoverResult

    @DELETE("auth/account")
    suspend fun deleteAccount(): DeleteAccountResult

    @POST("auth/account/restore")
    suspend fun restoreAccount(): RestoreAccountResult

    @POST("auth/logout")
    suspend fun logout(): LogoutResponse

    @GET("auth/me")
    suspend fun me(): MeResponse

    @POST("auth/change-password")
    suspend fun changePassword(@Body body: ChangePasswordRequestV2): ChangePasswordResult

    @POST("auth/change-email")
    suspend fun changeEmail(@Body body: ChangeEmailRequestV2): ChangeEmailResult

    @POST("auth/recovery/regenerate")
    suspend fun regenerateRecovery(@Body body: RegenerateRecoveryRequest): RegenerateRecoveryResult

    @POST("auth/qr/offer")
    suspend fun qrOffer(): QrOfferResponse

    @POST("auth/qr/register")
    suspend fun qrRegister(@Body body: QrRegisterRequest): QrRegisterResponse

    @GET("auth/qr/pending")
    suspend fun qrPending(@Query("code") code: String): QrPendingResponse

    @POST("auth/qr/approve")
    suspend fun approveLogin(@Body body: ApproveLoginRequest): ApproveLoginResponse

    @GET("auth/qr/poll")
    suspend fun qrPoll(@Query("code") code: String): QrPollResponse

    @GET("files/folders")
    suspend fun listFolders(): FoldersResponse

    @POST("files/folders")
    suspend fun createFolder(@Body body: CreateFolderRequestV2): FolderResponse

    @PATCH("files/folders/{id}")
    suspend fun patchFolder(@Path("id") id: String, @Body body: RequestBody): FolderResponse

    @DELETE("files/folders/{id}")
    suspend fun deleteFolder(@Path("id") id: String): DeleteResult

    @GET("files/folders/{id}")
    suspend fun getFolder(@Path("id") id: String): FolderResponse

    @GET("files/folders/{id}/files")
    suspend fun listFolderFiles(@Path("id") id: String): FilesResponse

    @GET("files/folders/{id}/subfolders")
    suspend fun listSubfolders(@Path("id") id: String): FoldersResponse

    @GET("files/")
    suspend fun listFiles(
        @Query("folder") folder: String? = null,

        @Query("all") all: String? = null,
    ): FilesResponse

    @GET("files/prefs/{kind}")
    suspend fun getPrefsBlob(@Path("kind") kind: String): PrefsBlobResponse

    @PUT("files/prefs/{kind}")
    suspend fun putPrefsBlob(
        @Path("kind") kind: String,
        @Body body: PrefsBlobRequest,
    ): PrefsRevisionResponse

    @GET("files/{id}")
    suspend fun getFile(@Path("id") id: String): FileResponse

    @Multipart
    @POST("files/")
    suspend fun uploadFile(
        @Part file: MultipartBody.Part,
        @Part("meta_enc") metaEnc: RequestBody,
        @Part("wrapped_dek") wrappedDek: RequestBody,
        @Part("size_bytes") sizeBytes: RequestBody,
        @Part("folder_id") folderId: RequestBody? = null,
    ): FileResponse

    @PATCH("files/{id}")
    suspend fun patchFile(@Path("id") id: String, @Body body: RequestBody): FileResponse

    @DELETE("files/{id}")
    suspend fun deleteFile(@Path("id") id: String): DeleteResult

    @POST("files/{id}/save")
    suspend fun saveSharedFile(@Path("id") id: String, @Body body: SaveSharedRequestV2): FileResponse

    @GET("files/ai/server-key")
    suspend fun aiServerKey(): ServerKeyResponse

    @GET("files/ai/config")
    suspend fun aiConfig(): AiConfigResponse

    @PUT("files/ai/preferences")
    suspend fun updateAiPreferences(@Body body: AiPreferences): OkResponse

    @POST("files/{id}/analyze")
    suspend fun analyze(@Path("id") id: String, @Body body: AiGrantRequest): AnalyzeSealedResponse

    @POST("files/{id}/classify")
    suspend fun classify(@Path("id") id: String, @Body body: AiGrantRequest): ClassifySealedResponse

    @POST("files/{id}/embed")
    suspend fun embedFile(@Path("id") id: String, @Body body: AiGrantRequest): OkResponse

    @POST("files/{id}/keywords")
    suspend fun extractKeywords(
        @Path("id") id: String,
        @Body body: AiGrantRequest,
    ): ExtractKeywordsResponse

    @GET("files/ai/keywords")
    suspend fun keywords(): KeywordsResponse

    @POST("files/{id}/filing")
    suspend fun suggestFiling(@Path("id") id: String, @Body body: AiGrantRequest): FilingResponse

    @Streaming
    @GET("files/{id}/content")
    suspend fun previewContent(
        @Path("id") id: String,
        @Query("disposition") disposition: String = "inline",
    ): ResponseBody

    @GET("files/shares")
    suspend fun listShares(
        @Query("file_id") fileId: String?,
        @Query("folder_id") folderId: String?,
    ): SharesResponseV2

    @POST("files/shares")
    suspend fun createShare(@Body body: CreateShareRequestV2): ShareResponseV2

    @PATCH("files/shares/{shareId}")
    suspend fun updateShare(
        @Path("shareId") shareId: String,
        @Body body: UpdateShareRequest,
    ): ShareResponseV2

    @DELETE("files/shares/{shareId}")
    suspend fun deleteShare(@Path("shareId") shareId: String): DeleteResponse

    @POST("files/unshare")
    suspend fun unshareAll(@Body body: UnshareRequest): UnsharedResponse

    @POST("files/leave")
    suspend fun leaveShare(@Body body: LeaveShareRequest): LeftResponse

    @POST("files/share-expiry")
    suspend fun setShareExpiry(@Body body: ShareExpiryRequest): UpdatedResponse

    @GET("files/contacts")
    suspend fun contacts(): ContactsResponse

    @GET("files/shared-with-me")
    suspend fun sharedWithMe(): SharedWithMeResponse

    @GET("files/shared-by-me")
    suspend fun sharedByMe(): SharedByMeResponse

    @GET("files/expiring")
    suspend fun expiring(): ExpiringResponse

    @GET("files/notifications")
    suspend fun notifications(): NotificationsResponse

    @DELETE("files/notifications/{id}")
    suspend fun deleteNotification(@Path("id") id: String): DeleteResponse

    @DELETE("files/notifications")
    suspend fun clearNotifications(): DeleteResponse

    @POST("files/ai/embed-query")
    suspend fun embedQuery(@Body body: EmbedQueryRequest): EmbedQueryResponse

    @GET("files/ai/embeddings")
    suspend fun embeddings(): EmbeddingsResponse

    @GET("auth/users/search")
    suspend fun searchUsers(@Query("q") q: String): UserSearchResponseV2
}
