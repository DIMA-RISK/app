import { getSettingsData } from "../queries";
import SettingsClient from "./SettingsClient";
import styles from "../dashboard.module.css";

export default async function SettingsPage() {
  const data = await getSettingsData();
  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Could not load settings.</p>
      </div>
    );
  }
  return <SettingsClient data={data} />;
}
