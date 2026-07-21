// Supabase REST client for the harness. Uses the service-role key so it can read
// every org's inputs and the app's stored outputs, call the scoring RPCs, and
// (matrix mode only) create/delete throwaway test users. Node 18+ global fetch.
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const HERE = dirname(fileURLToPath(import.meta.url));

// This Windows box intercepts TLS (corporate proxy / AV), so Node's fetch fails
// cert-chain verification (UNABLE_TO_VERIFY_LEAF_SIGNATURE) — the same reason
// curl needed --ssl-no-revoke here. This is a local test tool hitting the user's
// OWN Supabase project, so relax verification unless HARNESS_STRICT_TLS=1.
if (process.env.HARNESS_STRICT_TLS !== "1") {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

// Read SUPABASE creds from the app's .env.local (two levels up: app/.env.local),
// or fall back to real environment variables if present.
function loadEnv() {
  const out = { url: process.env.NEXT_PUBLIC_SUPABASE_URL, key: process.env.SUPABASE_SERVICE_ROLE_KEY };
  try {
    const raw = readFileSync(join(HERE, "..", "..", ".env.local"), "utf8");
    for (const line of raw.split(/\r?\n/)) {
      const m = line.match(/^([A-Z0-9_]+)\s*=\s*(.*)$/);
      if (!m) continue;
      const [, k, v] = m;
      const val = v.trim().replace(/^["']|["']$/g, "");
      if (k === "NEXT_PUBLIC_SUPABASE_URL" && !out.url) out.url = val;
      if (k === "SUPABASE_SERVICE_ROLE_KEY" && !out.key) out.key = val;
    }
  } catch {
    /* no .env.local — rely on process.env */
  }
  if (!out.url || !out.key) {
    throw new Error("Missing NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY (checked app/.env.local and process.env).");
  }
  return out;
}

const { url: URL_BASE, key: KEY } = loadEnv();
const HEADERS = { apikey: KEY, Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" };

// Windows schannel sometimes chokes on cert revocation checks; Node's fetch is
// unaffected, but keep timeouts sane.
async function req(method, path, { body, headers, base = "/rest/v1" } = {}) {
  const res = await fetch(`${URL_BASE}${base}${path}`, {
    method,
    headers: { ...HEADERS, ...headers },
    body: body != null ? JSON.stringify(body) : undefined,
  });
  const text = await res.text();
  let data = null;
  try { data = text ? JSON.parse(text) : null; } catch { data = text; }
  if (!res.ok) {
    throw new Error(`${method} ${path} → ${res.status}: ${typeof data === "string" ? data : JSON.stringify(data)}`);
  }
  return { data, headers: res.headers };
}

export const db = {
  // SELECT rows: table, PostgREST query string (e.g. "select=*&user_id=eq.123").
  async select(table, query = "select=*") {
    const { data } = await req("GET", `/${table}?${query}`);
    return data ?? [];
  },
  // COUNT rows matching a filter query (without the select clause).
  async count(table, filter = "") {
    const { headers } = await req("GET", `/${table}?select=id${filter ? "&" + filter : ""}`, {
      headers: { Prefer: "count=exact", Range: "0-0" },
    });
    const cr = headers.get("content-range") || "";
    const total = cr.split("/")[1];
    return total ? Number(total) : 0;
  },
  async insert(table, row) {
    const { data } = await req("POST", `/${table}`, { body: row, headers: { Prefer: "return=representation" } });
    return Array.isArray(data) ? data[0] : data;
  },
  async update(table, filter, patch) {
    const { data } = await req("PATCH", `/${table}?${filter}`, { body: patch, headers: { Prefer: "return=representation" } });
    return data;
  },
  async del(table, filter) {
    await req("DELETE", `/${table}?${filter}`);
  },
  async rpc(fn, args) {
    const { data } = await req("POST", `/${fn}`, { base: "/rest/v1/rpc", body: args });
    return data;
  },
  // Admin auth (matrix mode): create/delete throwaway confirmed users.
  async createUser(email, password) {
    const { data } = await req("POST", `/admin/users`, { base: "/auth/v1", body: { email, password, email_confirm: true } });
    return data;
  },
  async deleteUser(id) {
    await req("DELETE", `/admin/users/${id}`, { base: "/auth/v1" });
  },
};

export const SUPABASE_URL = URL_BASE;
