"use client";

import { Suspense, useState } from "react";
import { useSearchParams } from "next/navigation";
import { createClient } from "../../../utils/supabase/client";
import styles from "../register.module.css";

function CheckEmailContent() {
  const searchParams = useSearchParams();
  const email = searchParams.get("email") ?? "";
  const [resent, setResent] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
          We&apos;ve sent a confirmation link{email ? <> to <strong>{email}</strong></> : ""}.
          Click it to activate your account and finish setting up your workspace.
        </p>
      </header>

      {error && <p className={styles.errorMsg}>{error}</p>}

      <button
        type="button"
        className={styles.submitButton}
        onClick={handleResend}
        disabled={resending || resent || !email}
      >
        {resending ? "Resending…" : resent ? "Email sent" : "Resend confirmation email"}
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
