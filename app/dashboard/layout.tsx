import { ReactNode } from "react";
import DashboardShell from "./_components/DashboardShell";
import { getTopNavData } from "./queries";

export const metadata = {
  title: "Dashboard — DIMA Risk",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const topNavData = await getTopNavData();
  return <DashboardShell topNavData={topNavData}>{children}</DashboardShell>;
}
