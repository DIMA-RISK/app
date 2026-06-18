"use client";

import { useState, ReactNode } from "react";
import Sidebar from "./Sidebar";
import TopNav from "./TopNav";
import type { TopNavData } from "../queries";
import styles from "../dashboard.module.css";

export default function DashboardShell({ children, topNavData }: { children: ReactNode; topNavData: TopNavData }) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div className={styles.shell}>
      <Sidebar collapsed={collapsed} onToggle={() => setCollapsed((c) => !c)} alertCount={topNavData.alertCount} />
      <div className={collapsed ? `${styles.main} ${styles.mainCollapsed}` : styles.main}>
        <TopNav topNavData={topNavData} />
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
