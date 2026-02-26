import express, { type Express } from "express";
import fs from "fs";
import path from "path";
import { createServer as createViteServer, createLogger } from "vite";
import { type Server } from "http";
import viteConfig from "../vite.config";
import { nanoid } from "nanoid";

const viteLogger = createLogger();

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

/**
 * Strip ALL PWA signals from html for /pdv routes.
 * This prevents iOS Safari from treating /pdv as a web app,
 * which forces the home screen shortcut to use the root URL.
 * Also prevents the Service Worker from intercepting /pdv navigation,
 * which causes the white screen on direct access.
 */
function stripPwaForPdv(html: string): string {
  // 1. Remove <link rel="manifest" ...>
  html = html.replace(/<link[^>]*rel\s*=\s*["']manifest["'][^>]*\/?>/gi, "");

  // 2. Remove <meta name="apple-mobile-web-app-capable" ...>
  html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app-capable["'][^>]*\/?>/gi, "");

  // 3. Remove <meta name="apple-mobile-web-app-status-bar-style" ...>
  html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app-status-bar-style["'][^>]*\/?>/gi, "");

  // 4. Remove <meta name="apple-mobile-web-app-title" ...>
  html = html.replace(/<meta[^>]*name\s*=\s*["']apple-mobile-web-app-title["'][^>]*\/?>/gi, "");

  // 5. Remove <link rel="apple-touch-icon" ...> (prevents iOS from using PWA icon)
  html = html.replace(/<link[^>]*rel\s*=\s*["']apple-touch-icon["'][^>]*\/?>/gi, "");

  // 6. Remove service worker registration script
  //    VitePWA generates: <script id="vite-plugin-pwa:register-sw" src="/registerSW.js"></script>
  //    Match any script tag that references registerSW in src OR in body
  html = html.replace(/<script[^>]*registerSW[^>]*>[^<]*<\/script>/gi, "");
  html = html.replace(/<script[^>]*>[^<]*registerSW[^<]*<\/script>/gi, "");

  return html;
}

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
    fs: {
      strict: false,
      allow: ['..'],
    },
  };

  const vite = await createViteServer({
    ...viteConfig,
    configFile: false,
    customLogger: {
      ...viteLogger,
      error: (msg, options) => {
        viteLogger.error(msg, options);
        process.exit(1);
      },
    },
    server: serverOptions,
    appType: "custom",
  });

  app.use(vite.middlewares);
  app.use("*", async (req, res, next) => {
    const url = req.originalUrl;

    // Skip API routes
    if (url.startsWith("/api")) {
      return next();
    }

    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      // always reload the index.html file from disk incase it changes
      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );
      let page = await vite.transformIndexHtml(url, template);

      // For /pdv routes, strip ALL PWA signals so iOS Safari treats it as a regular website
      if (url.startsWith("/pdv")) {
        page = stripPwaForPdv(page);
      }

      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

export function serveStatic(app: Express) {
  const distPath = path.resolve(import.meta.dirname, "public");

  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  app.use("*", async (req, res) => {
    try {
      let html = await fs.promises.readFile(path.resolve(distPath, "index.html"), "utf-8");

      // For /pdv routes, strip ALL PWA signals so iOS Safari treats it as a regular website
      if (req.originalUrl.startsWith("/pdv")) {
        html = stripPwaForPdv(html);
      }

      res.set("Content-Type", "text/html").send(html);
    } catch (e) {
      res.status(500).send("Error reading root index.html");
    }
  });
}
