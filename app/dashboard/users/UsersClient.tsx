"use client";

import { useState, useTransition } from "react";
import { Mail, Calendar, Building2, Plus, X, UserCheck, Clock } from "lucide-react";
import type { UsersData, OrgInvitation } from "../queries";
import { inviteTeamMember, revokeInvitation } from "./actions";
import styles from "../dashboard.module.css";

function InviteModal({ onClose, onSuccess }: { onClose: () => void; onSuccess: () => void }) {
  const [email, setEmail] = useState("");
  const [role, setRole] = useState<"admin" | "viewer">("viewer");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await inviteTeamMember(email, role);
      if (res.error) {
        setError(res.error);
      } else {
        onSuccess();
        onClose();
      }
    });
  }

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 1000,
        background: "rgba(10,8,20,0.75)", backdropFilter: "blur(4px)",
        display: "flex", alignItems: "center", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        className={styles.card}
        style={{ width: "100%", maxWidth: 460, margin: "1rem" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={`${styles.flex} ${styles.justifyBetween} ${styles.itemsCenter} ${styles.mb1}`}>
          <h2 className={styles.cardTitleLg}>Invite Team Member</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", color: "rgba(221,215,234,0.5)", cursor: "pointer" }}>
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className={styles.field} style={{ marginBottom: "1rem" }}>
            <label className={styles.fieldLabel}>Email address</label>
            <input
              className={styles.fieldInput}
              type="email"
              placeholder="colleague@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              autoFocus
            />
          </div>

          <div className={styles.field} style={{ marginBottom: "1.25rem" }}>
            <label className={styles.fieldLabel}>Role</label>
            <select
              className={styles.fieldSelect}
              value={role}
              onChange={(e) => setRole(e.target.value as "admin" | "viewer")}
            >
              <option value="viewer">Viewer — read-only access to all dashboard pages</option>
              <option value="admin">Admin — full access, can invite others</option>
            </select>
          </div>

          {error && (
            <div style={{ padding: "0.6rem 0.9rem", background: "rgba(239,68,68,0.08)", border: "1px solid rgba(239,68,68,0.2)", borderRadius: 8, fontSize: "0.8rem", color: "#f87171", marginBottom: "1rem" }}>
              {error}
            </div>
          )}

          <div className={`${styles.flex} ${styles.gap08}`} style={{ justifyContent: "flex-end" }}>
            <button type="button" className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`} onClick={onClose}>
              Cancel
            </button>
            <button type="submit" className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`} disabled={pending}>
              <Plus size={14} /> {pending ? "Sending…" : "Send Invite"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

interface Props {
  data: UsersData;
  invitations: OrgInvitation[];
}

export default function UsersClient({ data, invitations: initialInvitations }: Props) {
  const [showModal, setShowModal] = useState(false);
  const [invitations, setInvitations] = useState(initialInvitations);
  const [revoking, setRevoking] = useState<string | null>(null);

  async function handleRevoke(id: string) {
    setRevoking(id);
    const res = await revokeInvitation(id);
    if (!res.error) {
      setInvitations((prev) => prev.filter((i) => i.id !== id));
    }
    setRevoking(null);
  }

  const isAdmin = data.role === "admin";
  const members = invitations.filter((i) => i.status === "accepted");
  const pending = invitations.filter((i) => i.status === "pending");

  return (
    <>
      {showModal && (
        <InviteModal
          onClose={() => setShowModal(false)}
          onSuccess={() => {
            // Optimistically add a pending invite placeholder; page refresh will show the real row
            setInvitations((prev) => [
              { id: crypto.randomUUID(), invitedEmail: "…", role: "viewer", status: "pending", invitedAt: new Date().toISOString(), acceptedAt: null },
              ...prev,
            ]);
          }}
        />
      )}

      <div className={styles.pageHeader}>
        <div className={styles.pageTitleGroup}>
          <h1 className={styles.pageTitle}>User Management</h1>
          <p className={styles.pageSubtitle}>Manage platform access and administrator accounts</p>
        </div>
        <div className={styles.pageActions}>
          {isAdmin && (
            <button
              className={`${styles.btn} ${styles.btnPrimary} ${styles.btnSm}`}
              onClick={() => setShowModal(true)}
            >
              <Plus size={14} /> Invite User
            </button>
          )}
        </div>
      </div>

      <div className={styles.flexCol} style={{ gap: "1.25rem" }}>
        {/* Current user card */}
        <div className={styles.card}>
          <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb1}`}>
            <h2 className={styles.cardTitleLg}>Your Account</h2>
            <span className={`${styles.badge} ${data.role === "admin" ? styles.badgePurple : styles.badgeGray}`}>
              {data.role === "admin" ? "Admin" : "Viewer"}
            </span>
          </div>
          <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "1rem", padding: "1rem 0" }}>
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
            <span className={`${styles.badge} ${styles.badgeGreen}`}>Active</span>
          </div>
        </div>

        {/* Active members */}
        {isAdmin && members.length > 0 && (
          <div className={styles.card}>
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb1}`}>
              <h2 className={styles.cardTitleLg}>Team Members</h2>
              <span className={`${styles.badge} ${styles.badgePurple}`}>{members.length}</span>
            </div>
            {members.map((m) => (
              <div
                key={m.id}
                className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween}`}
                style={{ padding: "0.75rem 0", borderBottom: "1px solid rgba(117,76,190,0.08)" }}
              >
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(117,76,190,0.2)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <UserCheck size={16} style={{ color: "#c4a8f0" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "#ddd7ea" }}>{m.invitedEmail}</div>
                    <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
                      Accepted {m.acceptedAt ? new Date(m.acceptedAt).toLocaleDateString("en-CA") : ""}
                    </div>
                  </div>
                </div>
                <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap08}`}>
                  <span className={`${styles.badge} ${m.role === "admin" ? styles.badgePurple : styles.badgeGray}`}>{m.role}</span>
                  <button
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}
                    onClick={() => handleRevoke(m.id)}
                    disabled={revoking === m.id}
                  >
                    {revoking === m.id ? "…" : "Revoke"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Pending invites */}
        {isAdmin && pending.length > 0 && (
          <div className={styles.card}>
            <div className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween} ${styles.mb1}`}>
              <h2 className={styles.cardTitleLg}>Pending Invitations</h2>
              <span className={`${styles.badge} ${styles.badgeGray}`}>{pending.length}</span>
            </div>
            {pending.map((i) => (
              <div
                key={i.id}
                className={`${styles.flex} ${styles.itemsCenter} ${styles.justifyBetween}`}
                style={{ padding: "0.75rem 0", borderBottom: "1px solid rgba(117,76,190,0.08)" }}
              >
                <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.75rem" }}>
                  <div style={{ width: 36, height: 36, borderRadius: 10, background: "rgba(117,76,190,0.08)", display: "flex", alignItems: "center", justifyContent: "center" }}>
                    <Clock size={16} style={{ color: "rgba(221,215,234,0.4)" }} />
                  </div>
                  <div>
                    <div style={{ fontSize: "0.85rem", fontWeight: 500, color: "#ddd7ea" }}>{i.invitedEmail}</div>
                    <div className={styles.textXs} style={{ color: "rgba(221,215,234,0.4)" }}>
                      Invited {new Date(i.invitedAt).toLocaleDateString("en-CA")}
                    </div>
                  </div>
                </div>
                <div className={`${styles.flex} ${styles.itemsCenter} ${styles.gap08}`}>
                  <span className={`${styles.badge} ${i.role === "admin" ? styles.badgePurple : styles.badgeGray}`}>{i.role}</span>
                  <span className={`${styles.badge} ${styles.badgeGray}`}>Pending</span>
                  <button
                    className={`${styles.btn} ${styles.btnGhost} ${styles.btnSm}`}
                    style={{ padding: "0.2rem 0.6rem", fontSize: "0.72rem" }}
                    onClick={() => handleRevoke(i.id)}
                    disabled={revoking === i.id}
                  >
                    {revoking === i.id ? "…" : "Revoke"}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Coming soon / empty state for viewers */}
        {isAdmin ? (
          <div className={styles.card} style={{ borderStyle: "dashed", borderColor: "rgba(117,76,190,0.2)" }}>
            <div className={`${styles.flex} ${styles.itemsCenter}`} style={{ gap: "0.75rem" }}>
              <div className={`${styles.statCardIcon} ${styles.iconPurple}`}><Plus size={18} /></div>
              <div>
                <div style={{ fontWeight: 600, color: "#ddd7ea", fontSize: "0.9rem" }}>Role management</div>
                <div className={`${styles.textXs} ${styles.textMuted}`}>Per-page permissions and custom roles — coming in a future release</div>
              </div>
            </div>
          </div>
        ) : (
          <div className={styles.card} style={{ textAlign: "center", padding: "2rem" }}>
            <div className={styles.textSm} style={{ color: "rgba(221,215,234,0.5)" }}>
              You have view-only access. Contact your organization admin to change your role.
            </div>
          </div>
        )}
      </div>
    </>
  );
}
