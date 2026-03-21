import { describe, it, expect } from "vitest";

describe("WHOOP Configuration", () => {
  it("should have WHOOP_CLIENT_ID set", () => {
    const clientId = process.env.WHOOP_CLIENT_ID;
    expect(clientId).toBeDefined();
    expect(clientId).not.toBe("");
    expect(typeof clientId).toBe("string");
  });

  it("should have WHOOP_CLIENT_SECRET set", () => {
    const clientSecret = process.env.WHOOP_CLIENT_SECRET;
    expect(clientSecret).toBeDefined();
    expect(clientSecret).not.toBe("");
    expect(typeof clientSecret).toBe("string");
  });

  it("should have WHOOP_REDIRECT_URI set", () => {
    const redirectUri = process.env.WHOOP_REDIRECT_URI;
    expect(redirectUri).toBeDefined();
    expect(redirectUri).not.toBe("");
    expect(typeof redirectUri).toBe("string");
  });

  it("WHOOP_REDIRECT_URI should contain whoop callback path", () => {
    const redirectUri = process.env.WHOOP_REDIRECT_URI || "";
    const hasValidPath = redirectUri.includes("/api/whoop/callback") || redirectUri.includes("/whoop-callback");
    expect(hasValidPath).toBe(true);
  });
});
