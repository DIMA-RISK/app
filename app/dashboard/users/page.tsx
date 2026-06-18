import { getUsersData, getOrgInvitations } from "../queries";
import UsersClient from "./UsersClient";
import styles from "../dashboard.module.css";

export default async function UsersPage() {
  const [data, invitations] = await Promise.all([getUsersData(), getOrgInvitations()]);

  if (!data) {
    return (
      <div className={styles.emptyState}>
        <p className={styles.emptyText}>Could not load user data.</p>
      </div>
    );
  }

  return <UsersClient data={data} invitations={invitations} />;
}
