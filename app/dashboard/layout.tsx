import { ReactNode } from "react";
import DashboardShell from "./_components/DashboardShell";

export const metadata = {
  title: "Dashboard — DIMA Risk",
};

export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <DashboardShell>{children}</DashboardShell>;
}
