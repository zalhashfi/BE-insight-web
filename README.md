# Insight Web Backend

This is the backend API for the Insight Laboratory Web Platform. It is a modern, serverless API built on Cloudflare Workers using the Hono web framework. It handles user authentication, IoT data ingestion, ticketing, and station management using a MySQL database via Drizzle ORM.

## Key Features

- **Serverless Architecture**: Built on Cloudflare Workers for global scalability and low latency.
- **Fast Web Framework**: Powered by Hono, optimized for edge environments.
- **Type-Safe Database Access**: Uses Drizzle ORM with MySQL 2.
- **Secure Authentication**: Implements JWT (JSON Web Tokens) and bcrypt for password hashing.
- **Edge Data Storage**: Uses Cloudflare KV for rate limiting and Hyperdrive for fast database connection pooling.
- **Validation**: Strict runtime validation of requests and responses using Zod.

## Tech Stack

- **Language**: TypeScript
- **Framework**: Hono
- **ORM**: Drizzle ORM
- **Database**: MySQL (Production database connected via Cloudflare Hyperdrive)
- **Deployment**: Cloudflare Workers (via Wrangler)

## Prerequisites

- Node.js (v18 or higher recommended)
- `npm`, `yarn`, or `pnpm`
- Cloudflare Wrangler CLI (`npm install -g wrangler`)
- A local or remote MySQL database

## Getting Started

### 1. Clone the Repository

If you are just working on the backend, change directory to the backend folder:

```bash
cd backend
```

### 2. Install Dependencies

```bash
npm install
# or
yarn install
```

### 3. Environment Setup

For local development, create a `.dev.vars` file in the root of the backend directory. This file is ignored by Git and should contain your sensitive local variables.

```bash
cp .dev.vars.example .dev.vars
```

Configure your `.dev.vars` (or `.env`) file:

| Variable | Description |
|---|---|
| `DATABASE_URL` | Your MySQL database connection string (e.g., `mysql://user:pass@localhost:3306/biru_langit`) |
| `JWT_SECRET` | Secret key for signing JWT tokens |

### 4. Database Setup

Ensure your local MySQL server is running. Then, push your schema to the database using Drizzle Kit:

```bash
# Generate and push Drizzle migrations
npx drizzle-kit push
```

If you need to generate migrations manually:

```bash
npx drizzle-kit generate
```

### 5. Start Development Server

Run the local development server using Cloudflare Wrangler:

```bash
npm run dev
# or
yarn dev
```

This will start a local server, usually accessible at `http://localhost:8787`.

## Architecture

### Directory Structure

```
backend/
├── src/
│   ├── routes/        # API route handlers (auth, iot, stations, etc.)
│   ├── index.ts       # Main entry point, middleware setup, Hono app definition
│   └── ...
├── drizzle/           # Database migrations and schema definitions
├── .dev.vars          # Local development secrets
├── drizzle.config.ts  # Drizzle ORM configuration
├── package.json       # Project dependencies and scripts
├── tsconfig.json      # TypeScript configuration
└── wrangler.jsonc     # Cloudflare Workers configuration
```

### Key Components

- **Global Middleware**: CORS, secure headers, logger, and database connection middleware.
- **Rate Limiting**: Implemented using Cloudflare KV bindings.
- **Database Connection**: The `db` middleware smartly falls back to `DATABASE_URL` for local development or uses Cloudflare `HYPERDRIVE` for optimized production pooling.
- **JWT Authentication**: Protects secure routes via middleware that reads from the `JWT_SECRET` binding.

## Available Scripts

| Command | Description |
|---|---|
| `npm run dev` | Start the local development server via Wrangler |
| `npm run deploy` | Deploy the application to Cloudflare Workers |
| `npm run cf-typegen` | Generate Cloudflare Bindings type definitions from `wrangler.jsonc` |

## Deployment

This project is deployed to Cloudflare Workers.

### 1. Configure Cloudflare

Ensure you have authenticated your Wrangler CLI:

```bash
npx wrangler login
```

### 2. Configure Secrets

Before deploying, ensure production secrets are set via Wrangler:

```bash
npx wrangler secret put DATABASE_URL
npx wrangler secret put JWT_SECRET
```

### 3. Deploy

Deploy the application:

```bash
npm run deploy
```

The application will be deployed and minified automatically.
