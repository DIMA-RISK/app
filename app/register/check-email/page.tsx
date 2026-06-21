"use client";

import { Suspense, useState, type FormEvent } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";
import { completeOrgRegistration } from "../actions";
import styles from "../register.module.css";

function CheckEmailContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [code, setCode] = useState("");
  const [verifying, setVerifying] = useState(false);
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleVerify(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!email || !code.trim()) return;
    setVerifying(true);
    setError(null);
    const supabase = createClient();
    const { data: verifyData, error: verifyError } = await supabase.auth.verifyOtp({
      email,
      token: code.trim(),
      type: "signup",
    });
    if (verifyError) {
      setVerifying(false);
      setError(verifyError.message);
      return;
    }

    if (verifyData.user) {
      const { error: orgError } = await completeOrgRegistration(verifyData.user.id);
      setVerifying(false);
      if (orgError) {
        setError(orgError);
        return;
      }
    } else {
      setVerifying(false);
    }

    router.push("/welcome");
  }

  async function handleResend() {
    if (!email) return;
    setResending(true);
    setError(null);
    const supabase = createClient();
    const { error: resendError } = await supabase.auth.resend({
      type: "signup",
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });
    setResending(false);
    if (resendError) {
      setError(resendError.message);
    } else {
      setResent(true);
      setTimeout(() => setResent(false), 8000);
    }
  }

  return (
    <section className={styles.card} style={{ maxWidth: 480, textAlign: "center" }}>
      <header className={styles.header}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />
        <h1 className={styles.title}>Check your email</h1>
        <p className={styles.subtitle}>
          We&apos;ve sent a confirmation code{email ? <> to <strong>{email}</strong></> : ""}.
          Enter it below, or click the link in the email — either works, on any device.
        </p>
      </header>

      <form onSubmit={handleVerify} style={{ display: "grid", gap: "0.75rem", textAlign: "left" }}>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="otp">Confirmation code</label>
          <input
            id="otp"
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

        {error && <p className={styles.errorMsg}>{error}</p>}

        <button type="submit" className={styles.submitButton} disabled={verifying || !code.trim()}>
          {verifying ? "Verifying…" : "Verify and continue"}
        </button>
      </form>

      <button
        type="button"
        className={styles.submitButton}
        style={{ marginTop: "0.75rem", background: "transparent", border: "1px solid rgba(221,215,234,0.25)" }}
        onClick={handleResend}
        disabled={resending || resent || !email}
      >
        {resending ? "Resending…" : resent ? "Email sent" : "Resend code"}
      </button>

      <p className={styles.loginLink}>
        Already confirmed?{" "}
        <a href="/login" className={styles.link}>Log in</a>
      </p>
    </section>
  );
}

export default function CheckEmailPage() {
  return (
    <main className={styles.page}>
      <Suspense fallback={null}>
        <CheckEmailContent />
      </Suspense>
    </main>
  );
}
