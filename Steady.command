#!/bin/zsh
# Double click this file to read today's edition.
# Keep this window open while you read. Closing it stops the reader.

export PATH="$HOME/.local/node/bin:$PATH"
cd "$(dirname "$0")" || exit 1

PORT=5182

# If it is already running, just open it again.
if lsof -ti :$PORT >/dev/null 2>&1; then
  open "http://localhost:$PORT"
  echo "Steady was already running. Opening it."
  exit 0
fi

echo "Assembling today's edition. This takes about a minute the first time each day."
PORT=$PORT node server.js &
SERVER=$!

# Wait for the page to answer before opening the browser.
for i in {1..90}; do
  if curl -s -o /dev/null -m 2 "http://localhost:$PORT/api/sources"; then
    open "http://localhost:$PORT"
    break
  fi
  sleep 1
done

echo ""
echo "Steady is reading at http://localhost:$PORT"
echo "Leave this window open. Close it when you are done."
wait $SERVER
