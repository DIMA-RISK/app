"use client";

import React, { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";
import styles from "./login.module.css";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithPassword({ email, password });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    router.push("/welcome");
  }

  async function handleMicrosoftLogin() {
    setError(null);
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "azure",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) setError(error.message);
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />
        <h1 className={styles.title}>Log In</h1>

        <form onSubmit={handleSubmit}>
          <div className={styles.inputGroup}>
            <label className={styles.label}>Email</label>
            <input
              type="email"
              className={styles.input}
              placeholder="name@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className={styles.inputGroup}>
            <label className={styles.label}>Password</label>
            <input
              type="password"
              className={styles.input}
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
            />
            <p style={{ textAlign: "right", marginTop: "0.5rem" }}>
              <a href="/forgot-password" className={styles.link} style={{ fontSize: "0.82rem" }}>
                Forgot password?
              </a>
            </p>
          </div>

          {error && <p className={styles.error}>{error}</p>}

          <button type="submit" className={styles.loginButton} disabled={loading}>
            {loading ? "Signing in…" : "Log In"}
          </button>

          <div style={{ textAlign: "center", margin: "1rem 0", color: "rgba(221, 215, 234, 0.5)", fontSize: "0.8rem" }}>
            OR
          </div>

          <button type="button" className={styles.ssoButton} onClick={handleMicrosoftLogin}>
            <svg width="20" height="20" viewBox="0 0 23 23">
              <rect x="1" y="1" width="10" height="10" fill="#F25022"/>
              <rect x="12" y="1" width="10" height="10" fill="#7FBA00"/>
              <rect x="1" y="12" width="10" height="10" fill="#00A4EF"/>
              <rect x="12" y="12" width="10" height="10" fill="#FFB900"/>
            </svg>
            Continue with Microsoft
          </button>

          <p className={styles.registerLink}>
            Don&apos;t have an account?{" "}
            <a href="/register" className={styles.link}>Create one</a>
          </p>
        </form>
      </div>
    </main>
  );
}
