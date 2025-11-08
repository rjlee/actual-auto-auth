function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderLoginPage({ appName, error = "", next = "/" }) {
  const safeName = escapeHtml(appName);
  const safeError = error
    ? `<div class="alert alert-danger text-center">${escapeHtml(error)}</div>`
    : "";
  const safeNext = escapeHtml(next);

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeName}</title>
    <link
      href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css"
      rel="stylesheet"
      integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH"
      crossorigin="anonymous"
    />
  </head>
  <body class="bg-light">
    <div class="container py-5">
      <div class="row justify-content-center">
        <div class="col-md-4">
          <div class="card shadow-sm">
            <div class="card-body">
              <h1 class="h4 text-center mb-4">${safeName}</h1>
              ${safeError}
              <form method="post" action="/auth/login">
                <input type="hidden" name="next" value="${safeNext}" />
                <div class="mb-3">
                  <input
                    type="password"
                    class="form-control"
                    name="password"
                    placeholder="Password"
                    autofocus
                  />
                </div>
                <button type="submit" class="btn btn-primary w-100">Continue</button>
              </form>
            </div>
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

module.exports = {
  renderLoginPage,
};
