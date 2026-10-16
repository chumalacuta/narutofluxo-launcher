const crypto = require('crypto')

const REDIRECT_URI = 'https://login.microsoftonline.com/common/oauth2/nativeclient'

function createMicrosoftLogin(clientId) {
    const state = crypto.randomBytes(32).toString('hex')
    const url = new URL('https://login.microsoftonline.com/consumers/oauth2/v2.0/authorize')
    url.search = new URLSearchParams({
        prompt: 'select_account', client_id: clientId, response_type: 'code',
        response_mode: 'query', scope: 'XboxLive.signin offline_access',
        redirect_uri: REDIRECT_URI, state
    }).toString()
    return {state, url: url.href}
}

function parseMicrosoftRedirect(uri, expectedState) {
    let url
    try { url = new URL(uri) } catch (_) { return null }
    const redirect = new URL(REDIRECT_URI)
    if (url.origin !== redirect.origin || url.pathname !== redirect.pathname || url.username || url.password) return null
    const params = url.searchParams
    if (params.getAll('state').length !== 1 || !expectedState || params.get('state') !== expectedState) {
        return {error: 'invalid_state', error_description: 'A resposta não corresponde a esta tentativa de login. Feche a janela e tente novamente.'}
    }
    if (params.has('error')) {
        return {error: params.get('error'), error_description: params.get('error_description') || 'A Microsoft não concluiu o login.'}
    }
    if (params.getAll('code').length !== 1 || !params.get('code')) {
        return {error: 'missing_code', error_description: 'A Microsoft não retornou um código de login válido. Tente novamente.'}
    }
    // Decode form query parameters exactly once. decodeURI leaves %2B/%2F/%3D encoded.
    return {code: params.get('code')}
}

function createRedirectReceiver(state, deliver) {
    let completed = false
    return uri => {
        if (completed) return false
        const response = parseMicrosoftRedirect(uri, state)
        if (response === null) return false
        completed = true
        deliver(response)
        return true
    }
}

function describeMicrosoftFailure(response, stage) {
    const error = response?.error
    const body = error?.response?.body
    const http = error?.response?.statusCode
    const code = typeof body?.error === 'string' && /^[a-z_]{1,60}$/.test(body.error) ? body.error : null
    const aad = Array.isArray(body?.error_codes) ? body.error_codes.find(c => Number.isSafeInteger(c) && c > 0) : null
    const detail = [http ? `HTTP ${http}` : null, code, aad ? `AADSTS${aad}` : null].filter(Boolean).join(' / ')
    if (code === 'invalid_grant') return {
        title: 'Código Microsoft recusado',
        desc: `A Microsoft recusou o código desta tentativa${detail ? ` (${detail})` : ''}. Inicie um novo login; códigos antigos não podem ser reutilizados.`
    }
    return {
        title: 'Falha no login Microsoft',
        desc: `Não foi possível concluir a etapa ${stage}${detail ? ` (${detail})` : ''}. Tente novamente. Se continuar, informe esta mensagem ao suporte.`
    }
}

module.exports = {REDIRECT_URI, createMicrosoftLogin, parseMicrosoftRedirect, createRedirectReceiver, describeMicrosoftFailure}
