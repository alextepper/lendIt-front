# LendIt Frontend

## Environment

Copy `.env.example` to `.env.development` and set values.

```bash
cp .env.example .env.development
```

## Dev

```bash
npm install
npm run dev
```

## Build

```bash
npm run build
npm run preview
```

## Testing

### Unit Tests

```bash
npm run test        # Run tests once
npm run test:ui     # Run tests in watch mode with UI
```

### E2E Tests

```bash
npm run cy:open     # Open Cypress UI
npm run cy:run      # Run Cypress headlessly
```

### Full CI Pipeline

```bash
npm run ci          # Build + test + e2e
```

## Docker

Build and run the production image:

```bash
docker build -t lendit-frontend .
docker run -p 8080:80 --name lendit lendit-frontend
```

## Production Deployment

The app is configured for production with:

- Optimized Vite build
- Nginx serving with SPA routing
- API proxy to backend service
- Docker multi-stage build for minimal image size
