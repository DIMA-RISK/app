import { ReactNode } from "react";
import { redirect } from "next/navigation";
import DashboardShell from "./_components/DashboardShell";
import { getTopNavData, getDashboardReadiness } from "./queries";
import { rescoreWithScan } from "../onboarding/actions";

export const metadata = {
  title: "Dashboard — DIMA Risk",
};

export default async function DashboardLayout({ children }: { children: ReactNode }) {
  const readiness = await getDashboardReadiness();

  // Not authenticated
  if (!readiness) redirect("/login");

  // Questionnaire not answered — send back to onboarding
  if (!readiness.questionnaireAnswered) redirect("/onboarding");

  // Org has a registered IP but scan hasn't completed yet — wait for it
  if (readiness.hasOrgIp && !readiness.scanCompleted) redirect("/scanning");

  // Scan is done but risk score was calculated before the scan results arrived —
  // re-run scoring now so the dashboard reflects the blended questionnaire + EWNAF score
  if (readiness.scoreNeedsUpdate) {
    await rescoreWithScan();
  }

  const topNavData = await getTopNavData();
  return <DashboardShell topNavData={topNavData}>{children}</DashboardShell>;
}
