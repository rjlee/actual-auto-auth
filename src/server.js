const http = require("http");
const crypto = require("crypto");
const { URL, URLSearchParams } = require("url");
const { renderLoginPage } = require("./login-page");
const { renderHomePage, DEFAULT_TITLE } = require("./home-page");

const DEFAULT_COOKIE_NAME = "actual-auth";
const DEFAULT_APP_NAME = "Actual Service";

function createCookie(value, { maxAgeMs, secret }) {
  const payload = JSON.stringify({
    value,
    expiry: maxAgeMs ? Date.now() + maxAgeMs : null,
  });
  const hmac = crypto.createHmac("sha256", secret);
  hmac.update(payload);
  const signature = hmac.digest("hex");
  return Buffer.from(`${payload}.${signature}`).toString("base64url");
}

function readCookie(raw, secret) {
  if (!raw) return null;
  try {
    const decoded = Buffer.from(raw, "base64url").toString("utf8");
    const [payload, signature] = decoded.split(".");
    const hmac = crypto.createHmac("sha256", secret);
    hmac.update(payload);
    const expected = hmac.digest("hex");
    if (
      !crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(expected))
    ) {
      return null;
    }
    const data = JSON.parse(payload);
    if (data.expiry && Date.now() > data.expiry) {
      return null;
    }
    return data.value;
  } catch {
    return null;
  }
}

function parseCookies(header = "") {
  return header.split(";").reduce((acc, part) => {
    const [key, value] = part.split("=");
    if (!key || typeof value === "undefined") {
      return acc;
    }
    acc[key.trim()] = value.trim();
    return acc;
  }, {});
}

function cookieFlags(req, { maxAgeSeconds, secureOnly }) {
  const flags = [
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    `Max-Age=${maxAgeSeconds}`,
  ];

  if (secureOnly) {
    flags.push("Secure");
  }

  return flags.join("; ");
}

function absoluteUrl(req, target) {
  if (/^https?:\/\//i.test(target)) {
    return target;
  }
  const proto =
    req.headers["x-forwarded-proto"] ||
    req.headers["x-forwarded-protocol"] ||
    req.headers["x-forwarded-scheme"] ||
    req.headers["forwarded-proto"] ||
    "http";
  const host =
    req.headers["x-forwarded-host"] ||
    req.headers["forwarded-host"] ||
    req.headers.host ||
    `${req.socket.localAddress}:${req.socket.localPort}`;
  const path = target.startsWith("/") ? target : `/${target}`;
  return `${proto}://${host}${path}`;
}

function buildRedirect(req, res, target) {
  res.statusCode = 302;
  res.setHeader("Location", absoluteUrl(req, target));
  res.end();
}

function normaliseNextPath(next = "/") {
  if (!next || typeof next !== "string") return "/";
  return next.startsWith("/") ? next : `/${next}`;
}

function normaliseLinkHref(raw = "") {
  const href = raw.toString().trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return href;
  return `/${href}`;
}

function normaliseHomeLinks(links = []) {
  const seen = new Set();
  return links
    .map((entry) => {
      if (!entry || typeof entry !== "object") {
        return null;
      }
      const name = (entry.name ?? "").toString().trim();
      const href = normaliseLinkHref(entry.href);
      if (!name || !href) {
        return null;
      }
      const key = `${name}|${href}`;
      if (seen.has(key)) {
        return null;
      }
      seen.add(key);
      return { name, href };
    })
    .filter(Boolean);
}

