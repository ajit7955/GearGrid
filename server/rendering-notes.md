# Backend route notes

- Better Auth handles registration, email/password login, Google OAuth, sessions and JWT/JWKS.
- The API uses Better Auth session validation in Express. The JWT plugin exposes `/api/auth/token` and `/api/auth/jwks`.
- Application data is stored in PostgreSQL. No MongoDB driver or MongoDB adapter is included.
- Stripe webhook is the authoritative payment confirmation path.
