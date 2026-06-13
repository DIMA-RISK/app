"use client";

import React, { useState, useMemo } from "react";

// ─────────────────────────────────────────────
// TYPES & INTERFACES
// ─────────────────────────────────────────────

type Role = "Founder / Admin" | "Manager" | "Employee";
type Department = "Engineering" | "Design" | "Operations" | "All";
type EmploymentType = "Full-time" | "Part-time" | "Contractor" | "Advisor" | "All";
type Status = "Active" | "On Leave" | "Former" | "All";
type ShareFilter = "Has Shares" | "No Shares" | "All";
type SortBy = "Name" | "Start Date" | "Ownership %";
type ViewMode = "Table" | "Card";
type ShareClass = "Common" | "Preferred" | "Options";

interface VestingSchedule {
  grantDate: string;
  cliffDate: string;
  fullyVestedDate: string;
  totalMonths: number;
  vestedMonths: number;
}

interface Employee {
  id: string;
  name: string;
  email: string;
  linkedin: string;
  avatar: string;
  jobTitle: string;
  department: Exclude<Department, "All">;
  employmentType: Exclude<EmploymentType, "All">;
  startDate: string;
  status: Exclude<Status, "All">;
  sharesOwned: number;
  shareClass: ShareClass;
  vesting: VestingSchedule | null;
  activityLog: { date: string; action: string; by: string }[];
}

// ─────────────────────────────────────────────
// MOCK DATA
// ─────────────────────────────────────────────

const TOTAL_SHARE_POOL = 10_000_000;

