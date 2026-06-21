"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "../../utils/supabase/client";
import styles from "../login/login.module.css";

export default function ForgotPasswordPage() {
  const router = useRouter();
  const [step, setStep] = useState<"request" | "sent">("request");
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resent, setResent] = useState(false);

  async function sendResetEmail(targetEmail: string) {
    const supabase = createClient();
    return supabase.auth.resetPasswordForEmail(targetEmail, {
      redirectTo: `${window.location.origin}/auth/callback?next=/reset-password`,
    });
  }

  async function handleRequest(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: resetError } = await sendResetEmail(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
      return;
    }
    setStep("sent");
  }

  async function handleVerify(e: FormEvent) {
    e.preventDefault();
    if (!code.trim()) return;
    setError(null);
    setLoading(true);
    const supabase = createClient();
    const { error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "recovery",
    });
    setLoading(false);
    if (verifyError) {
      setError(verifyError.message);
      return;
    }
    router.push("/reset-password");
  }

  async function handleResend() {
    setError(null);
    setLoading(true);
    const { error: resetError } = await sendResetEmail(email);
    setLoading(false);
    if (resetError) {
      setError(resetError.message);
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 8000);
    }
  }

  return (
    <main className={styles.container}>
      <div className={styles.card}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />

        {step === "request" ? (
          <>
            <h1 className={styles.title} style={{ fontSize: "1.6rem" }}>Reset your password</h1>
            <p style={{ color: "rgba(221,215,234,0.6)", fontSize: "0.85rem", textAlign: "center", margin: "-1rem 0 1.5rem" }}>
              Enter your account email and we&apos;ll send you a code to reset your password.
            </p>
            <form onSubmit={handleRequest}>
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

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.loginButton} disabled={loading}>
                {loading ? "Sending…" : "Send reset code"}
              </button>
            </form>
          </>
        ) : (
          <>
            <h1 className={styles.title} style={{ fontSize: "1.6rem" }}>Check your email</h1>
            <p style={{ color: "rgba(221,215,234,0.6)", fontSize: "0.85rem", textAlign: "center", margin: "-1rem 0 1.5rem" }}>
              We&apos;ve sent a reset code to <strong>{email}</strong>. Enter it below, or click the link in the email — either works, on any device.
            </p>
            <form onSubmit={handleVerify}>
              <div className={styles.inputGroup}>
                <label className={styles.label}>Reset code</label>
                <input
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  className={styles.input}
                  placeholder="123456"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  required
                />
              </div>

              {error && <p className={styles.error}>{error}</p>}

              <button type="submit" className={styles.loginButton} disabled={loading || !code.trim()}>
                {loading ? "Verifying…" : "Verify code"}
              </button>
            </form>

            <button
              type="button"
              className={styles.googleButton}
              onClick={handleResend}
              disabled={loading || resent}
            >
              {resent ? "Email sent" : "Resend code"}
            </button>
          </>
        )}

        <p className={styles.registerLink}>
          Remembered your password?{" "}
          <a href="/login" className={styles.link}>Log in</a>
        </p>
      </div>
    </main>
  );
}
