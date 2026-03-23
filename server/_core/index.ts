import "dotenv/config";
import express from "express";
import { createServer } from "http";
import net from "net";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { appRouter } from "../routers";
import { createContext } from "./context";
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
