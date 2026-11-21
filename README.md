
# GearGrid — Equipment Rental Platform

A full-stack assignment starter built with Next.js App Router, Express, PostgreSQL (Neon), Better Auth, JWT, and Stripe. MongoDB is not used.

## Requirements
- Node.js 20.9+ (recommended current LTS)
- Neon PostgreSQL project
- Google OAuth credentials (optional until Google sign-in is used)
- Stripe account and test keys
- imgbb API key

## 1. Install
Open two terminals.

Terminal A:
```bash
cd server
npm install
cp .env.example .env
```
Fill `server/.env` secrets (see below), then:
```bash
npm run db:setup
npm run dev
```

Terminal B:
```bash
cd client
npm install
cp .env.example .env.local
npm run dev
```
Open http://localhost:3000

## 2. Secrets you must provide
### server/.env
- `DATABASE_URL`: Neon pooled connection string (host normally contains `-pooler`; keep `sslmode=require`)
- `BETTER_AUTH_SECRET`: random secret, at least 32 characters
- `BETTER_AUTH_URL`: `http://localhost:5000`
- `CLIENT_URL`: `http://localhost:3000`
- `GOOGLE_CLIENT_ID` and `GOOGLE_CLIENT_SECRET`: Google OAuth credentials
- `STRIPE_SECRET_KEY` and `STRIPE_WEBHOOK_SECRET`: Stripe test credentials
- `IMGBB_API_KEY`: imgbb API key
- `ADMIN_EMAIL`: email address that should receive the admin role after registering

### client/.env.local
- `NEXT_PUBLIC_API_URL=http://localhost:5000`
- `NEXT_PUBLIC_AUTH_URL=http://localhost:5000`
- `NEXT_PUBLIC_IMGBB_API_KEY`: same imgbb key (only used for browser upload)

Never commit `.env` or `.env.local`. The supplied `.gitignore` excludes them.

## 3. Database
`npm run db:setup` creates the application tables. Better Auth creates its own user/session/account/verification/JWKS tables with:
```bash
npm run auth:migrate
```
Run both commands after setting `DATABASE_URL`.

For Neon, copy the pooled connection string from Console > Connect. Use a direct (non-pooled) string only for migration tooling if the provider/tooling requires it.

## 4. Google OAuth
In Google Cloud Console create OAuth 2.0 Web credentials:
- Authorized JavaScript origin: `http://localhost:3000`
- Authorized redirect URI: `http://localhost:5000/api/auth/callback/google`
Set the client ID and secret in `server/.env`. For production, add your deployed domains and use the production callback URL.

## 5. Stripe
Use Stripe test keys. Configure webhook endpoint:
`http://localhost:5000/api/payments/webhook`
For local webhook testing use Stripe CLI and forward events to that URL. Set `STRIPE_WEBHOOK_SECRET` from the CLI output. Payment success is confirmed by the webhook, not by trusting a browser redirect.

## 6. First admin
Register using the email in `ADMIN_EMAIL`. The backend promotes that account to Admin on first successful authenticated request. Never expose the admin email setting in client-side code.

## 7. Deployment
Deploy `client` and `server` separately. Set all environment variables in each host. Update:
- `CLIENT_URL`
- `BETTER_AUTH_URL`
- `NEXT_PUBLIC_API_URL`
- `NEXT_PUBLIC_AUTH_URL`
- Google OAuth redirect URI
- Stripe webhook endpoint

Use HTTPS in production. Configure CORS to the exact client origin. Ensure both services are running before testing routes.

## Included features
- Better Auth email/password and Google OAuth, PostgreSQL adapter, JWT plugin
- Customer / Owner / Admin roles and protected API middleware
- Equipment create/update/delete, pending/approved/rejected moderation
- Search, category, availability, rental-type and price filtering + sorting + pagination API
- Favorites, rental bookings, Stripe Checkout and webhook payment recording
- Customer, Owner and Admin dashboard endpoints
- Responsive Next.js interface, home page, equipment catalogue, sign in/up and dashboard shell
- Loading and not-found UI, seed equipment data

## Important honest notes
This is a complete runnable foundation with the core assignment flows and backend APIs. You must still add your own meaningful client/server Git commits, deploy both services, configure third-party secrets, test the production URLs, and record your own admin credentials. No generated project can honestly guarantee 60/60 marks: grading also depends on the evaluator, visual originality, successful deployment, video requirements, and the required 20 client + 12 server commits. Review the code and test every flow before submission.
