/**
 * WHOOP API Service
 * Handles OAuth token exchange, refresh, and data fetching from WHOOP API.
 */
import { encryptToken, decryptToken } from "./whoopCrypto";
import * as whoopDb from "./whoopDb";

const WHOOP_API_BASE = "https://api.prod.whoop.com";
const WHOOP_AUTH_URL = "https://api.prod.whoop.com/oauth/oauth2/auth";
const WHOOP_TOKEN_URL = "https://api.prod.whoop.com/oauth/oauth2/token";

function getClientId(): string {
  return process.env.WHOOP_CLIENT_ID || "";
}

function getClientSecret(): string {
  return process.env.WHOOP_CLIENT_SECRET || "";
}

function getRedirectUri(): string {
  return process.env.WHOOP_REDIRECT_URI || "";
}

// ── OAuth Helpers ────────────────────────────────────────────

export function buildAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: getClientId(),
    redirect_uri: getRedirectUri(),
    response_type: "code",
    scope: "offline read:recovery read:cycles read:sleep read:workout read:profile read:body_measurement",
    state,
  });
  return `${WHOOP_AUTH_URL}?${params.toString()}`;
}

export async function exchangeCodeForTokens(code: string, userOpenId: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    redirect_uri: getRedirectUri(),
  });

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    const errorText = await response.text();
    console.error("[WHOOP] Token exchange failed:", response.status, errorText);
    // Parse WHOOP's JSON error for a human-readable message
    try {
      const errJson = JSON.parse(errorText);
      const desc = errJson.error_description || errJson.error || `HTTP ${response.status}`;
      throw new Error(`WHOOP: ${desc}`);
    } catch (parseErr) {
      if (parseErr instanceof Error && parseErr.message.startsWith('WHOOP:')) throw parseErr;
      throw new Error(`Token exchange failed (${response.status}): ${errorText.slice(0, 200)}`);
    }
  }

  const rawText = await response.text();
  console.log("[WHOOP] Token exchange raw response:", rawText.slice(0, 500));

  let data: Record<string, unknown>;
  try {
    data = JSON.parse(rawText);
  } catch {
    throw new Error(`WHOOP returned non-JSON response: ${rawText.slice(0, 200)}`);
  }

  console.log("[WHOOP] Token exchange response keys:", Object.keys(data));

  // Handle WHOOP error responses that come back as 200 OK
  if (data.error) {
    const desc = (data.error_description as string) || (data.error as string);
    console.error("[WHOOP] Token exchange error in body:", JSON.stringify(data));
    throw new Error(`WHOOP: ${desc}`);
  }

  // Validate that the response contains the expected token fields
  if (!data.access_token || !data.refresh_token) {
    console.error("[WHOOP] Token exchange response missing tokens. Keys:", Object.keys(data), "Full:", JSON.stringify(data));
    throw new Error(`WHOOP token response missing access_token or refresh_token. Got keys: ${Object.keys(data).join(', ')}. This usually means the authorization code was already used or expired — please try connecting again.`);
  }

  const expiresAt = Date.now() + ((data.expires_in as number) || 3600) * 1000;

  // Encrypt tokens before storing
  const encryptedAccess = encryptToken(data.access_token as string);
  const encryptedRefresh = encryptToken(data.refresh_token as string);

  await whoopDb.saveWhoopTokens({
    userOpenId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt,
    scope: (data.scope as string) || "",
  });

  return { success: true, expiresAt };
}

async function refreshAccessToken(userOpenId: string): Promise<string | null> {
  const stored = await whoopDb.getWhoopTokens(userOpenId);
  if (!stored) return null;

  const refreshToken = decryptToken(stored.refreshToken);

  const body = new URLSearchParams({
    grant_type: "refresh_token",
    refresh_token: refreshToken,
    client_id: getClientId(),
    client_secret: getClientSecret(),
    scope: "offline",
  });

  const response = await fetch(WHOOP_TOKEN_URL, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: body.toString(),
  });

  if (!response.ok) {
    console.error("[WHOOP] Token refresh failed:", response.status);
    // If refresh fails, delete tokens (user needs to re-auth)
    await whoopDb.deleteWhoopTokens(userOpenId);
    return null;
  }

  const data = await response.json();
  const expiresAt = Date.now() + (data.expires_in || 3600) * 1000;

  const encryptedAccess = encryptToken(data.access_token);
  const encryptedRefresh = encryptToken(data.refresh_token);

  await whoopDb.saveWhoopTokens({
    userOpenId,
    accessToken: encryptedAccess,
    refreshToken: encryptedRefresh,
    expiresAt,
    scope: data.scope || stored.scope || "",
  });

  return data.access_token;
}

async function getValidAccessToken(userOpenId: string): Promise<string | null> {
  const stored = await whoopDb.getWhoopTokens(userOpenId);
  if (!stored) return null;

  // Check if token is expired (with 5-minute buffer)
  if (stored.expiresAt < Date.now() + 5 * 60 * 1000) {
    return refreshAccessToken(userOpenId);
  }

  return decryptToken(stored.accessToken);
}

// ── API Calls ────────────────────────────────────────────────

async function whoopGet(userOpenId: string, path: string): Promise<any> {
  const token = await getValidAccessToken(userOpenId);
  if (!token) throw new Error("No valid WHOOP token");

  const response = await fetch(`${WHOOP_API_BASE}${path}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  if (response.status === 401) {
    // Try refresh once
    const newToken = await refreshAccessToken(userOpenId);
    if (!newToken) throw new Error("WHOOP authentication expired");

    const retryResponse = await fetch(`${WHOOP_API_BASE}${path}`, {
      headers: { Authorization: `Bearer ${newToken}` },
    });
    if (!retryResponse.ok) throw new Error(`WHOOP API error: ${retryResponse.status}`);
    return retryResponse.json();
  }

  if (!response.ok) throw new Error(`WHOOP API error: ${response.status}`);
  return response.json();
}

export async function getProfile(userOpenId: string) {
  return whoopGet(userOpenId, "/developer/v1/user/profile/basic");
}

export async function getRecoveryCollection(userOpenId: string, limit = 7) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ start, end, limit: String(limit) });
  return whoopGet(userOpenId, `/developer/v1/recovery?${params}`);
}

export async function getCycleCollection(userOpenId: string, limit = 7) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ start, end, limit: String(limit) });
  return whoopGet(userOpenId, `/developer/v1/cycle?${params}`);
}

export async function getSleepCollection(userOpenId: string, limit = 7) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - limit * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ start, end, limit: String(limit) });
  return whoopGet(userOpenId, `/developer/v1/activity/sleep?${params}`);
}

export async function getWorkoutCollection(userOpenId: string, limit = 10) {
  const end = new Date().toISOString();
  const start = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();
  const params = new URLSearchParams({ start, end, limit: String(limit) });
  return whoopGet(userOpenId, `/developer/v1/activity/workout?${params}`);
}

export async function getBodyMeasurement(userOpenId: string) {
  return whoopGet(userOpenId, "/developer/v1/user/measurement/body");
}

export async function isConnected(userOpenId: string): Promise<boolean> {
  const stored = await whoopDb.getWhoopTokens(userOpenId);
  return stored !== null;
}

export async function disconnect(userOpenId: string): Promise<void> {
  await whoopDb.deleteWhoopTokens(userOpenId);
}
