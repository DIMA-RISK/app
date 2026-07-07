import { getKpiData } from "../queries";
import KpiClient from "./KpiClient";
import styles from "../dashboard.module.css";

export default async function KpiPage() {
  const data = await getKpiData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>KPI data unavailable.</p>
      </div>
    );
  }
  return <KpiClient data={data} />;
}
