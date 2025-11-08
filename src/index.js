const { createAuthServer } = require("./server");

function normaliseLinkHref(raw = "") {
  const href = raw.toString().trim();
  if (!href) return null;
  if (/^https?:\/\//i.test(href)) return href;
  if (href.startsWith("/")) return href;
  return `/${href}`;
}

function parseNavLinks(raw = "") {
  return raw
    .split(/[\n;,]+/g)
    .map((part) => part.trim())
    .filter(Boolean)
    .map((entry) => {
      const [maybeName, maybeHref] = entry.split("|");
      const href = normaliseLinkHref(maybeHref ?? maybeName);
      const name =
        (maybeHref ? maybeName : "").toString().trim() ||
        (href || "").toString().trim();
      if (!href || !name) {
        return null;
      }
      return { name, href };
    })
    .filter(Boolean);
}

function uniqueLinks(links) {
  const seen = new Set();
  return links.filter(({ name, href }) => {
    const key = `${name}|${href}`;
    if (seen.has(key)) {
      return false;
    }
    seen.add(key);
    return true;
  });
}

function buildHomeLinksFromEnv() {
  const includeDefaults =
    (process.env.STACK_INCLUDE_DEFAULT_LINKS || "true")
      .toString()
      .trim()
      .toLowerCase() !== "false";

  const links = [];

  if (includeDefaults) {
    const dashboardName =
      process.env.STACK_DASHBOARD_NAME?.trim() || "Traefik Dashboard";
    links.push({ name: dashboardName, href: "/dashboard/" });

    const categoriseEnabled =
      (process.env.STACK_INCLUDE_CATEGORISE_LINK || "").trim().toLowerCase() !==
      "false";
    if (categoriseEnabled) {
      const categoriseName =
        process.env.CATEGORISE_LOGIN_NAME?.trim() || "Actual Auto Categorise";
      links.push({ name: categoriseName, href: "/categorise/" });
    }
  }

  const autoLinks = Object.entries(process.env)
    .filter(([key, value]) => key.startsWith("STACK_LINK_") && value)
    .map(([key, value]) => {
      const id = key.slice("STACK_LINK_".length);
      const href = normaliseLinkHref(value);
      if (!href) {
        return null;
      }
      const labelKey = `STACK_LABEL_${id}`;
      const label =
        process.env[labelKey]?.toString().trim() ||
        id.replace(/__/g, "/").replace(/_/g, "-").toLowerCase();
      return { name: label, href };
    })
    .filter(Boolean);

  const extraLinks = parseNavLinks(process.env.STACK_NAV_LINKS || "");
  return uniqueLinks([...links, ...autoLinks, ...extraLinks]);
}

function start() {
  try {
    const server = createAuthServer({
      actualPassword: process.env.ACTUAL_PASSWORD,
      sessionSecret: process.env.SESSION_SECRET,
      cookieName: process.env.AUTH_COOKIE_NAME,
      appName: process.env.AUTH_APP_NAME,
      homeTitle: process.env.STACK_HOME_TITLE,
      homeLinks: buildHomeLinksFromEnv(),
    });

    const port = Number(process.env.PORT || 4000);
    server.listen(port, () => {
      console.log(`actual-auto-auth listening on port ${port}`);
    });
  } catch (err) {
    console.error(err.message);
    process.exit(1);
  }
}

start();
