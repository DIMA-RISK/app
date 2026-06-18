import { getDashboardData } from "./queries";
import ExecutiveSummary from "./_components/ExecutiveSummary";

export default async function ExecutiveSummaryPage() {
  const data = await getDashboardData();
  return <ExecutiveSummary data={data} />;
}
