"use client";

import { useState, ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import styles from "../dashboard.module.css";

export default function DashboardShell({ children }: { children: ReactNode }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} />
      <div className={collapsed ? `${styles.main} ${styles.mainCollapsed}` : styles.main}>
        <TopNav />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
