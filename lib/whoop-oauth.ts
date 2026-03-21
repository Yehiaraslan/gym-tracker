/**
 * WHOOP OAuth Authentication
 * 
 * Handles OAuth login flow with WHOOP API.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';

const WHOOP_CLIENT_ID = process.env.EXPO_PUBLIC_WHOOP_CLIENT_ID || '';
const WHOOP_CLIENT_SECRET = process.env.EXPO_PUBLIC_WHOOP_CLIENT_SECRET || '';
const WHOOP_REDIRECT_URI = Linking.createURL('whoop-callback');
const WHOOP_AUTH_URL = 'https://api.prod.whoop.com/oauth/oauth2/auth';
const WHOOP_TOKEN_URL = 'https://api.prod.whoop.com/oauth/oauth2/token';

const WHOOP_TOKEN_KEY = 'gym_tracker_whoop_oauth_token';
const WHOOP_REFRESH_KEY = 'gym_tracker_whoop_refresh_token';
const WHOOP_EXPIRES_KEY = 'gym_tracker_whoop_expires_at';

export interface WhoopOAuthToken {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
}

/**
 * Start WHOOP OAuth login flow
 */
export async function startWhoopOAuthFlow(): Promise<WhoopOAuthToken | null> {
  try {
    const state = generateRandomState();
    await AsyncStorage.setItem('whoop_oauth_state', state);

    const authUrl = new URL(WHOOP_AUTH_URL);
    authUrl.searchParams.append('client_id', WHOOP_CLIENT_ID);
    authUrl.searchParams.append('redirect_uri', WHOOP_REDIRECT_URI);
    authUrl.searchParams.append('response_type', 'code');
    authUrl.searchParams.append('scope', 'read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement');
    authUrl.searchParams.append('state', state);

    const result = await WebBrowser.openAuthSessionAsync(
      authUrl.toString(),
      WHOOP_REDIRECT_URI
    );

    if (result.type === 'success') {
      const url = new URL(result.url);
      const code = url.searchParams.get('code');
      const returnedState = url.searchParams.get('state');

      // Verify state matches
      const savedState = await AsyncStorage.getItem('whoop_oauth_state');
      if (returnedState !== savedState) {
        throw new Error('OAuth state mismatch');
      }

      if (code) {
        return exchangeCodeForToken(code);
      }
    }

    return null;
  } catch (error) {
    console.error('WHOOP OAuth error:', error);
    return null;
  }
}

/**
 * Exchange authorization code for access token
 */
async function exchangeCodeForToken(code: string): Promise<WhoopOAuthToken | null> {
  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'authorization_code',
        code,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
        redirect_uri: WHOOP_REDIRECT_URI,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token exchange failed: ${response.status}`);
    }

    const data = await response.json();
    const token: WhoopOAuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    // Save tokens
    await saveTokens(token);
    return token;
  } catch (error) {
    console.error('Token exchange error:', error);
    return null;
  }
}

/**
 * Save tokens to secure storage
 */
export async function saveTokens(token: WhoopOAuthToken): Promise<void> {
  await AsyncStorage.setItem(WHOOP_TOKEN_KEY, token.accessToken);
  await AsyncStorage.setItem(WHOOP_REFRESH_KEY, token.refreshToken);
  await AsyncStorage.setItem(WHOOP_EXPIRES_KEY, token.expiresAt.toString());
}

/**
 * Get stored tokens
 */
export async function getStoredTokens(): Promise<WhoopOAuthToken | null> {
  try {
    const accessToken = await AsyncStorage.getItem(WHOOP_TOKEN_KEY);
    const refreshToken = await AsyncStorage.getItem(WHOOP_REFRESH_KEY);
    const expiresAt = await AsyncStorage.getItem(WHOOP_EXPIRES_KEY);

    if (!accessToken || !refreshToken || !expiresAt) {
      return null;
    }

    return {
      accessToken,
      refreshToken,
      expiresAt: parseInt(expiresAt, 10),
    };
  } catch (error) {
    console.error('Error retrieving tokens:', error);
    return null;
  }
}

/**
 * Check if token is expired
 */
export function isTokenExpired(token: WhoopOAuthToken): boolean {
  return Date.now() > token.expiresAt;
}

/**
 * Refresh access token
 */
export async function refreshAccessToken(token: WhoopOAuthToken): Promise<WhoopOAuthToken | null> {
  try {
    const response = await fetch(WHOOP_TOKEN_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: token.refreshToken,
        client_id: WHOOP_CLIENT_ID,
        client_secret: WHOOP_CLIENT_SECRET,
      }).toString(),
    });

    if (!response.ok) {
      throw new Error(`Token refresh failed: ${response.status}`);
    }

    const data = await response.json();
    const newToken: WhoopOAuthToken = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token || token.refreshToken,
      expiresAt: Date.now() + data.expires_in * 1000,
    };

    await saveTokens(newToken);
    return newToken;
  } catch (error) {
    console.error('Token refresh error:', error);
    return null;
  }
}

/**
 * Get valid access token (refresh if needed)
 */
export async function getValidAccessToken(): Promise<string | null> {
  const token = await getStoredTokens();
  if (!token) return null;

  if (isTokenExpired(token)) {
    const refreshed = await refreshAccessToken(token);
    return refreshed?.accessToken || null;
  }

  return token.accessToken;
}

/**
 * Logout and clear tokens
 */
export async function logoutWhoop(): Promise<void> {
  await AsyncStorage.multiRemove([
    WHOOP_TOKEN_KEY,
    WHOOP_REFRESH_KEY,
    WHOOP_EXPIRES_KEY,
  ]);
}

/**
 * Generate random state for OAuth
 */
function generateRandomState(): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let state = '';
  for (let i = 0; i < 32; i++) {
    state += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return state;
}
