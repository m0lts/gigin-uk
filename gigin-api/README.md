# Gigin API Server

Cloud Run server for Gigin API endpoints, migrated from Firebase Cloud Functions.

## Local Development

### Prerequisites
- Node.js 22+
- Google Cloud SDK (`gcloud`)
- Firebase Admin credentials

### Setup

1. Install dependencies:
```bash
npm install
```

2. Authenticate with Google Cloud (for Firebase Admin SDK):
```bash
gcloud auth application-default login
```

3. Set environment variables:
   
   For **development** (uses `giginltd-dev` project):
   ```bash
   export GCLOUD_PROJECT=giginltd-dev
   export NODE_ENV=development
   export PORT=8080
   ```
   
   For **production** (uses `giginltd-16772` project):
   ```bash
   export GCLOUD_PROJECT=giginltd-16772
   export NODE_ENV=production
   export PORT=8080
   ```

   Or create a `.env` file in the `gigin-api/` directory:
   ```bash
   GCLOUD_PROJECT=giginltd-dev
   NODE_ENV=development
   PORT=8080
   ```

4. Run the server:
```bash
npm run dev
```

The server will automatically detect the project from `GCLOUD_PROJECT` and initialize Firebase Admin with the correct project. You'll see logs indicating which project is being used.

## Building Docker Image

```bash
# From project root
docker build -t gigin-api:latest -f gigin-api/Dockerfile .
```

## Running Docker Container Locally

```bash
docker run -p 8080:8080 \
  -e GCLOUD_PROJECT=your-project-id \
  -e PORT=8080 \
  --env-file .env \
  gigin-api:latest
```

## Security Features

- Helmet.js for security headers
- Rate limiting (100 requests per 15 minutes per IP)
- CORS protection
- Firebase ID token verification
- Non-root user in Docker container
- Request size limits (10MB)

## Deployment to Cloud Run

See deployment scripts in project root or CI/CD configuration.
