
import "dotenv/config";
import { betterAuth } from "better-auth";
import { jwt } from "better-auth/plugins";
import { pool } from "./db/pool.js";

// Validate Better Auth Secret
if (
  !process.env.BETTER_AUTH_SECRET ||
  process.env.BETTER_AUTH_SECRET.length < 32
) {
  throw new Error(
    "BETTER_AUTH_SECRET must be at least 32 characters."
  );
}

// Validate Better Auth URL
if (!process.env.BETTER_AUTH_URL) {
  throw new Error("BETTER_AUTH_URL is required.");
}

// Validate Google OAuth credentials
if (
  !process.env.GOOGLE_CLIENT_ID ||
  !process.env.GOOGLE_CLIENT_SECRET
) {
  console.warn(
    "Google OAuth credentials are missing. Google login is disabled."
  );
}

export const auth = betterAuth({
  appName: "GearGrid",

  baseURL: process.env.BETTER_AUTH_URL,

  secret: process.env.BETTER_AUTH_SECRET,

  trustedOrigins: [
    "http://localhost:3000",
    "http://127.0.0.1:3000"
  ],

  // PostgreSQL Database
  database: pool,

  // Email and Password Authentication
  emailAndPassword: {
    enabled: true,
    minPasswordLength: 6
  },

  // Google Account Linking
  account: {
    accountLinking: {
      enabled: true,
      trustedProviders: ["google"],
      requireLocalEmailVerified: false,
      disableImplicitLinking: false
    }
  },

  // Google OAuth
  socialProviders:
    process.env.GOOGLE_CLIENT_ID &&
    process.env.GOOGLE_CLIENT_SECRET
      ? {
          google: {
            clientId: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET
          }
        }
      : {},

  // Additional User Fields
  user: {
    additionalFields: {
      role: {
        type: "string",
        required: false,
        defaultValue: "Customer",
        input: false
      }
    }
  },

  // JWT Plugin
  plugins: [jwt()]
});
