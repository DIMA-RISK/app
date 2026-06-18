import { getReportsData } from "../queries";
import ReportsClient from "./ReportsClient";
import styles from "../dashboard.module.css";

export default async function ReportsPage() {
  const data = await getReportsData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to generate your compliance report.</p>
      </div>
    );
  }
  return <ReportsClient data={data} />;
}
