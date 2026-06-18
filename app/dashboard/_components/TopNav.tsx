"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell, Building2, Settings, LogOut, User, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { createClient } from "../../../utils/supabase/client";
import type { TopNavData } from "../queries";
import styles from "../dashboard.module.css";

const TITLES: Record<string, string> = {
  "/dashboard": "Executive Summary",
  "/dashboard/compliance": "Compliance Status",
  "/dashboard/questionnaire": "Questionnaire",
  "/dashboard/risks": "Risk Register",
  "/dashboard/actions": "Action Plan",
  "/dashboard/assets": "Assets & Data",
  "/dashboard/evidence": "Evidence Center",
  "/dashboard/analytics": "Analytics & Trends",
  "/dashboard/alerts": "Alerts",
  "/dashboard/reports": "Reports",
  "/dashboard/settings": "Settings",
  "/dashboard/users": "User Management",
};

const BAND_CLASS: Record<string, string> = {
  critical: "statusCritical",
  high:     "statusCritical",
  medium:   "statusAtRisk",
  low:      "statusCompliant",
};

const BAND_LABEL: Record<string, string> = {
  critical: "Critical Risk",
  high:     "High Risk",
  medium:   "At Risk",
  low:      "Low Risk",
};

const ALERT_ICON: Record<string, { Icon: React.ElementType; color: string }> = {
  critical: { Icon: AlertTriangle, color: "#ef4444" },
  warning:  { Icon: AlertCircle,   color: "#f59e0b" },
  info:     { Icon: Info,          color: "#60a5fa" },
};

function relativeTime(iso: string | null): string {
  if (!iso) return "Never run";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 2) return "Just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days}d ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function TopNav({ topNavData }: { topNavData: TopNavData }) {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "Dashboard";

  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handler(e: MouseEvent) {
      if (bellRef.current && !bellRef.current.contains(e.target as Node)) setBellOpen(false);
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setMenuOpen(false);
    }
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  const band = topNavData.riskBand ?? "medium";
  const bandClass = BAND_CLASS[band] ?? "statusAtRisk";
  const bandLabel = BAND_LABEL[band] ?? "At Risk";

  return (
    <header className={styles.topnav}>
      <span className={styles.topnavTitle}>{title}</span>

      <div className={styles.topnavSearch}>
        <Search className={styles.topnavSearchIcon} />
        <input type="text" placeholder="Search…" className={styles.topnavSearchInput} />
      </div>

      <div className={styles.topnavRight}>
        {/* Org badge */}
        <div className={styles.topnavOrgBadge}>
          <Building2 size={12} />
          {topNavData.orgName}
        </div>

        {/* Risk / compliance status — only shown after assessment */}
        {topNavData.riskBand && (
          <div className={`${styles.topnavStatusBadge} ${styles[bandClass]}`}>
            <span className={styles.topnavDot} />
            {bandLabel} · {topNavData.frameworkName ?? "—"} {topNavData.riskScore}%
          </div>
        )}

        {/* Last run */}
        <div className={styles.topnavOrgBadge} style={{ fontSize: "0.7rem", color: "rgba(221,215,234,0.45)" }}>
          Last run: {relativeTime(topNavData.lastRun)}
        </div>

        {/* Bell */}
        <div className={styles.dropdownAnchor} ref={bellRef}>
          <button
            className={styles.topnavIconBtn}
            onClick={() => { setBellOpen((o) => !o); setMenuOpen(false); }}
          >
            <Bell size={15} />
            {topNavData.recentAlerts.length > 0 && <span className={styles.topnavNotifDot} />}
          </button>

          {bellOpen && (
            <div className={`${styles.dropdown} ${styles.dropdownNotif}`}>
              <div className={styles.dropdownHead}>
                Notifications
                <Link
                  href="/dashboard/alerts"
                  className={`${styles.badge} ${styles.badgePurple}`}
                  onClick={() => setBellOpen(false)}
                >
                  View all
                </Link>
              </div>

              {topNavData.recentAlerts.length === 0 ? (
                <div className={styles.dropdownNotifItem} style={{ color: "rgba(221,215,234,0.4)", fontSize: "0.8rem" }}>
                  No open critical items
                </div>
              ) : (
                topNavData.recentAlerts.map((a, i) => {
                  const { Icon, color } = ALERT_ICON[a.type] ?? ALERT_ICON.warning;
                  return (
                    <div key={i} className={styles.dropdownNotifItem}>
                      <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                        <Icon size={14} color={color} style={{ flexShrink: 0 }} />
                        <div>
                          <div className={styles.dropdownNotifTitle}>{a.title}</div>
                          <div className={styles.dropdownNotifTime}>{relativeTime(a.createdAt)}</div>
                        </div>
                      </div>
                    </div>
                  );
                })
              )}

              <div className={styles.dropdownFooter}>
                <Link
                  href="/dashboard/alerts"
                  className={`${styles.textXs} ${styles.textPurple}`}
                  onClick={() => setBellOpen(false)}
                >
                  View all alerts →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Avatar / user menu */}
        <div className={styles.dropdownAnchor} ref={menuRef}>
          <div
            className={styles.topnavAvatar}
            onClick={() => { setMenuOpen((o) => !o); setBellOpen(false); }}
            title="Account menu"
          >
            {topNavData.orgInitials}
          </div>

          {menuOpen && (
            <div className={`${styles.dropdown} ${styles.dropdownMenu}`}>
              <div className={styles.dropdownUserHead}>
                <div className={styles.topnavAvatar} style={{ width: 32, height: 32, fontSize: "0.72rem", cursor: "default" }}>
                  {topNavData.orgInitials}
                </div>
                <div>
                  <div className={styles.dropdownUserName}>{topNavData.orgName}</div>
                  <div className={styles.dropdownUserEmail}>{topNavData.userEmail}</div>
                </div>
              </div>

              <Link href="/dashboard/settings" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                <Settings size={15} /> Settings
              </Link>
              <Link href="/dashboard/users" className={styles.dropdownItem} onClick={() => setMenuOpen(false)}>
                <User size={15} /> User Management
              </Link>

              <hr className={styles.dropdownDivider} />

              <button className={`${styles.dropdownItem} ${styles.dropdownItemDanger}`} onClick={handleLogout}>
                <LogOut size={15} /> Log out
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
