#!/usr/bin/env bash
set -euo pipefail

PROJECT_ROOT="$(cd "$(dirname "$0")" && pwd)"
cd "$PROJECT_ROOT"

ORIG_ENV=".env"
TMP_ENV=".env.compose"
BACKUP_ENV=".env.backup.$(date +%s)"

# 1. ensure .env exists
if [ ! -f "$ORIG_ENV" ]; then
  echo "❗ No .env file found in project root. Create one from .env.example and fill values first."
  exit 1
fi

# 2. create a working copy for compose
cp "$ORIG_ENV" "$TMP_ENV"

# 3. remove SEED line if SEED is empty or value is blank
#    handle cases like: "SEED=" or "SEED=   "
if grep -q '^SEED=' "$TMP_ENV"; then
  # read value after =
  seed_val=$(grep '^SEED=' "$TMP_ENV" | head -n1 | cut -d'=' -f2-)
  # Trim whitespace
  seed_val_trimmed="$(echo "$seed_val" | sed -e 's/^[[:space:]]*//' -e 's/[[:space:]]*$//')"
  if [ -z "$seed_val_trimmed" ]; then
    echo "🌱 SEED is blank — removing SEED from env file so docker-compose omits it."
    # remove SEED line(s)
    sed -i.bak '/^SEED=/d' "$TMP_ENV" && rm -f "$TMP_ENV.bak"
  else
    echo "🌱 Using SEED=$seed_val_trimmed"
  fi
else
  echo "🌱 No SEED entry found — will let Bedrock generate a random seed."
fi

# 4. Back up real .env so we can restore it after start
cp "$ORIG_ENV" "$BACKUP_ENV"
echo "🔐 Backed up original $ORIG_ENV to $BACKUP_ENV"

# 5. Replace real .env with .env.compose temporarily (start.js expects .env in root)
cp "$TMP_ENV" "$ORIG_ENV"
echo "🔁 Temporarily swapped in modified env for startup (SEED handled)."

# 6. Run your Node start script (which handles compose up, hashing, restore, tunnels, etc.)
#    Use npm run start so dependencies and env are consistent.
echo "▶️ Running: npm run start"
npm run start

# 7. After start completes, restore the original .env
mv "$BACKUP_ENV" "$ORIG_ENV"
echo "🔁 Restored original $ORIG_ENV from backup."

# 8. Clean up temp files
rm -f "$TMP_ENV"
echo "🧹 Cleaned up temporary files."

echo "✅ Startup complete. If you want to expose via docker-compose directly, run 'docker compose --env-file \"$TMP_ENV\" up -d' instead."