function createAuthServer(options = {}) {
  const {
    actualPassword,
    sessionSecret,
    cookieName = DEFAULT_COOKIE_NAME,
    appName = DEFAULT_APP_NAME,
    cookieMaxAgeSeconds = 24 * 60 * 60,
    enforceSecureCookies = false,
    homeTitle,
    homeLinks = [],
  } = options;

  if (!actualPassword) {
    throw new Error(
      "ACTUAL_PASSWORD must be provided to start actual-auto-auth",
    );
  }

  const signingSecret =
    sessionSecret ||
    crypto.createHash("sha256").update(actualPassword).digest("hex");

  const resolvedHomeTitle =
    (homeTitle || DEFAULT_TITLE).toString().trim() || DEFAULT_TITLE;
  const resolvedLinks = normaliseHomeLinks(homeLinks);
  const defaultLinks =
    resolvedLinks.length > 0
      ? resolvedLinks
      : [{ name: "Traefik Dashboard", href: "/dashboard/" }];

  const server = http.createServer(async (req, res) => {
    const parsedUrl = new URL(
      req.url,
      `http://${req.headers.host || "localhost"}`,
    );
    const queryAppName =
      parsedUrl.searchParams.get("app")?.toString().trim() ?? "";
    const queryCookieName =
      parsedUrl.searchParams.get("cookie")?.toString().trim() ?? "";
    const headerAppName = (req.headers["x-actual-app-name"] ?? "")
      .toString()
      .trim();
    const headerCookieName = (req.headers["x-actual-cookie-name"] ?? "")
      .toString()
      .trim();
    const effectiveAppName = queryAppName || headerAppName || appName;
    const requestCookieName = queryCookieName || headerCookieName || cookieName;
    const baseParams = new URLSearchParams();
    if (effectiveAppName) {
      baseParams.set("app", effectiveAppName);
    }
    if (requestCookieName) {
      baseParams.set("cookie", requestCookieName);
    }
    const baseQuerySuffix =
      baseParams.toString().length > 0 ? `?${baseParams.toString()}` : "";

    if (
      (req.method === "GET" || req.method === "HEAD") &&
      parsedUrl.pathname === "/"
    ) {
      const cookies = parseCookies(req.headers.cookie);
      const sessionValue = readCookie(
        cookies[requestCookieName],
        signingSecret,
      );
      if (!sessionValue) {
        const params = new URLSearchParams(baseParams);
        params.set("next", "/");
        const loginQuery =
          params.toString().length > 0 ? `?${params.toString()}` : "";
        buildRedirect(req, res, `/auth/login${loginQuery}`);
        return;
      }

      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      if (req.method === "HEAD") {
        res.end();
        return;
      }
      const page = renderHomePage({
        title: resolvedHomeTitle,
        links: defaultLinks,
      });
      res.end(page);
      return;
    }

    if (req.method === "GET" && parsedUrl.pathname === "/check") {
      const cookies = parseCookies(req.headers.cookie);
      const sessionValue = readCookie(
        cookies[requestCookieName],
        signingSecret,
      );
      if (sessionValue) {
        res.statusCode = 200;
        res.end("OK");
        return;
      }
      const forwardedUri = req.headers["x-forwarded-uri"] || "/";
      const nextPath = normaliseNextPath(forwardedUri);
      const loginParams = new URLSearchParams(baseParams);
      loginParams.set("next", nextPath);
      const loginQuery =
        loginParams.toString().length > 0 ? `?${loginParams.toString()}` : "";
      buildRedirect(req, res, `/auth/login${loginQuery}`);
      return;
    }

    if (
      (req.method === "GET" || req.method === "HEAD") &&
      parsedUrl.pathname === "/auth/login"
    ) {
      if (req.method === "HEAD") {
        res.statusCode = 200;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end();
        return;
      }
      const page = renderLoginPage({
        appName: effectiveAppName,
        next: normaliseNextPath(parsedUrl.searchParams.get("next") || "/"),
        formAction: `/auth/login${baseQuerySuffix}`,
      });
      res.statusCode = 200;
      res.setHeader("Content-Type", "text/html; charset=utf-8");
      res.end(page);
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/auth/login") {
      const body = await readBody(req);
      const params = new URLSearchParams(body);
      const password = params.get("password");
      const nextPath = normaliseNextPath(params.get("next") || "/");
      if (password !== actualPassword) {
        const page = renderLoginPage({
          appName: effectiveAppName,
          error: "Invalid password",
          next: nextPath,
          formAction: `/auth/login${baseQuerySuffix}`,
        });
        res.statusCode = 401;
        res.setHeader("Content-Type", "text/html; charset=utf-8");
        res.end(page);
        return;
      }
      const encoded = createCookie("1", {
        maxAgeMs: cookieMaxAgeSeconds * 1000,
        secret: signingSecret,
      });
      res.setHeader(
        "Set-Cookie",
        `${requestCookieName}=${encoded}; ${cookieFlags(req, {
          maxAgeSeconds: cookieMaxAgeSeconds,
          secureOnly: enforceSecureCookies,
        })}`,
      );
      buildRedirect(req, res, nextPath);
      return;
    }

    if (req.method === "POST" && parsedUrl.pathname === "/auth/logout") {
      res.setHeader(
        "Set-Cookie",
        `${requestCookieName}=; ${cookieFlags(req, {
          maxAgeSeconds: 0,
          secureOnly: enforceSecureCookies,
        })}`,
      );
      buildRedirect(req, res, `/auth/login${baseQuerySuffix}`);
      return;
    }

    res.statusCode = 404;
    res.end("Not found");
  });

  return server;
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

module.exports = {
  createAuthServer,
  DEFAULT_APP_NAME,
  DEFAULT_COOKIE_NAME,
};
