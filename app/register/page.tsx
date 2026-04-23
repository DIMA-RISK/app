"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { COUNTRY_LIST, type CountryOption } from "../../utils/countries";
import styles from "./register.module.css";

function codeToFlagEmoji(countryCode: string): string {
  return countryCode
    .toUpperCase()
    .replace(/./g, (char) => String.fromCodePoint(127397 + char.charCodeAt(0)));
}

export default function RegisterPage() {
  const [countrySearch, setCountrySearch] = useState("");
  const [selectedCountry, setSelectedCountry] = useState<CountryOption | null>(
    null,
  );
  const [isCountryOpen, setIsCountryOpen] = useState(false);
  const countryFieldRef = useRef<HTMLDivElement | null>(null);

  const filteredCountries = useMemo(() => {
    const query = countrySearch.trim().toLowerCase();
    if (!query) {
      return COUNTRY_LIST;
    }

    return COUNTRY_LIST.filter((country) =>
      country.label.toLowerCase().includes(query),
    );
  }, [countrySearch]);

  useEffect(() => {
    function handleOutsideClick(event: MouseEvent) {
      if (
        countryFieldRef.current &&
        !countryFieldRef.current.contains(event.target as Node)
      ) {
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

  return (
    <main className={styles.page}>
      <section className={styles.card}>
        <header className={styles.header}>
          <h1 className={styles.title}>Create Organization Account</h1>
          <p className={styles.subtitle}>
            Set up your enterprise workspace in a few steps.
          </p>
        </header>

        <form className={styles.form} onSubmit={(event) => event.preventDefault()}>
          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Organization Info</h2>

            <div className={styles.orgGrid}>
              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationName">
                  Organization Name
                </label>
                <input
                  id="organizationName"
                  name="organizationName"
                  type="text"
                  className={styles.input}
                  placeholder="Acme Holdings"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationEmail">
                  Email
                </label>
                <input
                  id="organizationEmail"
                  name="organizationEmail"
                  type="email"
                  className={styles.input}
                  placeholder="contact@acme.com"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="organizationPhone">
                  Phone
                </label>
                <input
                  id="organizationPhone"
                  name="organizationPhone"
                  type="tel"
                  className={styles.input}
                  placeholder="+1 555 0102"
                  required
                />
              </div>

              <div className={styles.field}>
                <label className={styles.label} htmlFor="industry">
                  Industry
                </label>
                <input
                  id="industry"
                  name="industry"
                  type="text"
                  className={styles.input}
                  placeholder="Technology"
                  required
                />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="address">
                  Address
                </label>
                <textarea
                  id="address"
                  name="address"
                  className={styles.textarea}
                  placeholder="123 Business Avenue, Suite 400"
                  required
                />
              </div>

              <div className={`${styles.field} ${styles.fullWidth}`}>
                <label className={styles.label} htmlFor="countrySearch">
                  Organization Country
                </label>
                <div className={styles.countryField} ref={countryFieldRef}>
                  <div className={styles.countryInputWrapper}>
                    <span className={styles.countryFlag}>
                      {selectedCountry ? codeToFlagEmoji(selectedCountry.value) : "🌍"}
                    </span>
                    <input
                      id="countrySearch"
                      name="countrySearch"
                      type="text"
                      value={countrySearch}
                      onChange={(event) => {
                        setCountrySearch(event.target.value);
                        setSelectedCountry(null);
                      }}
                      onFocus={() => setIsCountryOpen(true)}
                      className={styles.input}
                      placeholder="Search country..."
                      autoComplete="off"
                      required
                    />
                    <button
                      type="button"
                      className={styles.dropdownToggle}
                      onClick={() => setIsCountryOpen((open) => !open)}
                      aria-label="Toggle country list"
                    >
                      ▼
                    </button>
                  </div>

                  {isCountryOpen && (
                    <ul className={styles.countryList}>
                      {filteredCountries.length > 0 ? (
                        filteredCountries.map((country) => (
                          <li key={country.value}>
                            <button
                              type="button"
                              className={styles.countryOption}
                              onClick={() => handleCountrySelect(country)}
                            >
                              <span className={styles.countryOptionFlag}>
                                {codeToFlagEmoji(country.value)}
                              </span>
                              <span>{country.label}</span>
                            </button>
                          </li>
                        ))
                      ) : (
                        <li className={styles.noResults}>No country found.</li>
                      )}
                    </ul>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className={styles.section}>
            <h2 className={styles.sectionTitle}>Admin Info</h2>

            <div className={styles.field}>
              <label className={styles.label} htmlFor="adminName">
                Admin Name <span className={styles.optional}>(Optional)</span>
              </label>
              <input
                id="adminName"
                name="adminName"
                type="text"
                className={styles.input}
                placeholder="Jane Doe"
              />
            </div>
          </div>

          <button type="submit" className={styles.submitButton}>
            Create Account
          </button>
        </form>
      </section>
    </main>
  );
}
