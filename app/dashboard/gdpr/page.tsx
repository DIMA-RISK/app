import { getGdprAssessmentData } from "../queries";
import GdprClient from "./GdprClient";
import styles from "../dashboard.module.css";

export default async function GdprPage() {
  const data = await getGdprAssessmentData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>GDPR assessment data unavailable. Please contact support.</p>
      </div>
    );
  }
  return <GdprClient data={data} />;
}
