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
  return new Promise((resolve, reject) => {
    const requestUrl = new URL(url);
    const req = http.request(
      {
        hostname: requestUrl.hostname,
        port: requestUrl.port,
        path: requestUrl.pathname + requestUrl.search,
        method: options.method || "GET",
        headers: options.headers,
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
  test("throws when ACTUAL_PASSWORD missing", () => {
    expect(() => createAuthServer()).toThrow(/ACTUAL_PASSWORD/);
  });

  test("redirects to login when session missing", async () => {
    const instance = await startServer();
    const res = await manualFetch(`${instance.baseUrl}/check`);
    await instance.close();

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(
      /http:\/\/127\.0\.0\.1:\d+\/auth\/login\?next=%2F/,
    );
  });

  test("renders login page with custom app name", async () => {
    const instance = await startServer({ appName: "Actual Auto Categorise" });
    const res = await manualFetch(
      `${instance.baseUrl}/auth/login?next=%2Ftrain`,
    );
    await instance.close();

    expect(res.status).toBe(200);
    expect(res.body).toContain("Actual Auto Categorise");
    expect(res.body).toContain('value="/train"');
  });

  test("successful login sets cookie and redirects", async () => {
    const instance = await startServer({ cookieName: "custom-auth" });
    const res = await manualFetch(`${instance.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=secret&next=%2Fdashboard",
    });
    await instance.close();

    expect(res.status).toBe(302);
    expect(res.headers.location).toMatch(
      /http:\/\/127\.0\.0\.1:\d+\/dashboard/,
    );
    expect(Array.isArray(res.headers["set-cookie"])).toBe(true);
    expect(res.headers["set-cookie"][0]).toMatch(/^custom-auth=/);
  });

  test("invalid login renders error and 401", async () => {
    const instance = await startServer({ appName: "Actual Auto Stack" });
    const res = await manualFetch(`${instance.baseUrl}/auth/login`, {
      method: "POST",
      headers: {
        "content-type": "application/x-www-form-urlencoded",
      },
      body: "password=wrong&next=%2F",
    });
    await instance.close();

    expect(res.status).toBe(401);
    expect(res.body).toContain("Invalid password");
    expect(res.body).toContain("Actual Auto Stack");
  });
});
