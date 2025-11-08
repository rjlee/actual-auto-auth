const http = require("http");
const { createAuthServer } = require("../src/server");

async function startServer(options = {}) {
  const server = createAuthServer({
    actualPassword: "secret",
    ...options,
  });

  await new Promise((resolve) => server.listen(0, resolve));
  const address = server.address();
  const baseUrl = `http://127.0.0.1:${address.port}`;

  return {
    server,
    baseUrl,
    async close() {
      await new Promise((resolve) => server.close(resolve));
    },
  };
}

function manualFetch(url, options = {}) {
  const defaultForwardHeaders = {
    "x-forwarded-host": "stack.local:3000",
    "x-forwarded-proto": "http",
  };
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const req = http.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: requestUrl.pathname + requestUrl.search,
        method: options.method || "GET",
        headers: {
          ...defaultForwardHeaders,
          ...(options.headers || {}),
        },
      },
      (res) => {
        const chunks = [];
        res.on("data", (chunk) => chunks.push(chunk));
        res.on("end", () => {
          const body = Buffer.concat(chunks).toString("utf8");
          resolve({
            status: res.statusCode,
            headers: res.headers,
            body,
          });
        });
      },
    );

    req.on("error", reject);

    if (options.body) {
      req.write(options.body);
    }
    req.end();
  });
}

describe("createAuthServer", () => {
  test("home page renders default link list", async () => {
    const instance = await startServer({
      homeTitle: "Stack Start",
      homeLinks: [
        { name: "Traefik Dashboard", href: "/dashboard/" },
        { name: "Actual Auto Categorise", href: "/categorise/" },
      ],
    });
    const res = await manualFetch(`${instance.baseUrl}/`);
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toContain(">Stack Start<");
    expect(res.body).toContain('href="/dashboard/"');
    expect(res.body).toContain('href="/categorise/"');
  });

  test("home page supports HEAD requests", async () => {
    const instance = await startServer({
      homeLinks: [{ name: "Dashboard", href: "/dashboard/" }],
    });
    const res = await manualFetch(`${instance.baseUrl}/`, { method: "HEAD" });
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toBe("");
  });

  test("throws when ACTUAL_PASSWORD missing", () => {
    expect(() => createAuthServer()).toThrow(/ACTUAL_PASSWORD/);
  });

  test("redirects to login when session missing", async () => {
    const instance = await startServer();
    const res = await manualFetch(`${instance.baseUrl}/check`, {
      headers: {
        "x-actual-app-name": "Actual Auto Categorise",
        "x-actual-cookie-name": "categorise-auth",
        "x-forwarded-uri": "/dashboard",
      },
    });
    await instance.close();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe(
      "http://stack.local:3000/auth/login?app=Actual+Auto+Categorise&cookie=categorise-auth&next=%2Fdashboard",
    );
  });

  test("renders login page with custom app name", async () => {
    const instance = await startServer({ appName: "Default Name" });
    const res = await manualFetch(
      `${instance.baseUrl}/auth/login?app=Actual%20Auto%20Categorise&cookie=categorise-auth&next=%2Ftrain`,
    );
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toContain("Actual Auto Categorise");
    expect(res.body).toContain('value="/train"');
    expect(res.body).toContain(
      'action="/auth/login?app=Actual+Auto+Categorise&amp;cookie=categorise-auth"',
    );
  });

  test("login page honours headers when query missing", async () => {
    const instance = await startServer({ appName: "Default Name" });
    const res = await manualFetch(`${instance.baseUrl}/auth/login?next=%2F`, {
      headers: {
        "x-actual-app-name": "Header App",
        "x-actual-cookie-name": "header-cookie",
      },
    });
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toContain("Header App");
    expect(res.body).toContain(
      'action="/auth/login?app=Header+App&amp;cookie=header-cookie"',
    );
  });

  test("login page honours header override", async () => {
    const instance = await startServer({ appName: "Default Service" });
    const res = await manualFetch(`${instance.baseUrl}/auth/login?next=%2F`, {
      headers: {
        "x-actual-app-name": "Categorise UI",
        "x-actual-cookie-name": "categorise-auth",
      },
    });
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toContain("Categorise UI");
    expect(res.body).not.toContain("Default Service");
    expect(res.body).toContain(
      'action="/auth/login?app=Categorise+UI&amp;cookie=categorise-auth"',
    );
  });

  test("successful login sets cookie and redirects", async () => {
    const instance = await startServer({ cookieName: "custom-auth" });
    const res = await manualFetch(
      `${instance.baseUrl}/auth/login?app=Actual%20Auto%20Categorise&cookie=categorise-auth`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "password=secret&next=%2Fdashboard",
      },
    );
    await instance.close();

    expect(res.status).toBe(302);
    expect(res.headers.location).toBe("http://stack.local:3000/dashboard");
    expect(Array.isArray(res.headers["set-cookie"])).toBe(true);
    expect(res.headers["set-cookie"][0]).toMatch(/^categorise-auth=/);
  });

  test("successful login uses headers when query missing", async () => {
    const instance = await startServer();
    const res = await manualFetch(`${instance.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
        "x-actual-app-name": "Header App",
        "x-actual-cookie-name": "header-cookie",
      },
      body: "password=secret&next=%2Fhome",
    });
    await instance.close();

    expect(res.status).toBe(302);
    expect(Array.isArray(res.headers["set-cookie"])).toBe(true);
    expect(res.headers["set-cookie"][0]).toMatch(/^header-cookie=/);
  });

  test("invalid login renders error and 401", async () => {
    const instance = await startServer({ appName: "Actual Auto Stack" });
    const res = await manualFetch(
      `${instance.baseUrl}/auth/login?app=Actual%20Auto%20Stack&cookie=stack-auth`,
      {
        method: "POST",
        headers: {
          "content-type": "application/x-www-form-urlencoded",
        },
        body: "password=wrong&next=%2F",
      },
    );
    await instance.close();

    expect(res.status).toBe(401);
    expect(res.body).toContain("Invalid password");
    expect(res.body).toContain("Actual Auto Stack");
    expect(res.body).toContain(
      'action="/auth/login?app=Actual+Auto+Stack&amp;cookie=stack-auth"',
    );
  });

  test("logout clears override cookie", async () => {
    const instance = await startServer();
    const res = await manualFetch(
      `${instance.baseUrl}/auth/logout?app=Actual%20Auto%20Categorise&cookie=categorise-auth`,
      { method: "POST" },
    );
    await instance.close();

    expect(res.status).toBe(302);
    expect(Array.isArray(res.headers["set-cookie"])).toBe(true);
    expect(res.headers["set-cookie"][0]).toMatch(/^categorise-auth=;/);
    expect(res.headers.location).toBe(
      "http://stack.local:3000/auth/login?app=Actual+Auto+Categorise&cookie=categorise-auth",
    );
  });
});
