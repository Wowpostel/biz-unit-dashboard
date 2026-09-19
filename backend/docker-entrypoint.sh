#!/bin/sh
set -e
npx prisma db push
if [ "${SKIP_SEED}" != "1" ]; then
  npm run seed || true
fi
exec node dist/main.js
