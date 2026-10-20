const path = require("node:path");
const express = require("express");
const helmet = require("helmet");

const publicDirectory = path.join(__dirname, "public");

function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          baseUri: ["'self'"],
          connectSrc: ["'self'"],
          fontSrc: ["'self'"],
          formAction: ["'self'"],
          frameAncestors: ["'none'"],
          imgSrc: ["'self'", "data:", "blob:"],
          objectSrc: ["'none'"],
          scriptSrc: ["'self'"],
          styleSrc: ["'self'"],
          upgradeInsecureRequests: null
        }
      }
    })
  );

  app.get("/", (_request, response) => {
    response.sendFile(path.join(publicDirectory, "index.html"));
  });

  app.use(
    express.static(publicDirectory, {
      dotfiles: "deny",
      index: false,
      maxAge: process.env.NODE_ENV === "production" ? "1d" : 0,
      setHeaders(response, filePath) {
        if (filePath.endsWith(".html")) {
          response.setHeader("Cache-Control", "no-cache");
        }
      }
    })
  );

  app.use((_request, response) => {
    response.status(404).type("text/plain").send("No encontrado");
  });

  return app;
}

if (require.main === module) {
  const port = Number.parseInt(process.env.PORT || "3000", 10);
  const host = process.env.HOST || "0.0.0.0";

  if (!Number.isInteger(port) || port < 1 || port > 65535) {
    throw new Error("PORT debe ser un número entre 1 y 65535.");
  }

  createApp().listen(port, host, () => {
    console.log(`Laboratorio disponible en http://${host}:${port}`);
  });
}

module.exports = { createApp };
