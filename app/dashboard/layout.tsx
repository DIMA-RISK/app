import { ReactNode } from "react";
import DashboardShell from "./_components/DashboardShell";
import { getAlertCount } from "./queries";

export const metadata = {
  title: "Dashboard — DIMA Risk",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const alertCount = await getAlertCount();
  return <DashboardShell alertCount={alertCount}>{children}</DashboardShell>;
}
