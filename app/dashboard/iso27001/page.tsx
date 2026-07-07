import { getIso27001Data } from "../queries";
import Iso27001Client from "./Iso27001Client";
import styles from "../dashboard.module.css";

export default async function Iso27001Page() {
  const data = await getIso27001Data();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>ISO 27001 tracker unavailable. Please contact support.</p>
      </div>
    );
  }
  return <Iso27001Client data={data} />;
}
