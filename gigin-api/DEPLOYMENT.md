# Cloud Run Deployment Guide

## Prerequisites

1. **Google Cloud Service Account Key**
   - Create a service account in GCP with the following roles:
     - Cloud Run Admin
     - Service Account User
     - Storage Admin (for Cloud Build)
     - Secret Manager Secret Accessor (for accessing secrets)
   - Generate a JSON key for the service account
   - Add it to GitHub Secrets as `GCP_SA_KEY_DEV`

2. **Secrets in Google Cloud Secret Manager**
   - Ensure these secrets exist in Secret Manager:
     - `STRIPE_PRODUCTION_KEY`
     - `STRIPE_TEST_KEY`
     - `STRIPE_PROD_WEBHOOK`
     - `STRIPE_WEBHOOK_SECRET`

## Initial Deployment (One-time Setup)

### Option 1: Deploy via GitHub Actions (Recommended)

1. **Push your branch:**
   ```bash
   git push origin feature/server-migration
   ```

2. **Workflow will automatically trigger** on push to `feature/server-migration` or `staging` branches

3. **Or trigger manually:**
   - Go to GitHub → Actions → "Deploy Cloud Run API (dev)"
   - Click "Run workflow"

### Option 2: Deploy via gcloud CLI (For testing)

```bash
# Authenticate
gcloud auth login
gcloud config set project giginltd-dev

# Build and deploy
cd gigin-api
gcloud builds submit --tag gcr.io/giginltd-dev/gigin-api-staging --config cloudbuild.yaml
```

## After Deployment

1. **Get the Cloud Run URL:**
   ```bash
   gcloud run services describe gigin-api-staging \
     --region europe-west3 \
     --project giginltd-dev \
     --format 'value(status.url)'
   ```

2. **Update your `.env.development` file:**
   ```bash
   VITE_API_URL=https://gigin-api-staging-xxxxx-ew.a.run.app
   ```

3. **Update Firebase Hosting rewrites** (if needed):
   - In `firebase.json`, add rewrites to proxy `/api/**` to Cloud Run URL

## Testing the Deployment

```bash
# Test health endpoint
curl https://gigin-api-staging-xxxxx-ew.a.run.app/health

# Test sendMessage (requires auth token)
curl -X POST https://gigin-api-staging-xxxxx-ew.a.run.app/api/messages/sendMessage \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer YOUR_FIREBASE_TOKEN" \
  -d '{
    "conversationId": "test-conv-id",
    "message": {
      "senderId": "user-id",
      "text": "Test message"
    }
  }'
```

## Updating the Service

The GitHub Actions workflow will automatically deploy on every push to `feature/server-migration` or `staging` branches.

To manually trigger:
- Go to GitHub Actions → "Deploy Cloud Run API (dev)" → "Run workflow"

## Monitoring

- **Logs:** `gcloud run services logs read gigin-api-staging --region europe-west3`
- **Console:** https://console.cloud.google.com/run/detail/europe-west3/gigin-api-staging
- **Metrics:** Cloud Run → Service → Metrics tab

