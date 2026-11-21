
"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import toast from "react-hot-toast";
import { authClient } from "@/lib/auth-client";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [googleBusy, setGoogleBusy] = useState(false);

  const router = useRouter();

  // Email and Password Login
  async function submit(e) {
    e.preventDefault();
    setBusy(true);

    try {
      const { error } = await authClient.signIn.email({
        email,
        password
      });

      if (error) {
        toast.error(error.message || "Login failed");
        return;
      }

      toast.success("Welcome back!");

      router.replace("/dashboard");
      router.refresh();
    } catch (error) {
      toast.error(error.message || "Login failed");
    } finally {
      setBusy(false);
    }
  }

  // Google Login
  async function google() {
    setGoogleBusy(true);

    try {
      const { error } = await authClient.signIn.social({
        provider: "google",
        callbackURL: "http://localhost:3000/dashboard",
        errorCallbackURL: "http://localhost:3000/login"
      });

      if (error) {
        toast.error(error.message || "Google login failed");
        setGoogleBusy(false);
      }
    } catch (error) {
      toast.error(error.message || "Google login failed");
      setGoogleBusy(false);
    }
  }

  return (
    <main className="form-wrap">
      <div className="eyebrow">Welcome back</div>

      <h1>Sign in</h1>

      <p className="muted">
        Continue to your GearGrid account.
      </p>

      <form onSubmit={submit}>
        <div className="field">
          <label>Email</label>

          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Password</label>

          <input
            type="password"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
          />
        </div>

        <button
          className="btn"
          style={{ width: "100%" }}
          disabled={busy || googleBusy}
        >
          {busy ? "Signing in..." : "Sign in"}
        </button>
      </form>

      <button
        className="btn outline"
        style={{ width: "100%", marginTop: 12 }}
        onClick={google}
        disabled={busy || googleBusy}
      >
        {googleBusy ? "Connecting to Google..." : "Continue with Google"}
      </button>

      <p className="muted">
        New here?{" "}
        <Link
          href="/register"
          style={{ color: "var(--green)", fontWeight: 800 }}
        >
          Create an account
        </Link>
      </p>
    </main>
  );
}