const EMPLOYEES: Employee[] = [
  {
    id: "emp-001",
    name: "Layla Al-Hassan",
    email: "layla.alhassan@acme.io",
    linkedin: "linkedin.com/in/laylahassan",
    avatar: "LA",
    jobTitle: "Co-Founder & CTO",
    department: "Engineering",
    employmentType: "Full-time",
    startDate: "2019-03-01",
    status: "Active",
    sharesOwned: 2_400_000,
    shareClass: "Common",
    vesting: {
      grantDate: "2019-03-01",
      cliffDate: "2020-03-01",
      fullyVestedDate: "2023-03-01",
      totalMonths: 48,
      vestedMonths: 48,
    },
    activityLog: [
      { date: "2024-11-01", action: "Role updated to Co-Founder & CTO", by: "System" },
      { date: "2023-03-01", action: "Shares fully vested (2,400,000)", by: "System" },
      { date: "2020-03-01", action: "Cliff reached — 25% released", by: "System" },
    ],
  },
  {
    id: "emp-002",
    name: "Omar Shaikh",
    email: "omar.shaikh@acme.io",
    linkedin: "linkedin.com/in/omarshaikh",
    avatar: "OS",
    jobTitle: "Senior Full-Stack Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    startDate: "2020-07-15",
    status: "Active",
    sharesOwned: 320_000,
    shareClass: "Options",
    vesting: {
      grantDate: "2020-07-15",
      cliffDate: "2021-07-15",
      fullyVestedDate: "2024-07-15",
      totalMonths: 48,
      vestedMonths: 48,
    },
    activityLog: [
      { date: "2024-07-15", action: "Options fully vested (320,000)", by: "System" },
      { date: "2022-01-10", action: "Title changed to Senior Full-Stack Engineer", by: "Layla Al-Hassan" },
      { date: "2021-07-15", action: "Cliff reached — options unlocked", by: "System" },
    ],
  },
  {
    id: "emp-003",
    name: "Sara Nour",
    email: "sara.nour@acme.io",
    linkedin: "linkedin.com/in/saranour",
    avatar: "SN",
    jobTitle: "Lead Product Designer",
    department: "Design",
    employmentType: "Full-time",
    startDate: "2021-02-01",
    status: "Active",
    sharesOwned: 180_000,
    shareClass: "Options",
    vesting: {
      grantDate: "2021-02-01",
      cliffDate: "2022-02-01",
      fullyVestedDate: "2025-02-01",
      totalMonths: 48,
      vestedMonths: 40,
    },
    activityLog: [
      { date: "2024-10-01", action: "Promotion: Lead Product Designer", by: "Layla Al-Hassan" },
      { date: "2022-02-01", action: "Cliff vesting reached", by: "System" },
      { date: "2021-02-01", action: "Onboarded — option grant issued", by: "HR System" },
    ],
  },
  {
    id: "emp-004",
    name: "James Whitfield",
    email: "james.whitfield@acme.io",
    linkedin: "linkedin.com/in/jameswhitfield",
    avatar: "JW",
    jobTitle: "Head of Operations",
    department: "Operations",
    employmentType: "Full-time",
    startDate: "2020-01-10",
    status: "Active",
    sharesOwned: 250_000,
    shareClass: "Common",
    vesting: {
      grantDate: "2020-01-10",
      cliffDate: "2021-01-10",
      fullyVestedDate: "2024-01-10",
      totalMonths: 48,
      vestedMonths: 48,
    },
    activityLog: [
      { date: "2024-01-10", action: "Shares fully vested", by: "System" },
      { date: "2021-01-10", action: "Cliff vesting reached", by: "System" },
      { date: "2020-01-10", action: "Joined as Operations Manager", by: "HR System" },
    ],
  },
  {
    id: "emp-005",
    name: "Priya Mehta",
    email: "priya.mehta@acme.io",
    linkedin: "linkedin.com/in/priyamehta",
    avatar: "PM",
    jobTitle: "UX Researcher",
    department: "Design",
    employmentType: "Part-time",
    startDate: "2022-05-20",
    status: "Active",
    sharesOwned: 0,
    shareClass: "Common",
    vesting: null,
    activityLog: [
      { date: "2022-05-20", action: "Joined as UX Researcher (Part-time)", by: "HR System" },
    ],
  },
  {
    id: "emp-006",
    name: "Kevin Boateng",
    email: "kevin.boateng@acme.io",
    linkedin: "linkedin.com/in/kevinboateng",
    avatar: "KB",
    jobTitle: "Backend Engineer",
    department: "Engineering",
    employmentType: "Contractor",
    startDate: "2023-01-03",
    status: "Active",
    sharesOwned: 0,
    shareClass: "Common",
    vesting: null,
    activityLog: [
      { date: "2023-01-03", action: "Contract started — Backend Engineer", by: "HR System" },
      { date: "2024-01-03", action: "Contract renewed for 12 months", by: "James Whitfield" },
    ],
  },
  {
    id: "emp-007",
    name: "Diana Ferreira",
    email: "diana.ferreira@acme.io",
    linkedin: "linkedin.com/in/dianaferreira",
    avatar: "DF",
    jobTitle: "Strategic Advisor",
    department: "Operations",
    employmentType: "Advisor",
    startDate: "2021-09-01",
    status: "Active",
    sharesOwned: 75_000,
    shareClass: "Options",
    vesting: {
      grantDate: "2021-09-01",
      cliffDate: "2022-03-01",
      fullyVestedDate: "2023-09-01",
      totalMonths: 24,
      vestedMonths: 24,
    },
    activityLog: [
      { date: "2023-09-01", action: "Advisor options fully vested", by: "System" },
      { date: "2021-09-01", action: "Advisor agreement signed", by: "Layla Al-Hassan" },
    ],
  },
  {
    id: "emp-008",
    name: "Marcus Tan",
    email: "marcus.tan@acme.io",
    linkedin: "linkedin.com/in/marcustan",
    avatar: "MT",
    jobTitle: "DevOps Engineer",
    department: "Engineering",
    employmentType: "Full-time",
    startDate: "2022-08-15",
    status: "On Leave",
    sharesOwned: 120_000,
    shareClass: "Options",
    vesting: {
      grantDate: "2022-08-15",
      cliffDate: "2023-08-15",
      fullyVestedDate: "2026-08-15",
      totalMonths: 48,
      vestedMonths: 22,
    },
    activityLog: [
      { date: "2024-11-01", action: "Placed on parental leave", by: "James Whitfield" },
      { date: "2023-08-15", action: "Cliff reached — options begin monthly vesting", by: "System" },
      { date: "2022-08-15", action: "Joined as DevOps Engineer", by: "HR System" },
    ],
  },
  {
    id: "emp-009",
    name: "Nadia Wolff",
    email: "nadia.wolff@acme.io",
    linkedin: "linkedin.com/in/nadiawolff",
    avatar: "NW",
    jobTitle: "Brand Designer",
    department: "Design",
    employmentType: "Full-time",
    startDate: "2019-11-01",
    status: "Former",
    sharesOwned: 95_000,
    shareClass: "Common",
    vesting: {
      grantDate: "2019-11-01",
      cliffDate: "2020-11-01",
      fullyVestedDate: "2023-11-01",
      totalMonths: 48,
      vestedMonths: 48,
    },
    activityLog: [
      { date: "2024-03-15", action: "Departed — shares retained per agreement", by: "Layla Al-Hassan" },
      { date: "2023-11-01", action: "Shares fully vested", by: "System" },
      { date: "2019-11-01", action: "Joined as Brand Designer", by: "HR System" },
    ],
  },
];

