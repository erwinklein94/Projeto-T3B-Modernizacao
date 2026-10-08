import fs from "node:fs";
import crypto from "node:crypto";
import { createClient } from "@supabase/supabase-js";
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!key)
  throw Error("Configure SUPABASE_SERVICE_ROLE_KEY somente no ambiente local.");
const sb = createClient("https://ixzvvyslbsuwnyhrxqwf.supabase.co", key, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const check = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const rows = JSON.parse(fs.readFileSync(".private/history.json", "utf8"));
for (let i = 0; i < rows.length; i += 200)
  check(
    await sb
      .from("t3b_records")
      .upsert(rows.slice(i, i + 200), {
        onConflict: "source_key",
        ignoreDuplicates: true,
      }),
  );
const archive = JSON.parse(
  fs.readFileSync(".private/source_archive.json", "utf8"),
);
for (const s of archive)
  check(
    await sb.from("t3b_source_archive").upsert(
      {
        source_key: crypto
          .createHash("sha256")
          .update(s.file + ":" + s.sheet)
          .digest("hex"),
        file_name: s.file,
        sheet_name: s.sheet,
        cells: s.cells,
      },
      { onConflict: "source_key", ignoreDuplicates: true },
    ),
  );
let existing = [];
for (let page = 1; ; page++) {
  const data = check(await sb.auth.admin.listUsers({ page, perPage: 100 }));
  existing.push(...data.users);
  if (data.users.length < 100) break;
}
const password = process.env.T3B_INITIAL_PASSWORD;
if (!password)
  throw Error(
    "Configure T3B_INITIAL_PASSWORD com a senha solicitada para as três contas.",
  );
for (const {email,role} of JSON.parse(fs.readFileSync('.private/accounts.json','utf8'))) {
  let user = existing.find((u) => u.email === email);
  if (!user)
    user = check(
      await sb.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
        app_metadata: { t3b_role: role },
      }),
    ).user;
  else console.log("Conta existente preservada:", email);
  check(await sb.from("t3b_profiles").upsert({ id: user.id, email, role }));
  console.log("Perfil configurado:", email, role);
}
const totals = {};
for (const k of new Set(rows.map((r) => r.kind))) {
  const { count, error } = await sb
    .from("t3b_records")
    .select("id", { count: "exact", head: true })
    .eq("kind", k);
  if (error) throw error;
  totals[k] = count;
  if (count !== rows.filter((r) => r.kind === k).length)
    throw Error("Contagem divergente: " + k);
}
console.log("Importação conferida:", totals);
