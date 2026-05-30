"use client";

import { useState } from "react";
import { Save } from "lucide-react";
import styles from "../dashboard.module.css";

export default function SettingsPage() {
  const [notifEmail, setNotifEmail] = useState(true);
  const [notifWeekly, setNotifWeekly] = useState(true);
  const [notifCritical, setNotifCritical] = useState(true);
  const [notifScore, setNotifScore] = useState(false);

  function Toggle({ on, onToggle }: { on: boolean; onToggle: () => void }) {
    return (
      <button className={`${styles.toggle} ${on ? styles.toggleOn : ""}`} onClick={onToggle}>
        <span className={`${styles.toggleKnob} ${on ? styles.toggleOnKnob : ""}`} />
      </button>
    );
  }

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
                <input className={styles.fieldInput} defaultValue="Acme Health Solutions" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Admin Name</label>
                <input className={styles.fieldInput} defaultValue="Younes A." />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Industry</label>
                <select className={styles.fieldSelect}>
                  <option>Healthcare</option>
                  <option>Healthtech</option>
                  <option>Education</option>
                  <option>Fintech</option>
                  <option>Finance</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Country</label>
                <select className={styles.fieldSelect}>
                  <option>Canada (CA)</option>
                  <option>United States (US)</option>
                </select>
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Phone</label>
                <input className={styles.fieldInput} defaultValue="+1 250 268 5652" />
              </div>
              <div className={styles.field}>
                <label className={styles.fieldLabel}>Email</label>
                <input className={styles.fieldInput} defaultValue="admin@acmehealth.ca" />
              </div>
              <div className={styles.field} style={{ gridColumn: "1 / -1" }}>
                <label className={styles.fieldLabel}>Address</label>
                <input className={styles.fieldInput} defaultValue="1234 Health Blvd, Vancouver, BC" />
              </div>
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
          {/* Notifications */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Notification Preferences</h2>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Email Alerts</span>
                <span className={styles.toggleDesc}>Receive alerts via email</span>
              </div>
              <Toggle on={notifEmail} onToggle={() => setNotifEmail((v) => !v)} />
            </div>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Weekly Summary</span>
                <span className={styles.toggleDesc}>Weekly digest of compliance status</span>
              </div>
              <Toggle on={notifWeekly} onToggle={() => setNotifWeekly((v) => !v)} />
            </div>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Critical Risk Alerts</span>
                <span className={styles.toggleDesc}>Immediate notification for critical findings</span>
              </div>
              <Toggle on={notifCritical} onToggle={() => setNotifCritical((v) => !v)} />
            </div>
            <div className={styles.toggleRow}>
              <div className={styles.toggleInfo}>
                <span className={styles.toggleLabel}>Score Change Alerts</span>
                <span className={styles.toggleDesc}>Notify when risk score changes ±5 pts</span>
              </div>
              <Toggle on={notifScore} onToggle={() => setNotifScore((v) => !v)} />
            </div>
          </div>

          {/* Branding */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Branding</h2>
            <div className={styles.field} style={{ marginBottom: "1rem" }}>
              <label className={styles.fieldLabel}>Organization Logo</label>
              <div className={styles.uploadZone} style={{ padding: "1.25rem" }}>
                Current: Acme Health Solutions<br />
                <span className={styles.textXs}>Click to replace (PNG, SVG — max 2 MB)</span>
              </div>
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Display Name in Reports</label>
              <input className={styles.fieldInput} defaultValue="Acme Health Solutions" />
            </div>
          </div>
        </div>
      </div>
    </>
  );
}
