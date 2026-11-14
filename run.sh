#!/usr/bin/env bash
set -euo pipefail
ROOT="$(cd "$(dirname "$0")" && pwd)"
if ! command -v node >/dev/null 2>&1; then echo "Node.js 22.12 or newer is required." >&2; exit 1; fi
node -e 'const [major, minor] = process.versions.node.split(".").map(Number); if (major < 22 || (major === 22 && minor < 12)) { console.error("Node.js 22.12 or newer is required."); process.exit(1); }'
cd "$ROOT/frontend"
if [ ! -d node_modules ]; then npm install; fi
npm run build
cd "$ROOT/backend"
if [ ! -d .venv ]; then python3 -m venv .venv; fi
source .venv/bin/activate
python -m pip install --upgrade pip
python -m pip install -r requirements.txt
if [ ! -f .env ]; then cp .env.example .env; fi
printf '\nRIFT Arena: http://127.0.0.1:8000\nAPI reference: http://127.0.0.1:8000/api/docs\n\n'
exec uvicorn main:app --reload --env-file .env --port 8000
