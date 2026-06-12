#!/usr/bin/env bash
# Full deploy: API service + collector job + digest job + newsletter job
# Run from repo root: ./deploy.sh
set -e

REGION="europe-west1"
PROJECT="gen-lang-client-0439364318"
REPO="cloud-run-source-deploy"
SERVICE="markttrends-api"
COLLECTOR="markttrends-collector"
DIGEST="markttrends-digest"
NEWSLETTER="markttrends-newsletter"
IMAGE="$REGION-docker.pkg.dev/$PROJECT/$REPO/$SERVICE"

echo "==> Building & pushing Docker image..."
/Users/paulbruckberger/google-cloud-sdk/bin/gcloud builds submit \
  --tag "$IMAGE:latest" \
  --project "$PROJECT" \
  .

echo "==> Deploying API service..."
/Users/paulbruckberger/google-cloud-sdk/bin/gcloud run deploy "$SERVICE" \
  --image "$IMAGE:latest" \
  --region "$REGION" \
  --project "$PROJECT"

echo "==> Updating collector job..."
/Users/paulbruckberger/google-cloud-sdk/bin/gcloud run jobs update "$COLLECTOR" \
  --image "$IMAGE:latest" \
  --region "$REGION" \
  --project "$PROJECT"

echo "==> Updating digest job..."
/Users/paulbruckberger/google-cloud-sdk/bin/gcloud run jobs update "$DIGEST" \
  --image "$IMAGE:latest" \
  --region "$REGION" \
  --project "$PROJECT"

echo "==> Updating newsletter job..."
/Users/paulbruckberger/google-cloud-sdk/bin/gcloud run jobs update "$NEWSLETTER" \
  --image "$IMAGE:latest" \
  --region "$REGION" \
  --project "$PROJECT"

echo ""
echo "✅ Deploy complete. Service: https://markttrends-api-281138265305.europe-west1.run.app"
