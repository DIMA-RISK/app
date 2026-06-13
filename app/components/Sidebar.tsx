"use client";

import Link from "next/link";
import { useState } from "react";

const NAV_ITEMS = [
  { id: "overview", label: "Overview" },
  { id: "risks", label: "Risks" },
  { id: "compliance", label: "Compliance" },
  { id: "action-plan", label: "Action Plan" },
  { id: "assets", label: "Assets" },
  { id: "reports", label: "Reports" },
] as const;

export default function Sidebar() {
  const [activeId, setActiveId] = useState<string>(NAV_ITEMS[0].id);
  const [collapsed, setCollapsed] = useState(false);

  return (
    <aside className="flex h-screen w-64 shrink-0 flex-col border-r border-[rgba(117,76,190,0.35)] bg-[#181430]">
      <div className="flex w-full shrink-0 items-start justify-between gap-2 border-b border-[rgba(221,215,234,0.15)] px-3 py-4">
        {collapsed ? (
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center self-start rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] text-[10px] font-bold uppercase leading-tight text-[#ddd7ea]"
            aria-label="DIMA-RISK"
          >
            DR
          </div>
        ) : (
          <div className="min-w-0 self-start truncate rounded-[0.6rem] border border-dashed border-[rgba(117,76,190,0.45)] bg-[#000212] px-2 py-1.5 text-left text-xs font-bold uppercase tracking-wide text-[#ddd7ea]">
            DIMA-RISK LOGO
          </div>
        )}
        <button
          type="button"
          onClick={() => setCollapsed((c) => !c)}
          className="ml-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[#000212] text-sm font-medium text-[#ddd7ea] transition-colors hover:border-[#754cbe] hover:bg-[rgba(117,76,190,0.12)]"
          aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
        >
          <span
            className={`inline-block transition-transform ${
              collapsed ? "rotate-180" : ""
            }`}
          >
            ‹
          </span>
        </button>
      </div>

      <nav
        className="flex min-h-0 w-full flex-1 flex-col gap-1 overflow-y-auto px-2 py-4"
        aria-label="Main navigation"
      >
        {NAV_ITEMS.map((item) => {
          const isActive = activeId === item.id;
          return (
            <Link
              key={item.id}
              href="/dashboard"
              onClick={(e) => {
                e.preventDefault();
                setActiveId(item.id);
              }}
              className={`flex w-full items-center rounded-[0.6rem] border px-3 py-2.5 text-left text-sm font-medium transition-colors ${
                isActive
                  ? "border-[#754cbe] bg-[rgba(117,76,190,0.2)] font-bold text-white"
                  : "border-transparent text-[#ddd7ea] hover:border-[rgba(117,76,190,0.35)] hover:bg-[rgba(221,215,234,0.05)]"
              } ${collapsed ? "justify-center px-2" : ""}`}
            >
              <span className={collapsed ? "sr-only" : ""}>{item.label}</span>
              {collapsed && (
                <span
                  className="text-xs font-bold uppercase text-white"
                  aria-hidden
                >
                  {item.label.slice(0, 1)}
                </span>
              )}
            </Link>
          );
        })}
      </nav>

      <div className="mt-auto w-full shrink-0 self-stretch border-t border-[rgba(221,215,234,0.15)] bg-[#181430] p-3">
        <div className="flex w-full items-center gap-2 rounded-[0.6rem] border border-[rgba(221,215,234,0.2)] bg-[rgba(0,2,18,0.35)] px-2 py-2 text-left">
          <span
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-[0.6rem] border border-[rgba(117,76,190,0.4)] bg-[#000212] text-xs font-medium text-[rgba(221,215,234,0.75)]"
            aria-hidden
          >
            ⚙
          </span>
          {!collapsed && (
            <div className="min-w-0 flex-1 text-left">
              <p className="truncate text-xs font-medium uppercase tracking-wide text-[rgba(221,215,234,0.65)]">
                User
              </p>
              <p className="truncate text-sm font-semibold text-[#ddd7ea]">
                USER
              </p>
            </div>
          )}
          {collapsed && <span className="sr-only">User settings</span>}
        </div>
      </div>
    </aside>
  );
}
