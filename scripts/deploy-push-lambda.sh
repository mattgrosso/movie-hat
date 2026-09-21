#!/bin/sh
set -e

# Ships aws-lambda/push-notify.js to Lambda `movie-hat-push` (profile
# personal, us-east-1, handler index.handler). Env vars — FIREBASE_SA and the
# VAPID pair — live on the function; this only ever replaces code.
#
# Written 2026-09-20, when per-hat notification settings needed the fan-out
# change shipped and this repo had no script to do it: the function had been
# updated by hand each time. Follows Cinema Roll's recipe rather than
# every-street's, i.e. it starts from the BUNDLE THAT IS DEPLOYED and swaps
# one file in, so a redeploy can never quietly bump web-push to whatever npm
# is serving today.
#
#   sh scripts/deploy-push-lambda.sh

ROOT="$(cd "$(dirname "$0")/.." && pwd)"
# x86 python dies with "Bad CPU type" on this Mac — the arm64 build is the one.
AWS="$HOME/aws-cli/aws"
BUILD="$(mktemp -d)"
trap 'rm -rf "$BUILD"' EXIT

URL=$("$AWS" lambda get-function --function-name movie-hat-push --profile personal \
  --region us-east-1 --query 'Code.Location' --output text)
curl -s -o "$BUILD/current.zip" "$URL"
mkdir -p "$BUILD/bundle"
(cd "$BUILD/bundle" && unzip -q -o ../current.zip)

cp "$ROOT/aws-lambda/push-notify.js" "$BUILD/bundle/index.js"
(cd "$BUILD/bundle" && zip -q -r ../function.zip .)

"$AWS" lambda update-function-code --function-name movie-hat-push \
  --zip-file "fileb://$BUILD/function.zip" --profile personal --region us-east-1 \
  --query 'LastModified' --output text
echo "movie-hat-push updated"
