const DEFAULT_TITLE = "Actual Automation Stack";

function escapeHtml(value = "") {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function renderHomePage({ title = DEFAULT_TITLE, links = [] } = {}) {
  const safeTitle = escapeHtml(title || DEFAULT_TITLE);
  const linkItems = links
    .map(({ name, href }) => ({
      name: escapeHtml(name),
      href: escapeHtml(href),
    }))
    .map(
      ({ name, href }) => `
          <li class="list-group-item d-flex justify-content-between align-items-center">
            <a class="fw-semibold" href="${href}">${name}</a>
            <span class="text-muted small">${href}</span>
          </li>`,
    )
    .join("");

  const listMarkup =
    linkItems.trim().length > 0
      ? `<ul class="list-group list-group-flush">${linkItems}
        </ul>`
      : `<div class="alert alert-info mb-0">
            No stack applications are currently linked. Update <code>STACK_NAV_LINKS</code> in your .env file to add shortcuts.
         </div>`;

  return `<!doctype html>
<html lang="en">
  <head>
    <meta charset="utf-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1" />
    <title>${safeTitle}</title>
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
        <div class="col-lg-6">
          <div class="card shadow-sm">
            <div class="card-body">
              <h1 class="h4 mb-3">${safeTitle}</h1>
              <p class="text-muted">
                Choose an application below to continue.
              </p>
            </div>
            ${listMarkup}
          </div>
        </div>
      </div>
    </div>
  </body>
</html>`;
}

module.exports = {
  DEFAULT_TITLE,
  renderHomePage,
};
