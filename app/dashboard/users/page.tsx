"use client";

import { useState } from "react";
import { Plus, Mail, MoreHorizontal } from "lucide-react";
import styles from "../dashboard.module.css";

const USERS = [
  { id: 1, name: "Younes A.", email: "admin@acmehealth.ca", role: "Admin", status: "active", lastLogin: "Today, 14:32", initials: "YA" },
  { id: 2, name: "Jane Doe", email: "jane.doe@acmehealth.ca", role: "Compliance Officer", status: "active", lastLogin: "Today, 09:15", initials: "JD" },
  { id: 3, name: "IT Support", email: "it@acmehealth.ca", role: "Viewer", status: "active", lastLogin: "Yesterday", initials: "IT" },
  { id: 4, name: "Sarah Legal", email: "slegal@acmehealth.ca", role: "Viewer", status: "invited", lastLogin: "Never", initials: "SL" },
];

const ROLE_BADGE: Record<string, string> = {
  Admin: styles.badgePurple, "Compliance Officer": styles.badgeInfo, Viewer: styles.badgeGray,
};
const STATUS_BADGE: Record<string, string> = {
  active: styles.badgeGreen, invited: styles.badgeMedium, disabled: styles.badgeGray,
};

export default function UsersPage() {
  const [showInvite, setShowInvite] = useState(false);

  return (
    <>
      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Manage who has access to your DIMA Risk workspace</p>
        </div>
        <div className={styles.pageActions}>
          <button className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} onClick={() => setShowInvite(true)}>
            <Plus size={14} /> Invite User
          </button>
        </div>
      </div>

      {/* Invite form */}
      {showInvite && (
        <div className={`${styles.card} ${styles.mb15}`} style={{ borderColor: "rgba(117,76,190,0.4)" }}>
          <h2 className={`${styles.cardTitleLg} ${styles.mb1}`}>Invite a New User</h2>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr auto", gap: "1rem", alignItems: "end" }}>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Email Address</label>
              <input className={styles.fieldInput} placeholder="colleague@company.com" type="email" />
            </div>
            <div className={styles.field}>
              <label className={styles.fieldLabel}>Role</label>
              <select className={styles.fieldSelect}>
                <option>Admin</option>
                <option>Compliance Officer</option>
                <option>Viewer</option>
              </select>
            </div>
            <div className={`${styles.flex} ${styles.gap04}`}>
              <button className={`${styles.btn} ${styles.btnPrimary}`}><Mail size={14} /> Send Invite</button>
              <button className={`${styles.btn} ${styles.btnGhost}`} onClick={() => setShowInvite(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* User table */}
      <div className={styles.card} style={{ padding: 0, overflow: "hidden" }}>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Role</th>
                <th>Status</th>
                <th>Last Login</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              {USERS.map((u) => (
                <tr key={u.id}>
                  <td>
                    <div className={`${styles.flex} ${styles.gap08} ${styles.itemsCenter}`}>
                      <div className={styles.topnavAvatar} style={{ width: 32, height: 32, fontSize: "0.72rem" }}>{u.initials}</div>
                      <span style={{ fontWeight: 500, color: "#ddd7ea" }}>{u.name}</span>
                    </div>
                  </td>
                  <td><span className={styles.textSm}>{u.email}</span></td>
                  <td><span className={`${styles.badge} ${ROLE_BADGE[u.role]}`}>{u.role}</span></td>
                  <td><span className={`${styles.badge} ${STATUS_BADGE[u.status]}`}>{u.status}</span></td>
                  <td><span className={styles.textXs} style={{ color: "rgba(221,215,234,0.45)" }}>{u.lastLogin}</span></td>
                  <td>
                    <div className={`${styles.flex} ${styles.gap04}`}>
                      <button className={`${styles.btn} ${styles.btnGhost} ${styles.btnXs}`}>Edit</button>
                      <button className={`${styles.btn} ${styles.btnDanger} ${styles.btnXs}`}>Disable</button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Role permissions reference */}
      <div className={`${styles.card} ${styles.mt1}`}>
        <h2 className={`${styles.cardTitle} ${styles.mb1}`}>Role Permissions</h2>
        <div className={styles.grid3}>
          {[
            { role: "Admin", perms: ["Full dashboard access", "Edit questionnaire", "Manage users", "Generate reports", "Change settings"] },
            { role: "Compliance Officer", perms: ["Full dashboard access", "Edit questionnaire", "Upload evidence", "Generate reports", "Read-only settings"] },
            { role: "Viewer", perms: ["View dashboard", "View reports", "No edit access", "No user management"] },
          ].map((r) => (
            <div key={r.role} style={{ padding: "0.75rem", background: "rgba(0,2,18,0.3)", borderRadius: 8 }}>
              <div style={{ fontWeight: 600, color: "#ddd7ea", marginBottom: "0.6rem", fontSize: "0.875rem" }}>{r.role}</div>
              {r.perms.map((p) => (
                <div key={p} className={styles.textXs} style={{ color: "rgba(221,215,234,0.55)", padding: "0.2rem 0" }}>
                  {p.startsWith("No") ? "✗ " : "✓ "}{p}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>
    </>
  );
}
