#!/usr/bin/env sh
set -eu

PORT="${PORT:-4000}"

node <<'EOF'
const port = process.env.PORT || 4000;
const url = `http://127.0.0.1:${port}/auth/login`;
fetch(url, { method: 'HEAD' })
  .then((res) => {
    if (!res.ok) {
      process.exit(1);
    }
    process.exit(0);
  })
  .catch(() => process.exit(1));
EOF
