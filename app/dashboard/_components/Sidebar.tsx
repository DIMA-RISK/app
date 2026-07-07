"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import {
  LayoutDashboard, ShieldCheck, ClipboardList, AlertTriangle,
  ListChecks, HardDrive, FolderOpen, TrendingUp, Bell,
  FileText, Settings, Users, ChevronLeft, ChevronRight, LogOut, Globe, Award, BarChart3,
} from "lucide-react";
import { createClient } from "../../../utils/supabase/client";
import styles from "../dashboard.module.css";

const NAV = [
  {
    section: "Main",
    items: [
      { href: "/dashboard", icon: LayoutDashboard, label: "Executive Summary" },
    ],
  },
  {
    section: "Compliance",
    items: [
      { href: "/dashboard/compliance", icon: ShieldCheck, label: "Compliance Status" },
      { href: "/dashboard/questionnaire", icon: ClipboardList, label: "Questionnaire" },
      { href: "/dashboard/gdpr", icon: Globe, label: "GDPR Assessment" },
      { href: "/dashboard/iso27001", icon: Award, label: "ISO 27001" },
      { href: "/dashboard/risks", icon: AlertTriangle, label: "Risk Register" },
      { href: "/dashboard/actions", icon: ListChecks, label: "Action Plan" },
    ],
  },
  {
    section: "Data",
    items: [
      { href: "/dashboard/assets", icon: HardDrive, label: "Assets & Data" },
      { href: "/dashboard/evidence", icon: FolderOpen, label: "Evidence Center" },
    ],
  },
  {
    section: "Insights",
    items: [
      { href: "/dashboard/analytics", icon: TrendingUp, label: "Analytics" },
      { href: "/dashboard/kpi", icon: BarChart3, label: "KPI Dashboard" },
      { href: "/dashboard/alerts", icon: Bell, label: "Alerts" },
      { href: "/dashboard/reports", icon: FileText, label: "Reports" },
    ],
  },
  {
    section: "Admin",
    items: [
      { href: "/dashboard/settings", icon: Settings, label: "Settings" },
      { href: "/dashboard/users", icon: Users, label: "User Management" },
    ],
  },
];

interface Props {
  collapsed: boolean;
  onToggle: () => void;
  alertCount: number;
}

export default function Sidebar({ collapsed, onToggle, alertCount }: Props) {
  const pathname = usePathname();
  const router = useRouter();

  function isActive(href: string) {
    if (href === "/dashboard") return pathname === "/dashboard";
    return pathname.startsWith(href);
  }

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className={`${styles.sidebar} ${collapsed ? styles.sidebarCollapsed : ""}`}>
      {/* Logo */}
      <div className={styles.sidebarLogo}>
        <img src="/img/logo.svg" alt="DIMA Risk" className={styles.sidebarLogoImg} />
        {!collapsed && <span className={styles.sidebarLogoText}>DIMA Risk</span>}
      </div>

      {/* Navigation */}
      <nav className={styles.sidebarNav}>
        {NAV.map((group) => (
          <div key={group.section}>
            {!collapsed && (
              <div className={styles.sidebarSection}>{group.section}</div>
            )}
            {group.items.map((item) => {
              const Icon = item.icon;
              const active = isActive(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  title={collapsed ? item.label : undefined}
                  className={`${styles.navItem} ${active ? styles.navItemActive : ""}`}
                >
                  <Icon size={17} className={styles.navIcon} />
                  {!collapsed && <span className={styles.navLabel}>{item.label}</span>}
                  {!collapsed && item.href === "/dashboard/alerts" && alertCount > 0 && (
                    <span className={styles.navBadge}>{alertCount}</span>
                  )}
                </Link>
              );
            })}
          </div>
        ))}

        {/* Logout */}
        {!collapsed && <div className={styles.sidebarSection}>Account</div>}
        <button
          className={styles.navItem}
          title={collapsed ? "Log out" : undefined}
          onClick={handleLogout}
        >
          <LogOut size={17} className={styles.navIcon} />
          {!collapsed && <span className={styles.navLabel}>Log out</span>}
        </button>
      </nav>

      {/* Collapse toggle */}
      <div className={styles.sidebarBottom}>
        <button className={styles.sidebarToggle} onClick={onToggle} title="Toggle sidebar">
          {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}
          {!collapsed && <span>Collapse</span>}
        </button>
      </div>
    </aside>
  );
}
