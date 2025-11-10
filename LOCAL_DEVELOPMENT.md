# Local Development with Firebase Emulators

This guide explains how to run the application locally using Firebase Emulators, so you can test changes without affecting the production database.

## Prerequisites

1. **Node.js 22+** installed
2. **Firebase CLI** installed globally:
   ```bash
   npm install -g firebase-tools
   ```
3. **Google Cloud SDK** (for API server authentication):
   ```bash
   gcloud auth application-default login
   ```

## Quick Start

### 1. Start Firebase Emulators

In the project root, run:
```bash
npm run emulators
```

This starts:
- **Firestore Emulator** on port `8081`
- **Auth Emulator** on port `9099`
- **Storage Emulator** on port `9199`
- **Functions Emulator** on port `5001`
- **Emulator UI** on port `4000` (http://localhost:4000)

The Emulator UI lets you:
- View and edit Firestore data
- Manage Auth users
- View function logs
- Export/import emulator data

### 2. Start the API Server (with emulator support)

In a new terminal, from the `gigin-api` directory:
```bash
cd gigin-api
npm run dev:emulator
```

This starts the Express API server on port `8080` with emulator environment variables set. You should see:
```
🔥 Using Firebase Emulators
   Firestore: 127.0.0.1:8081
   Auth: 127.0.0.1:9099
```

**Important**: Use `npm run dev:emulator` (not `npm run dev`) to connect to emulators. The regular `npm run dev` will connect to the real Firebase project.

### 3. Start the Frontend

In another terminal, from the project root:
```bash
npm run dev
```

The frontend will automatically connect to the emulators when running in development mode.

## Port Summary

- **Frontend (Vite)**: Usually `5173` (auto-assigned)
- **API Server**: `8080`
- **Firestore Emulator**: `8081`
- **Auth Emulator**: `9099`
- **Storage Emulator**: `9199`
- **Functions Emulator**: `5001`
- **Emulator UI**: `4000`

## Environment Variables

The frontend automatically connects to emulators in development mode. To disable emulator connection, set:
```bash
VITE_USE_EMULATORS=false
```

The API server detects emulators via environment variables:
- `FIRESTORE_EMULATOR_HOST=127.0.0.1:8081`
- `FIREBASE_AUTH_EMULATOR_HOST=127.0.0.1:9099`

These are automatically set when using `npm run dev:emulator` in the `gigin-api` directory.

## Exporting/Importing Emulator Data

### Export emulator data:
```bash
npm run emulators:export
```

This saves the current emulator state to `./firebase-export/`

### Start emulators with imported data:
```bash
npm run emulators:import
```

This starts emulators and loads data from `./firebase-export/`

## Troubleshooting

### Port conflicts
If you see port conflicts:
- Check which process is using the port: `lsof -i :PORT_NUMBER`
- Kill the process or change the port in `firebase.json`

### Emulators not connecting
- Ensure emulators are running (`npm run emulators`)
- Check browser console for connection errors
- Verify `VITE_USE_EMULATORS` is not set to `false`

### API server not connecting to emulators
- Ensure you're using `npm run dev:emulator` (not `npm run dev`)
- Check that `FIRESTORE_EMULATOR_HOST` and `FIREBASE_AUTH_EMULATOR_HOST` are set
- Verify emulators are running

## Development Workflow

1. **Start emulators** (one terminal): `npm run emulators`
2. **Start API server** (another terminal): `cd gigin-api && npm run dev:emulator`
3. **Start frontend** (another terminal): `npm run dev`
4. **Make changes** - they'll be reflected immediately
5. **View data** - open Emulator UI at http://localhost:4000

## Notes

- Emulator data is in-memory by default (lost when emulators stop)
- Use export/import to persist data between sessions
- The emulators use a separate project ID (usually `demo-test` or similar)
- Production data is never affected when using emulators

