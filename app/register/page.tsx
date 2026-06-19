"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { COUNTRY_LIST, type CountryOption } from "../../utils/countries";
import { createClient } from "../../utils/supabase/client";
import { registerOrganization } from "./actions";
import styles from "./register.module.css";

function codeToFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function RegisterPage() {
  const router = useRouter();
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(null);
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryFieldRef = useRef<HTMLDivElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) return COUNTRY_LIST;
    return COUNTRY_LIST.filter((c) => c.label.toLowerCase().includes(query));
  }, [countrySearch]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (countryFieldRef.current && !countryFieldRef.current.contains(event.target as Node)) {
        setIsCountryOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutsideClick);
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, []);

  function handleCountrySelect(country: CountryOption) {
    setSelectedCountry(country);
    setCountrySearch(country.label);
    setIsCountryOpen(false);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!selectedCountry) {
      setError("Please select a country.");
      return;
    }

    const form = event.currentTarget;
    const data = new FormData(form);
    const password = data.get("password") as string;
    const confirm = data.get("confirmPassword") as string;

    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }

    setLoading(true);

    const email = data.get("organizationEmail") as string;
    const supabase = createClient();

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback?next=/welcome` },
    });

    if (signUpError) {
      setError(signUpError.message);
      setLoading(false);
      return;
    }

    // Supabase returns a user with no identities (no error) when the email is
    // already registered and confirmed — this prevents account enumeration,
    // but we still need to surface something actionable to the user.
    if (!signUpData.user || signUpData.user.identities?.length === 0) {
      setError("An account with this email already exists. Try logging in, or use a different email.");
      setLoading(false);
      return;
    }

    const { error: err } = await registerOrganization({
      userId: signUpData.user.id,
      email,
      org_name: data.get("organizationName") as string,
      p_number: data.get("organizationPhone") as string,
      industry: data.get("industry") as string,
      address: data.get("address") as string,
      org_country: selectedCountry.value,
      dba_name: data.get("adminName") as string,
      org_ip: data.get("orgIp") as string,
    });

    if (err) {
      setError(err);
      setLoading(false);
      return;
    }

    // If email confirmation is required, signUp() won't return a session —
    // send the user to check their inbox. Otherwise they're already signed in.
    if (signUpData.session) {
      router.push("/welcome");
    } else {
      router.push(`/register/check-email?email=${encodeURIComponent(email)}`);
    }
  }

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <img src="/img/logo.svg" alt="DIMA Risk" className={styles.logo} />
          <h1 className={styles.title}>Create Organization Account</h1>
          <p className={styles.subtitle}>Set up your enterprise workspace in a few steps.</p>
        </header>

        <form className={styles.form} onSubmit={handleSubmit}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Organization Info</h2>
            <div className={styles.orgGrid}>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationName">Organization Name</label>
                <input id="organizationName" name="organizationName" type="text"
                  className={styles.input} placeholder="Acme Holdings" required />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationEmail">Email</label>
                <input id="organizationEmail" name="organizationEmail" type="email"
                  className={styles.input} placeholder="contact@acme.com" required />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationPhone">Phone</label>
                <input id="organizationPhone" name="organizationPhone" type="tel"
                  className={styles.input} placeholder="+1 555 0102" required />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="industry">Industry</label>
                <select id="industry" name="industry" className={styles.select} required defaultValue="">
                  <option value="" disabled>Select your industry</option>
                  <option value="Healthcare">Healthcare</option>
                  <option value="Healthtech">Healthtech</option>
                  <option value="Education">Education</option>
                  <option value="Fintech">Fintech</option>
                  <option value="Finance">Finance</option>
                </select>
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="address">Address</label>
                <textarea id="address" name="address" className={styles.textarea}
                  placeholder="123 Business Avenue, Suite 400" required />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="orgIp">
                  Network IP Address <span className={styles.optional}>(for security scan)</span>
                </label>
                <input id="orgIp" name="orgIp" type="text"
                  className={styles.input} placeholder="e.g. 203.0.113.42" />
                <p className={styles.fieldHint}>
                  The public IP of your main office network. DIMA will scan it during onboarding to assess your technical controls.
                </p>
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="countrySearch">Organization Country</label>
                <div className={styles.countryField} ref={countryFieldRef}>
                  <div className={styles.countryInputWrapper}>
                    <span className={styles.countryFlag}>
                      {selectedCountry ? codeToFlagEmoji(selectedCountry.value) : "🌍"}
                    </span>
                    <input id="countrySearch" name="countrySearch" type="text"
                      value={countrySearch}
                      onChange={(e) => { setCountrySearch(e.target.value); setSelectedCountry(null); }}
                      onFocus={() => setIsCountryOpen(true)}
                      className={styles.input} placeholder="Search country..." autoComplete="off" />
                    <button type="button" className={styles.dropdownToggle}
                      onClick={() => setIsCountryOpen((o) => !o)} aria-label="Toggle country list">▼</button>
                  </div>
                  {isCountryOpen && (
                    <ul className={styles.countryList}>
                      {filteredCountries.length > 0 ? filteredCountries.map((country) => (
                        <li key={country.value}>
                          <button type="button" className={styles.countryOption}
                            onClick={() => handleCountrySelect(country)}>
                            <span className={styles.countryOptionFlag}>{codeToFlagEmoji(country.value)}</span>
                            <span>{country.label}</span>
                          </button>
                        </li>
                      )) : <li className={styles.noResults}>No country found.</li>}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Admin Info</h2>
            <div className={styles.orgGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="adminName">
                  Admin Name <span className={styles.optional}>(Optional)</span>
                </label>
                <input id="adminName" name="adminName" type="text"
                  className={styles.input} placeholder="Jane Doe" />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="password">Password</label>
                <input id="password" name="password" type="password"
                  className={styles.input} placeholder="••••••••" required />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="confirmPassword">Confirm Password</label>
                <input id="confirmPassword" name="confirmPassword" type="password"
                  className={styles.input} placeholder="••••••••" required />
              </div>
            </div>
          </div>

          {error && <p className={styles.errorMsg}>{error}</p>}

          <button type="submit" className={styles.submitButton} disabled={loading}>
            {loading ? "Creating account…" : "Create Account"}
          </button>

          <p className={styles.loginLink}>
            Already have an account?{" "}
            <a href="/login" className={styles.link}>Log in</a>
          </p>
        </form>
      </section>
    </main>
  );
}
