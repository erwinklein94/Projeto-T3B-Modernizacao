import { createClient } from "@supabase/supabase-js";
export const configured = Boolean(
  import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
);
export const sb = configured
  ? createClient(
      "https://ixzvvyslbsuwnyhrxqwf.supabase.co",
      import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY,
    )
  : null;
const unwrap = ({ data, error }) => {
  if (error) throw Error(error.message);
  return data;
};
export async function loadRecords() {
  let result = [];
  for (let from = 0; ; from += 500) {
    const rows = unwrap(
      await sb
        .from("t3b_records")
        .select("*")
        .is("deleted_at", null)
        .order("id")
        .range(from, from + 499),
    );
    result.push(...rows);
    if (rows.length < 500) return result;
  }
}
export async function loadDashboard() {
  return unwrap(await sb.rpc("t3b_dashboard")) || [];
}
export async function audit(action, details = {}) {
  unwrap(await sb.rpc("t3b_log_event", { event: action, details }));
}
export async function saveRecord(row) {
  const payload = { kind: row.kind, cells: row.cells };
  if (row.id)
    return unwrap(
      await sb
        .from("t3b_records")
        .update({ ...payload, revision: row.revision + 1 })
        .eq("id", row.id)
        .eq("revision", row.revision)
        .select()
        .single(),
    );
  return unwrap(await sb.from("t3b_records").insert(payload).select().single());
}
export async function deleteRecord(row) {
  return unwrap(
    await sb
      .from("t3b_records")
      .update({
        deleted_at: new Date().toISOString(),
        revision: row.revision + 1,
      })
      .eq("id", row.id)
      .eq("revision", row.revision)
      .select()
      .single(),
  );
}
export async function loadAudit() {
  let all = [];
  for (let from = 0; from < 10000; from += 500) {
    const rows = unwrap(
      await sb
        .from("t3b_audit")
        .select("*")
        .order("occurred_at", { ascending: false })
        .range(from, from + 499),
    );
    all.push(...rows);
    if (rows.length < 500) break;
  }
  return all;
}
