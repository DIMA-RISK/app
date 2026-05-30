import { getDashboardData } from "./actions";
import ExecutiveSummary from "./_components/ExecutiveSummary";

export default async function ExecutiveSummaryPage() {
  const data = await getDashboardData();
  return <ExecutiveSummary data={data} />;
}
