#!/bin/bash
export PATH="/opt/homebrew/bin:/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:$PATH"
export PORT="${PORT:-3001}"
cd "${HOMESERVER_DIR:-$HOME/.homeserver}"
NODE_BIN="$(command -v node || echo /opt/homebrew/bin/node)"
exec "$NODE_BIN" server.js
