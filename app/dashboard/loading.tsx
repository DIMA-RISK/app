import styles from "./dashboard.module.css";

function SkeletonBlock({ h = 120, mb = 16 }: { h?: number; mb?: number }) {
  return (
    <div className={styles.skeleton} style={{ height: h, marginBottom: mb, borderRadius: 14 }} />
  );
}

export default function DashboardLoading() {
  return (
    <div style={{ padding: "1.75rem 2rem" }}>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "1.5rem" }}>
        <div>
          <SkeletonBlock h={28} mb={8} />
          <SkeletonBlock h={16} mb={0} />
        </div>
      </div>
      {/* Stat cards */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: "1rem", marginBottom: "1.5rem" }}>
        {[1,2,3,4].map((i) => <SkeletonBlock key={i} h={110} mb={0} />)}
      </div>
      {/* Main content */}
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem", marginBottom: "1.25rem" }}>
        <SkeletonBlock h={320} mb={0} />
        <SkeletonBlock h={320} mb={0} />
      </div>
      <div style={{ display: "grid", gridTemplateColumns: "2fr 1fr", gap: "1.25rem" }}>
        <SkeletonBlock h={220} mb={0} />
        <SkeletonBlock h={220} mb={0} />
      </div>
    </div>
  );
}
