import { getEvidenceData } from "../queries";
import EvidenceClient from "./EvidenceClient";
import styles from "../dashboard.module.css";

export default async function EvidencePage() {
  const data = await getEvidenceData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Complete the onboarding questionnaire to use the Evidence Center.</p>
      </div>
    );
  }
  return <EvidenceClient data={data} />;
}
