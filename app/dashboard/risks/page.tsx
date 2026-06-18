import { getRiskRegisterData } from "../queries";
import RiskRegisterClient from "./RiskRegisterClient";
import styles from "../dashboard.module.css";

export default async function RiskRegisterPage() {
  const data = await getRiskRegisterData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to view your risk register.</p>
      </div>
    );
  }
  return <RiskRegisterClient data={data} />;
}
