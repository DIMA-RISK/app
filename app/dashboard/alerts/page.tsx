import { getAlertsData } from "../queries";
import AlertsClient from "./AlertsClient";

export default async function AlertsPage() {
  const data = await getAlertsData();
  return <AlertsClient alerts={data?.alerts ?? []} />;
}
