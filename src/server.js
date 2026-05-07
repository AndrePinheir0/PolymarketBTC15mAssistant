import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";
import { fileURLToPath } from "node:url";
import { CONFIG } from "./config.js";

const PROJECT_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const sessions = new Set();

function parseCookies(cookieHeader) {
  const cookies = {};
  if (!cookieHeader) return cookies;
  for (const part of cookieHeader.split(";")) {
    const [k, ...v] = part.trim().split("=");
    if (k) cookies[k.trim()] = v.join("=").trim();
  }
  return cookies;
}

function isAuthenticated(req) {
  const cookies = parseCookies(req.headers.cookie);
  return cookies.session && sessions.has(cookies.session);
}

function parseBody(req) {
  return new Promise((resolve) => {
    let body = "";
    req.on("data", (chunk) => { body += chunk; });
    req.on("end", () => {
      const params = new URLSearchParams(body);
      resolve({ username: params.get("username") || "", password: params.get("password") || "" });
    });
  });
}

function serveFile(res, filePath, contentType) {
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("Not found");
      return;
    }
    res.writeHead(200, { "Content-Type": contentType });
    res.end(data);
  });
}

export function startDashboardServer() {
  const { user, password, port } = CONFIG.dashboard;

  const server = http.createServer(async (req, res) => {
    const url = new URL(req.url, `http://localhost`);
    const pathname = url.pathname;
    const method = req.method;

    if (method === "GET" && pathname === "/login") {
      serveFile(res, path.join(__dirname, "login.html"), "text/html");
      return;
    }

    if (method === "POST" && pathname === "/login") {
      const { username, password: pw } = await parseBody(req);
      if (username === user && pw === password) {
        const token = crypto.randomUUID();
        sessions.add(token);
        res.writeHead(302, {
          "Set-Cookie": `session=${token}; HttpOnly; SameSite=Strict; Path=/`,
          "Location": "/"
        });
        res.end();
      } else {
        res.writeHead(302, { "Location": "/login?error=1" });
        res.end();
      }
      return;
    }

    if (method === "GET" && pathname === "/logout") {
      const cookies = parseCookies(req.headers.cookie);
      if (cookies.session) sessions.delete(cookies.session);
      res.writeHead(302, {
        "Set-Cookie": "session=; HttpOnly; SameSite=Strict; Path=/; Max-Age=0",
        "Location": "/login"
      });
      res.end();
      return;
    }

    if (method === "GET" && pathname === "/") {
      if (!isAuthenticated(req)) {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return;
      }
      serveFile(res, path.join(__dirname, "index.html"), "text/html");
      return;
    }

    if (method === "GET" && pathname === "/logs/paper_trades.csv") {
      if (!isAuthenticated(req)) {
        res.writeHead(302, { "Location": "/login" });
        res.end();
        return;
      }
      serveFile(res, path.join(PROJECT_ROOT, "logs", "paper_trades.csv"), "text/csv");
      return;
    }

    if (method === "GET" && pathname === "/api/state") {
      if (!isAuthenticated(req)) {
        res.writeHead(401);
        res.end("Unauthorized");
        return;
      }
      fs.readFile(path.join(PROJECT_ROOT, "logs", "paper_state.json"), "utf8", (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end("{}");
          return;
        }
        res.writeHead(200, { "Content-Type": "application/json" });
        res.end(data);
      });
      return;
    }

    res.writeHead(404);
    res.end("Not found");
  });

  server.listen(port, "127.0.0.1", () => {
    process.stderr.write(`Dashboard: http://127.0.0.1:${port}\n`);
  });

  return server;
}
