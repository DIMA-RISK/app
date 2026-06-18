"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import type { SettingsData } from "../queries";
import styles from "../dashboard.module.css";

function Toggle({ on, onToggle, disabled }: { on: boolean; onToggle: () => void; disabled?: boolean }) {
  return (
    <button
      className={`${styles.toggle} ${on ? styles.toggleOn : ""}`}
      onClick={disabled ? undefined : onToggle}
      disabled={disabled}
      style={disabled ? { opacity: 0.4, cursor: "not-allowed" } : undefined}
    >
      <span className={`${styles.toggleKnob} ${on ? styles.toggleOnKnob : ""}`} />
    </button>
  );
}

const INDUSTRIES = ["Healthcare", "Healthtech", "Education", "Fintech", "Finance"];
const COUNTRIES = ["Canada", "United States"];

export default function SettingsClient({ data }: { data: SettingsData }) {
  const [notifEmail] = useState(false);
  const [notifWeekly] = useState(false);
  const [notifCritical] = useState(false);
  const [notifScore] = useState(false);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Settings</h1>
          <p className={styles.pageSubtitle}>Manage your organization profile, frameworks, and preferences</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}><Save size={14} /> Save Changes</button>
        </div>
      </div>

      <div className={styles.grid21}>
        <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
          {/* Business Info */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Business Information</h2>
            <div className={styles.fieldGrid} style={{ gridTemplateColumns: "1fr 1fr", gap: "1rem" }}>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Organization Name</label>
                <input className={styles.fieldInput} defaultValue={data.orgName} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Display Name (DBA)</label>
                <input className={styles.fieldInput} defaultValue={data.dbaName ?? ""} placeholder="Same as org name" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Industry</label>
                <select className={styles.fieldSelect} defaultValue={data.industry}>
                  {INDUSTRIES.map((i) => <option key={i}>{i}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Country</label>
                <select className={styles.fieldSelect} defaultValue={data.country}>
                  {COUNTRIES.map((c) => <option key={c}>{c}</option>)}
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone</label>
                <input className={styles.fieldInput} defaultValue={data.phone} />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email</label>
                <input className={styles.fieldInput} defaultValue={data.email} />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.fieldLabel}>Address</label>
                <input className={styles.fieldInput} defaultValue={data.address} />
              </div>
              {data.orgIp && (
                <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                  <label className={styles.fieldLabel}>Scanned IP</label>
                  <input className={styles.fieldInput} defaultValue={data.orgIp} readOnly style={{ opacity: 0.6 }} />
                </div>
              )}
            </div>
          </div>

          {/* Org profile summary */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Risk Profile Inputs</h2>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.75rem" }}>
              {[
                ["Patient Records", data.patientRecords.toLocaleString()],
                ["Vendor Count", data.vendorCount.toString()],
              ].map(([label, value]) => (
                <div key={label} className={styles.card} style={{ padding: "0.75rem 1rem" }}>
                  <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)", marginBottom: "0.25rem" }}>{label}</div>
                  <div style={{ fontWeight: 700, fontSize: "1.25rem", color: "#c4a8f0" }}>{value}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Frameworks */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Active Frameworks</h2>
            {[
              { name: "PIPEDA", desc: "Automatically assigned — Canadian Healthcare organization", active: true, locked: true },
              { name: "HIPAA", desc: "Available for USA Healthcare organizations only", active: false, locked: false },
              { name: "SOC 2", desc: "Dataset not yet available", active: false, locked: true },
              { name: "Quebec Law 25", desc: "Dataset not yet available", active: false, locked: true },
            ].map((fw) => (
              <div key={fw.name} className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{fw.name}</span>
                  <span className={styles.toggleDesc}>{fw.desc}</span>
                </div>
                <Toggle on={fw.active} onToggle={() => {}} />
              </div>
            ))}
          </div>
        </div>

        {/* Right column */}
        <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Notification Preferences</h2>
            {[
              { label: "Email Alerts", desc: "Receive alerts via email", value: notifEmail },
              { label: "Weekly Summary", desc: "Weekly digest of compliance status", value: notifWeekly },
              { label: "Critical Risk Alerts", desc: "Immediate notification for critical findings", value: notifCritical },
              { label: "Score Change Alerts", desc: "Notify when risk score changes ±5 pts", value: notifScore },
            ].map(({ label, desc, value }) => (
              <div key={label} className={styles.toggleRow} title="Coming soon">
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{label}</span>
                  <span className={styles.toggleDesc}>{desc}</span>
                </div>
                <Toggle on={value} onToggle={() => {}} disabled />
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
