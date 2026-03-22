import { describe, it, expect } from 'vitest';

describe('WHOOP credentials', () => {
  it('should have WHOOP_CLIENT_ID set', () => {
    const clientId = process.env.WHOOP_CLIENT_ID;
    expect(clientId).toBeTruthy();
    expect(clientId!.length).toBeGreaterThan(0);
  });

  it('should have WHOOP_CLIENT_SECRET set', () => {
    const secret = process.env.WHOOP_CLIENT_SECRET;
    expect(secret).toBeTruthy();
    expect(secret!.length).toBeGreaterThan(0);
  });

  it('should have WHOOP_REDIRECT_URI set', () => {
    const uri = process.env.WHOOP_REDIRECT_URI;
    expect(uri).toBeTruthy();
    // Accept both /api/whoop/callback and /whoop-callback path formats
    const hasValidPath = uri!.includes('/api/whoop/callback') || uri!.includes('/whoop-callback');
    expect(hasValidPath).toBe(true);
  });

  it('should build a valid WHOOP auth URL', () => {
    const clientId = process.env.WHOOP_CLIENT_ID || '';
    const redirectUri = process.env.WHOOP_REDIRECT_URI || '';
    const state = 'test-state-123';
    const params = new URLSearchParams({
      client_id: clientId,
      redirect_uri: redirectUri,
      response_type: 'code',
      scope: 'read:recovery read:cycles read:sleep read:workout read:profile',
      state,
    });
    const url = `https://api.prod.whoop.com/oauth/oauth2/auth?${params.toString()}`;
    expect(url).toContain('client_id=');
    // Accept both /api/whoop/callback (URL-encoded as %2F) and /whoop-callback
    const hasValidCallback = url.includes('whoop%2Fcallback') || url.includes('whoop-callback');
    expect(hasValidCallback).toBe(true);
    expect(url).toContain('state=test-state-123');
    console.log('Auth URL preview:', url.substring(0, 100) + '...');
  });
});
