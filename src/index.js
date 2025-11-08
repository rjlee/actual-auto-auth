const { createAuthServer } = require("./server");

function start() {
  try {
    const server = createAuthServer({
      actualPassword: process.env.ACTUAL_PASSWORD,
      sessionSecret: process.env.SESSION_SECRET,
      cookieName: process.env.AUTH_COOKIE_NAME,
      appName: process.env.AUTH_APP_NAME,
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
