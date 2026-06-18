import { getUsersData } from "../queries";
import { Shield, Mail, Calendar, Building2, Plus } from "lucide-react";
import styles from "../dashboard.module.css";

export default async function UsersPage() {
  const data = await getUsersData();

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Manage platform access and administrator accounts</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled style={{ opacity: 0.5, cursor: "not-allowed" }}>
            <Plus size={14} /> Invite User
          </button>
        </div>
      </div>

      {data ? (
        <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
          {/* Admin card */}
          <div className={styles.card}>
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb1}`}>
              <h2 className={styles.cardTitleLg}>Platform Administrators</h2>
              <span className={`${styles.badge} ${styles.badgePurple}`}>1 of 1</span>
            </div>
            <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "1rem", padding: "1rem 0", borderBottom: "1px solid rgba(117,76,190,0.1)" }}>
              <div className={styles.topnavAvatar} style={{ width: 48, height: 48, fontSize: "1rem", borderRadius: 12, flexShrink: 0 }}>
                {data.initials}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.2rem" }}>{data.name}</div>
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "1rem", flexWrap: "wrap" }}>
                  <span className={`${styles.flex} ${styles.itemsCenter} ${styles.textXs} ${styles.textMuted}`} style={{ gap: "0.3rem" }}>
                    <Mail size={11} /> {data.email}
                  </span>
                  <span className={`${styles.flex} ${styles.itemsCenter} ${styles.textXs} ${styles.textMuted}`} style={{ gap: "0.3rem" }}>
                    <Building2 size={11} /> {data.orgName}
                  </span>
                  <span className={`${styles.flex} ${styles.itemsCenter} ${styles.textXs} ${styles.textMuted}`} style={{ gap: "0.3rem" }}>
                    <Calendar size={11} /> Joined {new Date(data.createdAt).toLocaleDateString("en-CA", { year: "numeric", month: "short", day: "numeric" })}
                  </span>
                </div>
              </div>
              <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.5rem", flexShrink: 0 }}>
                <span className={`${styles.badge} ${styles.badgeGreen}`}>Active</span>
                <span className={`${styles.badge} ${styles.badgePurple}`}>Admin</span>
              </div>
            </div>
          </div>

          {/* Permissions */}
          <div className={styles.card}>
            <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Administrator Permissions</h2>
            {[
              { label: "Full Dashboard Access", desc: "View all risk scores, financial impact, and compliance data" },
              { label: "Questionnaire Management", desc: "Complete and update compliance questionnaires" },
              { label: "Action Plan Management", desc: "Manage remediation tasks and track progress" },
              { label: "Report Generation", desc: "Generate and export compliance reports" },
              { label: "Settings Management", desc: "Update organization profile and platform settings" },
            ].map(({ label, desc }) => (
              <div key={label} className={styles.toggleRow}>
                <div className={styles.toggleInfo}>
                  <span className={styles.toggleLabel}>{label}</span>
                  <span className={styles.toggleDesc}>{desc}</span>
                </div>
                <Shield size={16} style={{ color: "#22c55e", flexShrink: 0 }} />
              </div>
            ))}
          </div>

          {/* Coming soon note */}
          <div className={styles.card} style={{ borderStyle: "dashed", borderColor: "rgba(117,76,190,0.2)" }}>
            <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.75rem" }}>
              <div className={`${styles.statCardIcon} ${styles.iconPurple}`}><Plus size={18} /></div>
              <div>
                <div style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Multi-user access</div>
                <div className={`${styles.textXs} ${styles.textMuted}`}>Invite team members and assign roles — coming in a future release</div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div className={styles.emptyState}>
          <p className={styles.emptyText}>Could not load user data.</p>
        </div>
      )}
    </>
  );
}
