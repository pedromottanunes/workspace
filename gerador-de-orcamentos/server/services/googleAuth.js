const crypto = require('crypto');
const axios = require('axios');
const { buildGoogleConfig } = require('../../src/lib/google/config');

const GOOGLE_OAUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const DEFAULT_SCOPES = [
  'https://www.googleapis.com/auth/presentations',
  'https://www.googleapis.com/auth/drive'
];

class GoogleAuthService {
  constructor(store) {
    this.store = store;
    this.pendingSessions = new Map();
  }

  async getStoredConfig() {
    const stored = (await this.store.get('googleConfig')) || {};
    return buildGoogleConfig(stored);
  }

  async startSession() {
    const config = await this.getStoredConfig();
    const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    const redirectUri = config.redirectUri || process.env.GOOGLE_REDIRECT_URI;

    if (!clientId || !clientSecret || !redirectUri) {
      throw new Error('Credenciais do Google incompletas. Configure o Client ID, Secret e Redirect URI.');
    }

    const codeVerifier = this.generateCodeVerifier();
    const codeChallenge = this.createCodeChallenge(codeVerifier);
    const state = crypto.randomBytes(16).toString('hex');

    this.pendingSessions.set(state, {
      codeVerifier,
      createdAt: Date.now(),
      clientId,
      clientSecret,
      redirectUri
    });

    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: DEFAULT_SCOPES.join(' '),
      access_type: 'offline',
      prompt: 'consent',
      code_challenge_method: 'S256',
      code_challenge: codeChallenge,
      state
    });

    return {
      authUrl: `${GOOGLE_OAUTH_URL}?${params.toString()}`,
      state
    };
  }

  generateCodeVerifier() {
    return crypto.randomBytes(64).toString('base64url');
  }

  createCodeChallenge(verifier) {
    return crypto.createHash('sha256').update(verifier).digest('base64url');
  }

  async handleCallback(query) {
    const { code, state, error } = query || {};
    if (error) {
      throw new Error(error);
    }

    if (!state || !this.pendingSessions.has(state)) {
      throw new Error('SessÇⁿo de autenticaÇõÇœo invÇ­lida ou expirada.');
    }

    const session = this.pendingSessions.get(state);
    this.pendingSessions.delete(state);

    const tokenData = await this.exchangeCodeForToken({
      code,
      codeVerifier: session.codeVerifier,
      clientId: session.clientId,
      clientSecret: session.clientSecret,
      redirectUri: session.redirectUri
    });

    await this.saveToken(tokenData);
    return tokenData;
  }

  async exchangeCodeForToken({ code, codeVerifier, clientId, clientSecret, redirectUri }) {
    const params = new URLSearchParams({
      code,
      client_id: clientId,
      client_secret: clientSecret,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      code_verifier: codeVerifier
    });

    const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    return response.data;
  }

  async saveToken(tokenData) {
    const now = new Date();
    const expiresAt = new Date(now.getTime() + (tokenData.expires_in || 0) * 1000);

    await this.store.set('google_auth', {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token || tokenData.refreshToken,
      tokenType: tokenData.token_type,
      scope: tokenData.scope,
      expiresAt: expiresAt.toISOString(),
      connectedAt: now.toISOString()
    });
  }

  async getTokenInfo() {
    return (await this.store.get('google_auth')) || null;
  }

  async disconnect() {
    await this.store.set('google_auth', null);
  }

  async getValidAccessToken() {
    const info = await this.getTokenInfo();
    if (!info?.accessToken) {
      return null;
    }

    if (!info.expiresAt) {
      return info.accessToken;
    }

    const expiresAt = new Date(info.expiresAt);
    const now = new Date();

    if (expiresAt.getTime() - now.getTime() > 60 * 1000) {
      return info.accessToken;
    }

    const refreshed = await this.refreshToken();
    return refreshed?.access_token || refreshed?.accessToken || info.accessToken;
  }

  async refreshToken() {
    const info = await this.getTokenInfo();
    if (!info?.refreshToken) {
      throw new Error('Refresh token nÇœo disponÇðvel.');
    }

    const config = await this.getStoredConfig();
    const clientId = config.clientId || process.env.GOOGLE_CLIENT_ID;
    const clientSecret = config.clientSecret || process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
      throw new Error('Credenciais do Google nÇœo configuradas.');
    }

    const params = new URLSearchParams({
      client_id: clientId,
      client_secret: clientSecret,
      refresh_token: info.refreshToken,
      grant_type: 'refresh_token'
    });

    const response = await axios.post(GOOGLE_TOKEN_URL, params.toString(), {
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
    });

    const payload = {
      ...response.data,
      refresh_token: response.data.refresh_token || info.refreshToken
    };

    await this.saveToken(payload);
    return payload;
  }
}

module.exports = GoogleAuthService;
