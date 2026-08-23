import "dotenv/config";
import { randomUUID } from "crypto";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { COOKIE_NAME, ONE_YEAR_MS } from "../../shared/const.js";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
import { getSessionCookieOptions } from "./cookies";
import { sdk } from "./sdk";
import * as db from "../db";
import * as accounts from "../account-service";
import * as whoopStateDb from "../whoopStateDb";
import * as whoopService from "../whoopService";
import { startDailyDigestScheduler } from "../zakiDailyDigest";
import { startStagnationScheduler } from "../stagnationScheduler";

function isPortAvailable(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = net.createServer();
    server.listen(port, () => {
      server.close(() => resolve(true));
    });
    server.on("error", () => resolve(false));
  });
}

async function findAvailablePort(startPort: number = 3000): Promise<number> {
  for (let port = startPort; port < startPort + 20; port++) {
    if (await isPortAvailable(port)) {
      return port;
    }
  }
  throw new Error(`No available port found starting from ${startPort}`);
}

async function startServer() {
  const app = express();
  const server = createServer(app);

  // Enable CORS for all routes - reflect the request origin to support credentials
  app.use((req, res, next) => {
    const origin = req.headers.origin;
    if (origin) {
      res.header("Access-Control-Allow-Origin", origin);
    }
    res.header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS");
    res.header(
      "Access-Control-Allow-Headers",
      "Origin, X-Requested-With, Content-Type, Accept, Authorization",
    );
    res.header("Access-Control-Allow-Credentials", "true");

    // Handle preflight requests
    if (req.method === "OPTIONS") {
      res.sendStatus(200);
      return;
    }
    next();
  });

  app.use(express.json({ limit: "50mb" }));
  app.use(express.urlencoded({ limit: "50mb", extended: true }));

  registerOAuthRoutes(app);

  // WHOOP OAuth callback (browser redirect) - supports both paths
  const whoopCallbackHandler = async (req: express.Request, res: express.Response) => {
    try {
      const { code, state, error: oauthError, error_description } = req.query as {
        code?: string; state?: string; error?: string; error_description?: string;
      };

      // WHOOP may redirect back with an error (e.g., user denied access)
      if (oauthError) {
        console.error("[WHOOP Callback] OAuth error:", oauthError, error_description);
        res.status(400).send(`
          <html><body style="font-family:system-ui;background:#0a0a0a;color:#ff4444;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>WHOOP Authorization Failed</h2>
              <p>${error_description || oauthError}</p>
              <p>Please close this window and try again in the app.</p>
            </div>
          </body></html>
        `);
        return;
      }

      if (!code || !state) {
        res.status(400).send("Missing code or state parameter");
        return;
      }
      const stateResult = await whoopStateDb.validateAndConsumeState(state);
      if (!stateResult.valid) {
        res.status(400).send(`
          <html><body style="font-family:system-ui;background:#0a0a0a;color:#ff4444;display:flex;align-items:center;justify-content:center;height:100vh;">
            <div style="text-align:center;">
              <h2>Session Expired</h2>
              <p>Your authorization session expired. Please close this window and try connecting again in the app.</p>
            </div>
          </body></html>
        `);
        return;
      }
      // userOpenId stores the deviceId in our device-based auth system
      const deviceId = stateResult.userOpenId;
      if (!deviceId) {
        res.status(400).send("Missing device ID in state. Please try again.");
        return;
      }
      await whoopService.exchangeCodeForTokens(code, deviceId);
      res.send(`
        <html>
          <head><title>WHOOP Connected</title></head>
          <body style="display:flex;align-items:center;justify-content:center;height:100vh;font-family:system-ui;background:#0a0a0a;color:#00ff88;">
            <div style="text-align:center;">
              <h1 style="font-size:2rem;">&#x2705; WHOOP Connected!</h1>
              <p style="color:#aaa;margin-top:12px;">You can close this window and return to the app.</p>
              <p style="color:#555;font-size:12px;margin-top:8px;">This window will close automatically in 3 seconds.</p>
              <script>setTimeout(()=>window.close(),3000)</script>
            </div>
          </body>
        </html>
      `);
    } catch (error) {
      const msg = error instanceof Error ? error.message : String(error);
      console.error("[WHOOP Callback] Error:", msg);
      res.status(500).send(`
        <html><body style="font-family:system-ui;background:#0a0a0a;color:#ff4444;display:flex;align-items:center;justify-content:center;height:100vh;">
          <div style="text-align:center;">
            <h2>Connection Failed</h2>
            <p>${msg}</p>
            <p style="color:#666;font-size:12px;">Please close this window and try again in the app.</p>
          </div>
        </body></html>
      `);
    }
  };
  app.get("/api/whoop/callback", whoopCallbackHandler);
  app.get("/whoop-callback", whoopCallbackHandler);

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, timestamp: Date.now() });
  });

  // Guest sign-in for self-hosted deployments: mints a session JWT without the
  // Manus OAuth portal. Gated by GUEST_AUTH_ENABLED + shared invite code.
  app.post("/api/auth/guest", async (req, res) => {
    if (process.env.GUEST_AUTH_ENABLED !== "1") {
      res.status(404).json({ error: "not_found" });
      return;
    }
    try {
      const requiredCode = process.env.GUEST_AUTH_CODE ?? "";
      const body = (req.body ?? {}) as { name?: unknown; code?: unknown; openId?: unknown };
      if (requiredCode && body.code !== requiredCode) {
        res.status(403).json({ error: "invalid_code" });
        return;
      }
      // Reuse a previously issued guest identity when the client sends one back;
      // the prefix check stops callers from claiming arbitrary (e.g. owner) openIds.
      const openId =
        typeof body.openId === "string" && /^guest-[0-9a-f-]{8,64}$/.test(body.openId)
          ? body.openId
          : `guest-${randomUUID()}`;
      const name =
        typeof body.name === "string" && body.name.trim() ? body.name.trim().slice(0, 64) : "Guest";
      const now = new Date();
      const sessionToken = await sdk.createSessionToken(openId, { name });
      await db.upsertUser({ openId, name, loginMethod: "guest", lastSignedIn: now });
      res.cookie(COOKIE_NAME, sessionToken, {
        ...getSessionCookieOptions(req),
        maxAge: ONE_YEAR_MS,
      });
      res.json({
        sessionToken,
        user: {
          id: 0,
          openId,
          name,
          email: null,
          loginMethod: "guest",
          lastSignedIn: now.toISOString(),
        },
      });
    } catch (error) {
      console.error("[GuestAuth] Failed to create guest session:", error);
      res.status(500).json({ error: "guest_auth_failed" });
    }
  });

  // ── Real accounts (email + password) ──────────────────────────────
  // Additive: guest auth above is untouched so the installed APK keeps working.
  // Email verification and password reset are deliberately not wired yet —
  // there is no mail delivery route, and a reset link that cannot be sent is
  // worse than an absent one.

  // X-Forwarded-For is attacker-controllable: a client may send its own value
  // and Cloudflare APPENDS to it, so the leftmost entry is untrusted input and
  // would let one source rotate IPs at will to dodge per-IP throttling.
  // CF-Connecting-IP is set by Cloudflare and stripped from client input;
  // otherwise take the RIGHTMOST hop, which is the one our own proxy added.
  const clientIp = (req: import("express").Request): string | null => {
    const cf = req.headers["cf-connecting-ip"];
    if (typeof cf === "string" && cf.trim()) return cf.trim().slice(0, 64);
    const fwd = req.headers["x-forwarded-for"];
    if (typeof fwd === "string" && fwd.trim()) {
      const hops = fwd.split(",").map((h) => h.trim()).filter(Boolean);
      if (hops.length > 0) return hops[hops.length - 1].slice(0, 64);
    }
    return (req.ip ?? null)?.slice(0, 64) ?? null;
  };

  app.post("/api/auth/signup", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const user = await accounts.signup({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        name: typeof body.name === "string" ? body.name : undefined,
        role: body.role === "trainer" ? "trainer" : "user",
      });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name });
      await accounts.recordSession(user.id, sessionToken, req.headers["user-agent"] ?? null);
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ sessionToken, user });
    } catch (error) {
      if (error instanceof accounts.AccountError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      console.error("[Accounts] signup failed:", error);
      res.status(500).json({ error: "signup_failed", message: "Could not create the account." });
    }
  });

  app.post("/api/auth/login", async (req, res) => {
    try {
      const body = (req.body ?? {}) as Record<string, unknown>;
      const user = await accounts.login({
        email: String(body.email ?? ""),
        password: String(body.password ?? ""),
        ip: clientIp(req),
      });
      const sessionToken = await sdk.createSessionToken(user.openId, { name: user.name });
      await accounts.recordSession(user.id, sessionToken, req.headers["user-agent"] ?? null);
      res.cookie(COOKIE_NAME, sessionToken, { ...getSessionCookieOptions(req), maxAge: ONE_YEAR_MS });
      res.json({ sessionToken, user });
    } catch (error) {
      if (error instanceof accounts.AccountError) {
        res.status(error.status).json({ error: error.code, message: error.message });
        return;
      }
      console.error("[Accounts] login failed:", error);
      res.status(500).json({ error: "login_failed", message: "Could not sign in." });
    }
  });

  // WHOOP debug endpoint (safe - no secrets exposed)
  app.get("/api/whoop/debug", (_req, res) => {
    res.json({
      clientIdSet: !!process.env.WHOOP_CLIENT_ID,
      clientSecretSet: !!process.env.WHOOP_CLIENT_SECRET,
      redirectUri: process.env.WHOOP_REDIRECT_URI || '(not set)',
      clientIdLength: (process.env.WHOOP_CLIENT_ID || '').length,
      clientSecretLength: (process.env.WHOOP_CLIENT_SECRET || '').length,
    });
  });

  app.use(
    "/api/trpc",
    createExpressMiddleware({
      router: appRouter,
      createContext,
    }),
  );

  const preferredPort = parseInt(process.env.PORT || "3000");
  const port = await findAvailablePort(preferredPort);

  if (port !== preferredPort) {
    console.log(`Port ${preferredPort} is busy, using port ${port} instead`);
  }

  server.listen(port, () => {
    console.log(`[api] server listening on port ${port}`);
  });
}

startServer().catch(console.error);

// Start Zaki daily digest scheduler (fires at 07:00 Dubai time every day)
startDailyDigestScheduler();
// Start stagnation notification scheduler (fires at 06:55 Dubai time every day)
startStagnationScheduler();
