"use client";

import { usePathname, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Search, Bell, Building2, Settings, LogOut, User, AlertTriangle, AlertCircle, Info } from "lucide-react";
import { createClient } from "../../../utils/supabase/client";
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

const RECENT_ALERTS = [
  { type: "critical", icon: AlertTriangle, title: "No Privacy Officer appointed", time: "2h ago", color: "#ef4444" },
  { type: "warning", icon: AlertCircle, title: "Compliance score dropped to 72%", time: "2h ago", color: "#f59e0b" },
  { type: "info", icon: Info, title: "New recommendation: Enable MFA", time: "3h ago", color: "#60a5fa" },
];

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const title = TITLES[pathname] ?? "Dashboard";

  const [bellOpen, setBellOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);

  const bellRef = useRef<HTMLDivElement>(null);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
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
          Acme Health Solutions
        </div>

        {/* Compliance status */}
        <div className={`${styles.topnavStatusBadge} ${styles.statusAtRisk}`}>
          <span className={styles.topnavDot} />
          At Risk · PIPEDA 72%
        </div>

        {/* Last run */}
        <div className={styles.topnavOrgBadge} style={{ fontSize: "0.7rem", color: "rgba(221,215,234,0.45)" }}>
          Last run: 2h ago
        </div>

        {/* Bell */}
        <div className={styles.dropdownAnchor} ref={bellRef}>
          <button className={styles.topnavIconBtn} onClick={() => { setBellOpen((o) => !o); setMenuOpen(false); }}>
            <Bell size={15} />
            <span className={styles.topnavNotifDot} />
          </button>

          {bellOpen && (
            <div className={`${styles.dropdown} ${styles.dropdownNotif}`}>
              <div className={styles.dropdownHead}>
                Notifications
                <Link href="/dashboard/alerts" className={`${styles.badge} ${styles.badgePurple}`}
                  onClick={() => setBellOpen(false)}>
                  View all
                </Link>
              </div>
              {RECENT_ALERTS.map((a, i) => {
                const Icon = a.icon;
                return (
                  <div key={i} className={styles.dropdownNotifItem}>
                    <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                      <Icon size={14} color={a.color} style={{ flexShrink: 0 }} />
                      <div>
                        <div className={styles.dropdownNotifTitle}>{a.title}</div>
                        <div className={styles.dropdownNotifTime}>{a.time}</div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <div className={styles.dropdownFooter}>
                <Link href="/dashboard/alerts" className={`${styles.textXs} ${styles.textPurple}`}
                  onClick={() => setBellOpen(false)}>
                  View all alerts →
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Avatar / user menu */}
        <div className={styles.dropdownAnchor} ref={menuRef}>
          <div className={styles.topnavAvatar}
            onClick={() => { setMenuOpen((o) => !o); setBellOpen(false); }}
            title="Account menu">
            YA
          </div>

          {menuOpen && (
            <div className={`${styles.dropdown} ${styles.dropdownMenu}`}>
              {/* User info */}
              <div className={styles.dropdownUserHead}>
                <div className={styles.topnavAvatar} style={{ width: 32, height: 32, fontSize: "0.72rem", cursor: "default" }}>YA</div>
                <div>
                  <div className={styles.dropdownUserName}>Younes A.</div>
                  <div className={styles.dropdownUserEmail}>admin@acmehealth.ca</div>
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
