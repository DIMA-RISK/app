import { getQuestionnaireData } from "../queries";
import QuestionnaireClient from "./QuestionnaireClient";
import styles from "../dashboard.module.css";

export default async function QuestionnairePage() {
  const data = await getQuestionnaireData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>No questionnaire data found. Complete the onboarding to see your responses.</p>
      </div>
    );
  }
  return <QuestionnaireClient data={data} />;
}
