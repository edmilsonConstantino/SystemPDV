// Carregar .env ANTES de qualquer módulo que use variáveis de ambiente
await import("../env");

const { app } = await import("./app");
const { default: runApp } = await import("./runApp");

import fs from "node:fs";
import { type Server } from "node:http";
import path from "node:path";

import type { Express } from "express";
import { nanoid } from "nanoid";
import { createServer as createViteServer, createLogger } from "vite";

import viteConfig from "../vite.config";

const viteLogger = createLogger();

export async function setupVite(app: Express, server: Server) {
  const serverOptions = {
    middlewareMode: true,
    hmr: { server },
    allowedHosts: true as const,
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
    try {
      const clientTemplate = path.resolve(
        import.meta.dirname,
        "..",
        "client",
        "index.html",
      );

      let template = await fs.promises.readFile(clientTemplate, "utf-8");
      template = template.replace(
        `src="/src/main.tsx"`,
        `src="/src/main.tsx?v=${nanoid()}"`,
      );

      const page = await vite.transformIndexHtml(req.originalUrl, template);
      res.status(200).set({ "Content-Type": "text/html" }).end(page);
    } catch (e) {
      vite.ssrFixStacktrace(e as Error);
      next(e);
    }
  });
}

// DEBUG - apenas em desenvolvimento
console.log("\n🔧 Configuração do servidor (DESENVOLVIMENTO):");
console.log(`   HOST: ${process.env.HOST || "localhost"}`);
console.log(`   PORT: ${process.env.PORT || "9001"}`);
console.log(`   NODE_ENV: ${process.env.NODE_ENV || "development"}`);
console.log(`   DATABASE_URL: ${process.env.DATABASE_URL ? "✅ configurada" : "❌ NÃO DEFINIDA"}`);
console.log("");

(async () => {
  await runApp(app, setupVite);
})();