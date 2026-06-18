import { getActionPlanData } from "../queries";
import ActionPlanClient from "./ActionPlanClient";
import styles from "../dashboard.module.css";

export default async function ActionPlanPage() {
  const data = await getActionPlanData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to generate your action plan.</p>
      </div>
    );
  }
  return <ActionPlanClient data={data} />;
}
