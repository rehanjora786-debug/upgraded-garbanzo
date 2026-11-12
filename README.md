# Trio Tales — CafeDesk V2

**Brand:** TRIO TALES  
**Tagline:** Every Cup Tells a Tale.  
**Contact:** 9380160062  
**Currency:** INR (₹)

This is the first full-stack foundation for the CafeDesk V2 project. It replaces the prototype's browser-only data approach with a Next.js web app, an Express API, and a MySQL database managed by Prisma.

## Included in this starter

- Next.js App Router frontend (`apps/web`)
- Express REST API (`apps/api`)
- Prisma + MySQL schema for cafes, users, customers, menu, tables, orders, payments, loyalty, rewards, reviews, offers, inventory, suppliers, expenses, reservations and audit logs
- Health-check endpoint
- Starter owner dashboard UI
- Five-coffee loyalty rule represented in the database design
- Environment-variable templates; no real passwords or API keys included

## Requirements

Install:
- Node.js 20 or newer
- MySQL 8 or compatible MySQL server
- npm

## Setup

1. Extract the ZIP.
2. Open a terminal in the project folder.
3. Install dependencies:

   ```bash
   npm install
   ```

4. Create a MySQL database:

   ```sql
   CREATE DATABASE trio_tales_cafedesk;
   ```

5. Copy `.env.example` to `apps/api/.env` and replace `YOUR_PASSWORD`, `JWT_SECRET`, and `SETUP_KEY` with your local values.
6. Generate Prisma Client and create the database tables:

   ```bash
   npm run db:generate
   npm run db:migrate -- --name init
   ```

7. Start the frontend and backend:

   ```bash
   npm run dev
   ```

8. Open:
   - Frontend: http://localhost:3000
   - API health check: http://localhost:4000/api/health

## Project structure

```text
trio-tales-cafedesk-v2/
  apps/
    api/
      prisma/schema.prisma
      src/server.js
      src/routes/health.js
      package.json
    web/
      app/layout.js
      app/page.js
      app/globals.css
      package.json
  .env.example
  package.json
  README.md
```

## Important next build steps

1. Implement secure owner/staff authentication (hashed passwords, short-lived access tokens, refresh/session strategy, rate limiting and role checks).
2. Add cafe-scoped APIs for menu, customers, QR tables, orders and five-stamp rewards.
3. Add billing/payment provider integration only after server-side order totals and payment verification are implemented.

## Security notes

- Never commit `.env` files or secrets.
- Do not store customer records or payment credentials in browser `localStorage`.
- Validate all API input on the server and enforce cafe/role authorization on every protected route.
- Treat payment status as untrusted until verified server-to-server with the payment provider.
- Store only the customer information needed to operate the cafe, and obtain consent before sending marketing messages.
- The current starter is a development foundation, not a production-ready payment or messaging system.

## Current status

The frontend and API foundation are scaffolded. Authentication, live QR ordering, billing, WhatsApp Business API, inventory workflows, analytics and deployment still need implementation and testing.
