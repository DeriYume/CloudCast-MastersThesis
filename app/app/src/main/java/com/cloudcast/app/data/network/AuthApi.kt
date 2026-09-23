package com.cloudcast.app.data.network

interface AuthApi {
    suspend fun register(body: RegisterRequest): RegisterResult
    suspend fun srpChallenge(body: SrpChallengeRequest): SrpChallengeResponse
    suspend fun srpAuthenticate(body: SrpAuthenticateRequest): SrpAuthenticateResponse
    suspend fun recoverChallenge(body: RecoverChallengeRequest): RecoverChallengeResponse
    suspend fun recoverSubmit(body: RecoverRequest): RecoverResult
    suspend fun changePassword(body: ChangePasswordRequestV2): ChangePasswordResult
    suspend fun changeEmail(body: ChangeEmailRequestV2): ChangeEmailResult
    suspend fun regenerateRecovery(body: RegenerateRecoveryRequest): RegenerateRecoveryResult
}

class RetrofitAuthApi(private val api: ApiService) : AuthApi {
    override suspend fun register(body: RegisterRequest) = api.register(body)
    override suspend fun srpChallenge(body: SrpChallengeRequest) = api.srpChallenge(body)
    override suspend fun srpAuthenticate(body: SrpAuthenticateRequest) = api.srpAuthenticate(body)
    override suspend fun recoverChallenge(body: RecoverChallengeRequest) = api.recoverChallenge(body)
    override suspend fun recoverSubmit(body: RecoverRequest) = api.recoverSubmit(body)
    override suspend fun changePassword(body: ChangePasswordRequestV2) = api.changePassword(body)
    override suspend fun changeEmail(body: ChangeEmailRequestV2) = api.changeEmail(body)
    override suspend fun regenerateRecovery(body: RegenerateRecoveryRequest) = api.regenerateRecovery(body)
}
