/**
 * WHOOP Token Encryption
 * Uses AES-256-GCM for authenticated encryption of refresh tokens at rest.
 */
import crypto from "crypto";

const ENCRYPTION_KEY = process.env.WHOOP_TOKEN_ENCRYPTION_KEY || "default-dev-key-change-in-production";

export function encryptToken(plaintext: string): string {
  try {
    const iv = crypto.randomBytes(16);
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
    let encrypted = cipher.update(plaintext, "utf8", "hex");
    encrypted += cipher.final("hex");
    const authTag = cipher.getAuthTag();
    const combined = iv.toString("hex") + ":" + authTag.toString("hex") + ":" + encrypted;
    return Buffer.from(combined).toString("base64");
  } catch (error) {
    console.error("[WHOOP Crypto] Encryption failed:", error);
    throw new Error("Failed to encrypt token");
  }
}

export function decryptToken(ciphertext: string): string {
  try {
    const combined = Buffer.from(ciphertext, "base64").toString("utf8");
    const [ivHex, authTagHex, encrypted] = combined.split(":");
    if (!ivHex || !authTagHex || !encrypted) {
      throw new Error("Invalid ciphertext format");
    }
    const iv = Buffer.from(ivHex, "hex");
    const authTag = Buffer.from(authTagHex, "hex");
    const key = crypto.scryptSync(ENCRYPTION_KEY, "salt", 32);
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(authTag);
    let decrypted = decipher.update(encrypted, "hex", "utf8");
    decrypted += decipher.final("utf8");
    return decrypted;
  } catch (error) {
    console.error("[WHOOP Crypto] Decryption failed:", error);
    throw new Error("Failed to decrypt token");
  }
}
