
import "dotenv/config";
import express from "express";
import cors from "cors";
import helmet from "helmet";
import morgan from "morgan";
import Stripe from "stripe";

import { auth } from "./auth.js";
import { toNodeHandler } from "better-auth/node";
import api from "./routes/api.js";
import { pool } from "./db/pool.js";

const app = express();

app.set("trust proxy", 1);

// ------------------------------------
// CORS CONFIGURATION
// ------------------------------------

const allowedOrigins = [
  process.env.CLIENT_URL,
  process.env.CLIENT_URL_LOCAL,
  "http://localhost:3000",
  "http://127.0.0.1:3000",
  "http://192.168.0.198:3000"
].filter(Boolean);

const corsOptions = {
  origin: (origin, callback) => {
    // Allow requests without an Origin header
    if (!origin || allowedOrigins.includes(origin)) {
      return callback(null, true);
    }

    return callback(new Error(`CORS blocked origin: ${origin}`));
  },

  credentials: true,

  exposedHeaders: ["set-auth-jwt"]
};

// Security headers
app.use(
  helmet({
    crossOriginResourcePolicy: {
      policy: "cross-origin"
    }
  })
);

// CORS middleware also handles OPTIONS preflight requests
app.use(cors(corsOptions));

// ------------------------------------
// BETTER AUTH
// ------------------------------------

app.all("/api/auth/*splat", toNodeHandler(auth));

// ------------------------------------
// STRIPE WEBHOOK
// Keep this BEFORE express.json()
// ------------------------------------

app.post(
  "/api/payments/webhook",
  express.raw({ type: "application/json" }),
  async (req, res) => {
    let client;

    try {
      if (
        !process.env.STRIPE_SECRET_KEY ||
        !process.env.STRIPE_WEBHOOK_SECRET
      ) {
        return res.status(503).send("Stripe webhook is not configured");
      }

      const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

      const event = stripe.webhooks.constructEvent(
        req.body,
        req.headers["stripe-signature"],
        process.env.STRIPE_WEBHOOK_SECRET
      );

      if (event.type === "checkout.session.completed") {
        const session = event.data.object;
        const bookingId = session.metadata?.bookingId;
        const customerId = session.metadata?.customerId;

        if (bookingId) {
          client = await pool.connect();

          try {
            await client.query("BEGIN");

            await client.query(
              `UPDATE bookings
               SET payment_status = 'Paid',
                   booking_status = 'Confirmed'
               WHERE id = $1`,
              [bookingId]
            );

            await client.query(
              `INSERT INTO payments (
                booking_id,
                customer_id,
                stripe_session_id,
                stripe_payment_intent,
                amount,
                currency,
                status
              )
              VALUES ($1, $2, $3, $4, $5, $6, 'Paid')
              ON CONFLICT (stripe_session_id) DO NOTHING`,
              [
                bookingId,
                customerId,
                session.id,
                session.payment_intent,
                Number(session.amount_total || 0) / 100,
                session.currency || "usd"
              ]
            );

            await client.query("COMMIT");
          } catch (error) {
            await client.query("ROLLBACK");
            throw error;
          } finally {
            client.release();
            client = null;
          }
        }
      }

      return res.json({ received: true });

    } catch (error) {
      console.error("Stripe webhook error:", error.message);

      return res.status(400).send(
        `Webhook Error: ${error.message}`
      );

    } finally {
      if (client) {
        client.release();
      }
    }
  }
);

// ------------------------------------
// GENERAL MIDDLEWARE
// ------------------------------------

app.use(express.json({ limit: "2mb" }));

app.use(morgan("dev"));

// ------------------------------------
// API ROUTES
// ------------------------------------

app.use("/api", api);

// ------------------------------------
// ERROR HANDLER
// ------------------------------------

app.use((err, req, res, next) => {
  console.error("Server Error:", err);

  res.status(err.status || 500).json({
    message: err.message || "Internal server error"
  });
});

// ------------------------------------
// SERVER START
// ------------------------------------

const port = process.env.PORT || 5000;

app.listen(port, "0.0.0.0", () => {
  console.log(`GearGrid API listening on port ${port}`);
});