// The "logged-in" employee (for Employee role view)
const CURRENT_USER_ID = "emp-003";

// ─────────────────────────────────────────────
// HELPERS
// ─────────────────────────────────────────────

const totalIssuedShares = EMPLOYEES.reduce((s, e) => s + e.sharesOwned, 0);
const departments = [...new Set(EMPLOYEES.map((e) => e.department))];

function ownershipPct(shares: number): string {
  if (shares === 0) return "0.00%";
  return ((shares / TOTAL_SHARE_POOL) * 100).toFixed(2) + "%";
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function avatarBg(initials: string): string {
  const colors = [
    "bg-violet-600", "bg-indigo-600", "bg-sky-600",
    "bg-teal-600", "bg-emerald-600", "bg-amber-600",
    "bg-rose-600", "bg-pink-600",
  ];
  const idx = (initials.charCodeAt(0) + initials.charCodeAt(1)) % colors.length;
  return colors[idx];
}

// ─────────────────────────────────────────────
// SUB-COMPONENTS
// ─────────────────────────────────────────────

const StatusBadge: React.FC<{ status: Employee["status"] }> = ({ status }) => {
  const map: Record<Employee["status"], string> = {
    Active: "bg-emerald-100 text-emerald-700 ring-1 ring-emerald-300",
    "On Leave": "bg-amber-100 text-amber-700 ring-1 ring-amber-300",
    Former: "bg-slate-100 text-slate-500 ring-1 ring-slate-300",
  };
  return (
    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-xs font-medium ${map[status]}`}>
      <span className={`h-1.5 w-1.5 rounded-full ${status === "Active" ? "bg-emerald-500" : status === "On Leave" ? "bg-amber-500" : "bg-slate-400"}`} />
      {status}
    </span>
  );
};

const TypeBadge: React.FC<{ type: Employee["employmentType"] }> = ({ type }) => {
  const map: Record<Employee["employmentType"], string> = {
    "Full-time": "bg-blue-50 text-blue-700",
    "Part-time": "bg-purple-50 text-purple-700",
    Contractor: "bg-orange-50 text-orange-700",
    Advisor: "bg-teal-50 text-teal-700",
  };
  return (
    <span className={`inline-flex rounded-md px-2 py-0.5 text-xs font-medium ${map[type]}`}>{type}</span>
  );
};

const Avatar: React.FC<{ initials: string; size?: "sm" | "md" | "lg" }> = ({ initials, size = "sm" }) => {
  const sizeClass = { sm: "h-8 w-8 text-xs", md: "h-10 w-10 text-sm", lg: "h-16 w-16 text-xl" }[size];
  return (
    <div className={`${sizeClass} ${avatarBg(initials)} flex items-center justify-center rounded-full font-bold text-white select-none`}>
      {initials}
    </div>
  );
};

// ─────────────────────────────────────────────
// VESTING PROGRESS BAR
// ─────────────────────────────────────────────

const VestingBar: React.FC<{ vesting: VestingSchedule }> = ({ vesting }) => {
  const pct = Math.min(100, Math.round((vesting.vestedMonths / vesting.totalMonths) * 100));
  const cliffPct = Math.round((12 / vesting.totalMonths) * 100);
  return (
    <div className="space-y-2">
      <div className="flex justify-between text-xs text-slate-500">
        <span>Grant: {formatDate(vesting.grantDate)}</span>
        <span>Fully Vested: {formatDate(vesting.fullyVestedDate)}</span>
      </div>
      <div className="relative h-3 w-full rounded-full bg-slate-100 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-violet-500 to-indigo-500 transition-all duration-500"
          style={{ width: `${pct}%` }}
        />
        {/* Cliff marker */}
        <div
          className="absolute top-0 h-full w-0.5 bg-amber-400"
          style={{ left: `${cliffPct}%` }}
          title="1-year cliff"
        />
      </div>
      <div className="flex justify-between text-xs">
        <span className="text-slate-500">
          {vesting.vestedMonths} / {vesting.totalMonths} months vested
        </span>
        <span className="font-semibold text-violet-700">{pct}% complete</span>
      </div>
      <div className="flex gap-4 text-xs text-slate-500 pt-0.5">
        <span>
          <span className="font-medium text-amber-600">Cliff:</span> {formatDate(vesting.cliffDate)}
        </span>
        {pct === 100 && (
          <span className="text-emerald-600 font-medium">✓ Fully Vested</span>
        )}
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// EMPLOYEE MODAL
// ─────────────────────────────────────────────

const EmployeeModal: React.FC<{
  employee: Employee;
  role: Role;
  onClose: () => void;
}> = ({ employee, role, onClose }) => {
  const showEquity = role === "Founder / Admin";
  const ownership = ((employee.sharesOwned / TOTAL_SHARE_POOL) * 100).toFixed(4);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4"
      onClick={(e) => e.target === e.currentTarget && onClose()}
    >
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Modal Header */}
        <div className="relative bg-gradient-to-r from-slate-800 to-slate-900 rounded-t-2xl px-6 pt-6 pb-8">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-slate-400 hover:text-white transition-colors p-1"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
          <div className="flex items-center gap-4">
            <Avatar initials={employee.avatar} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-white">{employee.name}</h2>
              <p className="text-slate-300 text-sm">{employee.jobTitle}</p>
              <div className="mt-2 flex items-center gap-2">
                <StatusBadge status={employee.status} />
                <TypeBadge type={employee.employmentType} />
              </div>
            </div>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* Personal & Role Info */}
          <div className="grid grid-cols-2 gap-6">
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Personal Info
              </h3>
              <dl className="space-y-2.5">
                {[
                  ["Email", employee.email],
                  ["LinkedIn", employee.linkedin],
                ].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-400">{label}</dt>
                    <dd className="text-sm font-medium text-slate-800 break-all">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
            <section>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
                Role Info
              </h3>
              <dl className="space-y-2.5">
                {[
                  ["Department", employee.department],
                  ["Start Date", formatDate(employee.startDate)],
                  ["Type", employee.employmentType],
                ].map(([label, val]) => (
                  <div key={label}>
                    <dt className="text-xs text-slate-400">{label}</dt>
                    <dd className="text-sm font-medium text-slate-800">{val}</dd>
                  </div>
                ))}
              </dl>
            </section>
          </div>

          {/* Equity Details — Admin Only */}
          {showEquity && (
            <section className="rounded-xl border border-violet-200 bg-violet-50 p-4">
              <div className="flex items-center gap-2 mb-4">
                <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                </svg>
                <h3 className="text-xs font-semibold uppercase tracking-widest text-violet-700">
                  Equity Details · Admin Only
                </h3>
              </div>

              {employee.sharesOwned > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      ["Shares Owned", employee.sharesOwned.toLocaleString()],
                      ["Share Class", employee.shareClass],
                      ["Ownership %", `${ownership}%`],
                    ].map(([label, val]) => (
                      <div key={label} className="bg-white rounded-lg p-3 border border-violet-100">
                        <div className="text-xs text-slate-400">{label}</div>
                        <div className="text-sm font-bold text-slate-800 mt-0.5">{val}</div>
                      </div>
                    ))}
                  </div>

                  {employee.vesting && (
                    <div className="bg-white rounded-lg p-4 border border-violet-100">
                      <h4 className="text-xs font-semibold text-slate-600 mb-3">Vesting Schedule</h4>
                      <VestingBar vesting={employee.vesting} />
                    </div>
                  )}
                </div>
              ) : (
                <p className="text-sm text-slate-500">No equity grant on record.</p>
              )}
            </section>
          )}

          {/* Activity Log */}
          <section>
            <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">
              Activity Log
            </h3>
            <ul className="space-y-2">
              {employee.activityLog.map((entry, i) => (
                <li
                  key={i}
                  className="flex gap-3 text-sm border-l-2 border-slate-200 pl-3 py-1 hover:border-violet-400 transition-colors"
                >
                  <div className="flex-1">
                    <p className="text-slate-700">{entry.action}</p>
                    <p className="text-xs text-slate-400 mt-0.5">
                      {formatDate(entry.date)} · by {entry.by}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        </div>
      </div>
    </div>
  );
};

// ─────────────────────────────────────────────
// STAT CARD
// ─────────────────────────────────────────────

const StatCard: React.FC<{
  label: string;
  value: string;
  sub?: string;
  icon: React.ReactNode;
  accent: string;
}> = ({ label, value, sub, icon, accent }) => (
  <div className={`bg-white rounded-xl border border-slate-200 p-5 flex gap-4 items-start shadow-sm hover:shadow-md transition-shadow`}>
    <div className={`${accent} p-2.5 rounded-lg`}>{icon}</div>
    <div>
      <p className="text-xs text-slate-500 font-medium uppercase tracking-wide">{label}</p>
      <p className="text-2xl font-bold text-slate-900 mt-0.5">{value}</p>
      {sub && <p className="text-xs text-slate-400 mt-0.5">{sub}</p>}
    </div>
  </div>
);

// ─────────────────────────────────────────────
// MAIN COMPONENT
// ─────────────────────────────────────────────

export default function EmployeeEquityDashboard() {
  // Role simulation
  const [activeRole, setActiveRole] = useState<Role>("Founder / Admin");

  // Filters
  const [search, setSearch] = useState("");
  const [filterDept, setFilterDept] = useState<Department>("All");
  const [filterType, setFilterType] = useState<EmploymentType>("All");
  const [filterStatus, setFilterStatus] = useState<Status>("All");
  const [filterShares, setFilterShares] = useState<ShareFilter>("All");
  const [sortBy, setSortBy] = useState<SortBy>("Name");
  const [viewMode, setViewMode] = useState<ViewMode>("Table");

  // Modal
  const [selectedEmployee, setSelectedEmployee] = useState<Employee | null>(null);

  // Current user (for Employee role)
  const currentUser = EMPLOYEES.find((e) => e.id === CURRENT_USER_ID)!;

  // ── Filtered + Sorted employees ──
  const filteredEmployees = useMemo(() => {
    let list = [...EMPLOYEES];

    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter(
        (e) => e.name.toLowerCase().includes(q) || e.email.toLowerCase().includes(q)
      );
    }
    if (filterDept !== "All") list = list.filter((e) => e.department === filterDept);
    if (filterType !== "All") list = list.filter((e) => e.employmentType === filterType);
    if (filterStatus !== "All") list = list.filter((e) => e.status === filterStatus);
    if (filterShares === "Has Shares") list = list.filter((e) => e.sharesOwned > 0);
    if (filterShares === "No Shares") list = list.filter((e) => e.sharesOwned === 0);

    list.sort((a, b) => {
      if (sortBy === "Name") return a.name.localeCompare(b.name);
      if (sortBy === "Start Date") return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (sortBy === "Ownership %") return b.sharesOwned - a.sharesOwned;
      return 0;
    });

    return list;
  }, [search, filterDept, filterType, filterStatus, filterShares, sortBy]);

  // ── Summary stats ──
  const activeCount = EMPLOYEES.filter((e) => e.status === "Active").length;
  const availablePool = TOTAL_SHARE_POOL - totalIssuedShares;

  // ─────────────────────────────────────────────
  // RENDER — Employee role: own profile only
  // ─────────────────────────────────────────────

  const renderEmployeeView = () => (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-800 to-slate-900 px-6 pt-6 pb-8">
          <div className="flex items-center gap-4">
            <Avatar initials={currentUser.avatar} size="lg" />
            <div>
              <h2 className="text-xl font-bold text-white">{currentUser.name}</h2>
              <p className="text-slate-300">{currentUser.jobTitle}</p>
              <div className="mt-2 flex gap-2">
                <StatusBadge status={currentUser.status} />
                <TypeBadge type={currentUser.employmentType} />
              </div>
            </div>
          </div>
        </div>
        <div className="p-6 space-y-5">
          <div className="grid grid-cols-2 gap-6">
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Personal</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-slate-400">Email</dt>
                  <dd className="text-sm text-slate-800">{currentUser.email}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">LinkedIn</dt>
                  <dd className="text-sm text-slate-800">{currentUser.linkedin}</dd>
                </div>
              </dl>
            </div>
            <div>
              <h3 className="text-xs font-semibold uppercase tracking-widest text-slate-400 mb-3">Role</h3>
              <dl className="space-y-2">
                <div>
                  <dt className="text-xs text-slate-400">Department</dt>
                  <dd className="text-sm text-slate-800">{currentUser.department}</dd>
                </div>
                <div>
                  <dt className="text-xs text-slate-400">Start Date</dt>
                  <dd className="text-sm text-slate-800">{formatDate(currentUser.startDate)}</dd>
                </div>
              </dl>
            </div>
          </div>
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-4 text-sm text-amber-700">
            <strong>Note:</strong> Equity details are visible to administrators only. Contact your HR admin for equity inquiries.
          </div>
        </div>
      </div>
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER — Table view
  // ─────────────────────────────────────────────

  const renderTable = () => (
    <div className="overflow-x-auto rounded-xl border border-slate-200 shadow-sm bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50">
            {["Employee", "Title", "Department", "Type", "Start Date", "Status", ...(activeRole === "Founder / Admin" ? ["Shares", "Ownership %"] : []), ""].map((h) => (
              <th key={h} className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-slate-500 whitespace-nowrap">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {filteredEmployees.length === 0 ? (
            <tr>
              <td colSpan={10} className="px-4 py-12 text-center text-slate-400 text-sm">
                No employees match the current filters.
              </td>
            </tr>
          ) : (
            filteredEmployees.map((emp) => (
              <tr
                key={emp.id}
                className="border-b border-slate-100 hover:bg-slate-50 cursor-pointer transition-colors"
                onClick={() => setSelectedEmployee(emp)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <Avatar initials={emp.avatar} />
                    <div>
                      <p className="font-medium text-slate-900 whitespace-nowrap">{emp.name}</p>
                      <p className="text-xs text-slate-400">{emp.email}</p>
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">{emp.jobTitle}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{emp.department}</span>
                </td>
                <td className="px-4 py-3">
                  <TypeBadge type={emp.employmentType} />
                </td>
                <td className="px-4 py-3 text-slate-500 whitespace-nowrap">{formatDate(emp.startDate)}</td>
                <td className="px-4 py-3">
                  <StatusBadge status={emp.status} />
                </td>
                {activeRole === "Founder / Admin" && (
                  <>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {emp.sharesOwned > 0 ? emp.sharesOwned.toLocaleString() : <span className="text-slate-300">—</span>}
                    </td>
                    <td className="px-4 py-3 font-mono text-slate-700">
                      {emp.sharesOwned > 0 ? ownershipPct(emp.sharesOwned) : <span className="text-slate-300">—</span>}
                    </td>
                  </>
                )}
                <td className="px-4 py-3">
                  <button
                    className="text-xs text-violet-600 hover:text-violet-800 font-medium px-2.5 py-1 rounded-lg hover:bg-violet-50 transition-colors"
                    onClick={(e) => { e.stopPropagation(); setSelectedEmployee(emp); }}
                  >
                    View
                  </button>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  );

  // ─────────────────────────────────────────────
  // RENDER — Card view
  // ─────────────────────────────────────────────

  const renderCards = () => (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
      {filteredEmployees.length === 0 ? (
        <p className="col-span-3 text-center text-slate-400 py-12">No employees match the current filters.</p>
      ) : (
        filteredEmployees.map((emp) => (
          <div
            key={emp.id}
            className="bg-white rounded-xl border border-slate-200 p-4 hover:shadow-md cursor-pointer transition-all hover:-translate-y-0.5"
            onClick={() => setSelectedEmployee(emp)}
          >
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-3">
                <Avatar initials={emp.avatar} size="md" />
                <div>
                  <p className="font-semibold text-slate-900 text-sm">{emp.name}</p>
                  <p className="text-xs text-slate-400">{emp.jobTitle}</p>
                </div>
              </div>
              <StatusBadge status={emp.status} />
            </div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              <span className="text-xs bg-slate-100 text-slate-600 rounded px-2 py-0.5">{emp.department}</span>
              <TypeBadge type={emp.employmentType} />
            </div>
            <div className="text-xs text-slate-400 border-t border-slate-100 pt-3 flex justify-between">
              <span>Since {formatDate(emp.startDate)}</span>
              {activeRole === "Founder / Admin" && emp.sharesOwned > 0 && (
                <span className="font-mono text-violet-600">{ownershipPct(emp.sharesOwned)}</span>
              )}
            </div>
          </div>
        ))
      )}
    </div>
  );

  // ─────────────────────────────────────────────
  // MAIN RENDER
  // ─────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-slate-50 font-sans">
      {/* Top Admin Bar */}
      <div className="bg-white border-b border-slate-200 px-6 py-2.5">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
          <div className="flex items-center gap-2 text-sm">
            <svg className="w-4 h-4 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 7a2 2 0 012 2m4 0a6 6 0 01-7.743 5.743L11 17H9v2H7v2H4a1 1 0 01-1-1v-2.586a1 1 0 01.293-.707l5.964-5.964A6 6 0 1121 9z" />
            </svg>
            <span className="font-medium text-slate-600">Viewing as Role:</span>
          </div>
          <div className="flex items-center gap-2">
            {(["Founder / Admin", "Manager", "Employee"] as Role[]).map((r) => (
              <button
                key={r}
                onClick={() => setActiveRole(r)}
                className={`px-3 py-1 rounded-lg text-xs font-medium transition-all ${
                  activeRole === r
                    ? "bg-violet-600 text-white shadow-sm"
                    : "text-slate-500 hover:bg-slate-100"
                }`}
              >
                {r}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-6">

        {/* Page Header */}
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Employee Directory</h1>
          <p className="text-sm text-slate-500 mt-0.5">
            {activeRole === "Employee"
              ? "Your profile"
              : `${filteredEmployees.length} employee${filteredEmployees.length !== 1 ? "s" : ""} · Internal use only`}
          </p>
        </div>

        {/* Employee role: own profile */}
        {activeRole === "Employee" ? (
          renderEmployeeView()
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
              <StatCard
                label="Total Employees"
                value={EMPLOYEES.length.toString()}
                sub={`${activeCount} active`}
                accent="bg-violet-100"
                icon={
                  <svg className="w-5 h-5 text-violet-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Total Shares Issued"
                value={totalIssuedShares.toLocaleString()}
                sub={`of ${TOTAL_SHARE_POOL.toLocaleString()} total`}
                accent="bg-indigo-100"
                icon={
                  <svg className="w-5 h-5 text-indigo-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                  </svg>
                }
              />
              <StatCard
                label="Available Share Pool"
                value={availablePool.toLocaleString()}
                sub={`${((availablePool / TOTAL_SHARE_POOL) * 100).toFixed(1)}% unallocated`}
                accent="bg-emerald-100"
                icon={
                  <svg className="w-5 h-5 text-emerald-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                  </svg>
                }
              />
              <StatCard
                label="Departments"
                value={departments.length.toString()}
                sub={departments.join(", ")}
                accent="bg-amber-100"
                icon={
                  <svg className="w-5 h-5 text-amber-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                }
              />
            </div>

            {/* Filters */}
            <div className="bg-white rounded-xl border border-slate-200 p-4 shadow-sm">
              <div className="flex flex-wrap gap-3 items-center">
                {/* Search */}
                <div className="relative flex-1 min-w-[200px]">
                  <svg className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
                  </svg>
                  <input
                    type="text"
                    placeholder="Search name or email…"
                    value={search}
                    onChange={(e) => setSearch(e.target.value)}
                    className="w-full pl-9 pr-3 py-2 text-sm border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-violet-400 focus:border-transparent"
                  />
                </div>

                {/* Dropdown filters */}
                {[
                  {
                    label: "Department",
                    value: filterDept,
                    onChange: setFilterDept,
                    options: ["All", "Engineering", "Design", "Operations"],
                  },
                  {
                    label: "Type",
                    value: filterType,
                    onChange: setFilterType,
                    options: ["All", "Full-time", "Part-time", "Contractor", "Advisor"],
                  },
                  {
                    label: "Status",
                    value: filterStatus,
                    onChange: setFilterStatus,
                    options: ["All", "Active", "On Leave", "Former"],
                  },
                  ...(activeRole === "Founder / Admin"
                    ? [{ label: "Shares", value: filterShares, onChange: setFilterShares, options: ["All", "Has Shares", "No Shares"] }]
                    : []),
                ].map((f) => (
                  <select
                    key={f.label}
                    value={f.value}
                    onChange={(e) => (f.onChange as (v: string) => void)(e.target.value)}
                    className="py-2 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700"
                  >
                    {f.options.map((o) => (
                      <option key={o} value={o}>{f.label}: {o}</option>
                    ))}
                  </select>
                ))}

                {/* Sort */}
                <select
                  value={sortBy}
                  onChange={(e) => setSortBy(e.target.value as SortBy)}
                  className="py-2 pl-3 pr-8 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-violet-400 text-slate-700"
                >
                  {["Name", "Start Date", "Ownership %"].map((o) => (
                    <option key={o} value={o}>Sort: {o}</option>
                  ))}
                </select>

                {/* View toggle */}
                <div className="flex rounded-lg border border-slate-200 overflow-hidden ml-auto">
                  {(["Table", "Card"] as ViewMode[]).map((v) => (
                    <button
                      key={v}
                      onClick={() => setViewMode(v)}
                      className={`px-3 py-2 text-xs font-medium transition-colors ${
                        viewMode === v ? "bg-violet-600 text-white" : "text-slate-500 hover:bg-slate-50"
                      }`}
                    >
                      {v === "Table" ? (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 6h18M3 14h18M3 18h18" />
                        </svg>
                      ) : (
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      )}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Results count */}
            <p className="text-xs text-slate-400">
              Showing {filteredEmployees.length} of {EMPLOYEES.length} employees
            </p>

            {/* Directory */}
            {viewMode === "Table" ? renderTable() : renderCards()}
          </>
        )}
      </div>

      {/* Modal */}
      {selectedEmployee && (
        <EmployeeModal
          employee={selectedEmployee}
          role={activeRole}
          onClose={() => setSelectedEmployee(null)}
        />
      )}
    </div>
  );
}