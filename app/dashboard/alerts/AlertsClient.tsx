"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertTriangle, AlertCircle, Info, CheckCircle2, X, Bell } from "lucide-react";
import type { AlertItem } from "../queries";
import { markAlertRead, markAllAlertsRead, dismissAlert } from "./actions";
import styles from "../dashboard.module.css";

const ALERT_STYLE: Record<string, { borderClass: string; iconColor: string; iconBg: string }> = {
  critical: { borderClass: styles.alertCritical, iconColor: "#ef4444", iconBg: "rgba(239,68,68,0.12)" },
  warning:  { borderClass: styles.alertWarning,  iconColor: "#f59e0b", iconBg: "rgba(245,158,11,0.12)" },
  info:     { borderClass: styles.alertInfo,     iconColor: "#60a5fa", iconBg: "rgba(96,165,250,0.12)" },
  success:  { borderClass: styles.alertSuccess,  iconColor: "#22c55e", iconBg: "rgba(34,197,94,0.12)" },
};

const ICON = { critical: AlertTriangle, warning: AlertCircle, info: Info, success: CheckCircle2 };

function relativeTime(iso: string) {
  const diff = Date.now() - new Date(iso).getTime();
  const m = Math.floor(diff / 60000);
  if (m < 2) return "just now";
  if (m < 60) return `${m}m ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ago`;
  return `${Math.floor(h / 24)}d ago`;
}

export default function AlertsClient({ alerts: initial }: { alerts: AlertItem[] }) {
  const router = useRouter();
  const [alerts, setAlerts] = useState(initial);
  const [filter, setFilter] = useState("all");

  const markRead = (id: string) => {
    setAlerts((a) => a.map((al) => al.id === id ? { ...al, read: true } : al));
    markAlertRead(id).then(() => router.refresh());
  };

  const dismiss = (id: string) => {
    setAlerts((a) => a.filter((al) => al.id !== id));
    dismissAlert(id).then(() => router.refresh());
  };

  const markAllRead = () => {
    const unreadIds = alerts.filter((al) => !al.read).map((al) => al.id);
    setAlerts((a) => a.map((al) => ({ ...al, read: true })));
    markAllAlertsRead(unreadIds).then(() => router.refresh());
  };

  const unread = alerts.filter((a) => !a.read).length;
  const filtered = filter === "all" ? alerts
    : filter === "unread" ? alerts.filter((a) => !a.read)
    : alerts.filter((a) => a.type === filter);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>Alerts &amp; Notifications</h1>
          <p className={styles.pageSubtitle}>{unread} unread alert{unread !== 1 ? "s" : ""} from your assessment</p>
        </div>
        <div className={styles.pageActions}>
          {unread > 0 && (
            <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={markAllRead}>
              <CheckCircle2 size={14} /> Mark all read
            </button>
          )}
        </div>
      </div>

      <div className={styles.tabs}>
        {["all", "unread", "critical", "warning", "info", "success"].map((f) => (
          <button key={f} className={`${styles.tab} ${filter === f ? styles.tabActive : ""}`} onClick={() => setFilter(f)}>
            {f.charAt(0).toUpperCase() + f.slice(1)}
            {f === "unread" && unread > 0 && (
              <span style={{ marginLeft: 6, background: "#ef4444", color: "#fff", borderRadius: 10, padding: "0 5px", fontSize: "0.65rem", fontWeight: 700 }}>{unread}</span>
            )}
          </button>
        ))}
      </div>

      <div className={styles.flexCol} style={{ gap: "0.65rem" }}>
        {filtered.length === 0 && (
          <div className={styles.emptyState}>
            <Bell size={28} style={{ color: "rgba(221,215,234,0.2)", marginBottom: "0.4rem" }} />
            <p className={styles.emptyText}>No alerts in this category.</p>
          </div>
        )}
        {filtered.map((alert) => {
          const s = ALERT_STYLE[alert.type] ?? ALERT_STYLE.info;
          const Icon = ICON[alert.type] ?? Info;
          return (
            <div key={alert.id} className={`${styles.alertCard} ${s.borderClass}`} style={{ opacity: alert.read ? 0.65 : 1 }}>
              <div className={styles.alertIconWrap} style={{ background: s.iconBg }}>
                <Icon size={17} color={s.iconColor} />
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.875rem" }}>
                    {alert.title}
                    {!alert.read && (
                      <span style={{ display: "inline-block", width: 6, height: 6, borderRadius: "50%", background: "#754cbe", marginLeft: 8, verticalAlign: "middle" }} />
                    )}
                  </span>
                  <span className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>{relativeTime(alert.createdAt)}</span>
                </div>
                <p className={styles.textSm} style={{ color: "rgba(221,215,234,0.6)", marginTop: "0.3rem" }}>{alert.body}</p>
                <div style={{ display: "flex", gap: "0.4rem", marginTop: "0.4rem" }}>
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
