"use client";

import { useState } from "react";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X, Bell } from "lucide-react";
import styles from "../dashboard.module.css";

const ALERTS = [
  { id: 1, type: "critical", icon: AlertTriangle, title: "Critical Risk Detected", body: "No Privacy Officer has been appointed. This is a mandatory PIPEDA requirement and must be resolved immediately.", time: "2h ago", read: false },
  { id: 2, type: "critical", icon: AlertTriangle, title: "Assessment Overdue", body: "Your PIPEDA assessment is 14 days past the recommended quarterly review date.", time: "3h ago", read: false },
  { id: 3, type: "warning", icon: AlertCircle, title: "Compliance Score Dropped", body: "Your PIPEDA compliance score dropped from 75% to 72% following the latest scan.", time: "2h ago", read: false },
  { id: 4, type: "warning", icon: AlertCircle, title: "Evidence Expiring Soon", body: "Staff Privacy Training Completion record expires in 14 days. Upload an updated version.", time: "1d ago", read: true },
  { id: 5, type: "warning", icon: AlertCircle, title: "Vendor Contract Unsigned", body: "2 vendors (MedTech Solutions, DataSync Inc.) have no signed Data Processing Agreement.", time: "2d ago", read: true },
  { id: 6, type: "info", icon: Info, title: "New Recommendation Available", body: "Based on your latest scan, we recommend enabling audit logging for patient record access.", time: "2h ago", read: false },
  { id: 7, type: "info", icon: Info, title: "Questionnaire Incomplete", body: "7 questions in the Incident Response category have not yet been answered.", time: "3d ago", read: true },
  { id: 8, type: "success", icon: CheckCircle2, title: "Task Marked Complete", body: "Privacy Policy v2.1 has been approved and linked to PIPEDA-GOV-002.", time: "5d ago", read: true },
];

const ALERT_STYLE: Record<string, { border: string; iconColor: string; iconBg: string }> = {
  critical: { border: styles.alertCritical, iconColor: "#ef4444", iconBg: "rgba(239,68,68,0.12)" },
  warning: { border: styles.alertWarning, iconColor: "#f59e0b", iconBg: "rgba(245,158,11,0.12)" },
  info: { border: styles.alertInfo, iconColor: "#60a5fa", iconBg: "rgba(96,165,250,0.12)" },
  success: { border: styles.alertSuccess, iconColor: "#22c55e", iconBg: "rgba(34,197,94,0.12)" },
};

export default function AlertsPage() {
  const [alerts, setAlerts] = useState(ALERTS);
  const [filter, setFilter] = useState("all");

  const markRead = (id: number) => setAlerts((a) => a.map((al) => al.id === id ? { ...al, read: true } : al));
  const dismiss = (id: number) => setAlerts((a) => a.filter((al) => al.id !== id));
  const markAllRead = () => setAlerts((a) => a.map((al) => ({ ...al, read: true })));

  const filtered = filter === "all" ? alerts : filter === "unread" ? alerts.filter((a) => !a.read) : alerts.filter((a) => a.type === filter);
  const unread = alerts.filter((a) => !a.read).length;

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Alerts & Notifications</h1>
          <p className={styles.pageSubtitle}>{unread} unread alert{unread !== 1 ? "s" : ""}</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={markAllRead}>
            <CheckCircle2 size={14} /> Mark all read
          </button>
        </div>
      </div>

      {/* Filter tabs */}
      <div className={styles.tabs}>
        {["all", "unread", "critical", "warning", "info", "success"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && unread > 0 && (
              <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 10,
                padding: "0 5px", fontSize: "0.65rem", fontWeight: 700 }}>{unread}</span>
            )}
          </button>
        ))}
      </div>

      {/* Alert list */}
      <div className={styles.flexCol} style={{ gap: "0.65rem" }}>
        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <Bell size={32} className={styles.emptyIcon} />
            <p className={styles.emptyText}>No alerts in this category.</p>
          </div>
        )}
        {filtered.map((alert) => {
          const s = ALERT_STYLE[alert.type];
          const Icon = alert.icon;
          return (
            <div key={alert.id} className={`${styles.alertCard} ${s.border}`}
              style={{ opacity: alert.read ? 0.65 : 1 }}>
              <div className={styles.alertIconWrap} style={{ background: s.iconBg }}>
                <Icon size={17} color={s.iconColor} />
              </div>
              <div style={{ flex: 1 }}>
                <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter}`}>
                  <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.875rem" }}>
                    {alert.title}
                    {!alert.read && <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%",
                      background: "#754cbe", marginLeft: 8, verticalAlign: "middle" }} />}
                  </span>
                  <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{alert.time}</span>
                </div>
                <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", marginTop: "0.3rem" }}>{alert.body}</p>
                <div className={`${styles.flex} ${styles.gap04} ${styles.mt05}`}>
                  {!alert.read && (
                    <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`} onClick={() => markRead(alert.id)}>
                      Mark read
                    </button>
                  )}
                  <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`} onClick={() => dismiss(alert.id)}>
                    <X size={11} /> Dismiss
                  </button>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
