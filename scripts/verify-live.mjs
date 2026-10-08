import fs from "node:fs";
import assert from "node:assert/strict";
import { createClient } from "@supabase/supabase-js";
import { summarize } from "../src/domain.mjs";
const url = "https://ixzvvyslbsuwnyhrxqwf.supabase.co";
const key = fs.readFileSync(".private/admin-key.txt", "utf8").trim();
const pub = "sb_publishable_3Bi4Na9YOZSfotY7tGJxfw_1XFfvsNU";
const client = (k) =>
  createClient(url, k, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
const admin = client(key),
  anon = client(pub),
  editor = client(pub),
  analyst = client(pub),
  coordinator = client(pub),
  consult = client(pub);
const ok = ({ data, error }) => {
  if (error) throw error;
  return data;
};
const password = process.env.T3B_INITIAL_PASSWORD;
const accounts = JSON.parse(fs.readFileSync('.private/accounts.json','utf8'));
const emailFor = role => accounts.find(a=>a.role===role).email;
if (!password) throw Error("Missing password");
let testUser, receiptId, childId;
const clients = [editor, analyst, coordinator, consult];
try {
  for (const [c, email] of [
    [editor, emailFor('editor')],
    [analyst, emailFor('analista')],
    [coordinator, emailFor('coordenador')],
  ])
    ok(await c.auth.signInWithPassword({ email, password }));
  console.log("PASS: login das três contas");
  testUser = ok(
    await admin.auth.admin.createUser({
      email: `qa-${Date.now()}@t3b.example`,
      password,
      email_confirm: true,
      app_metadata: { t3b_role: "consulta" },
    }),
  ).user;
  ok(
    await admin
      .from("t3b_profiles")
      .upsert({ id: testUser.id, email: testUser.email, role: "consulta" }),
  );
  ok(
    await consult.auth.signInWithPassword({ email: testUser.email, password }),
  );
  assert.ok((await anon.from("t3b_records").select("*")).error);
  assert.ok((await anon.rpc("t3b_dashboard")).error);
  assert.equal(ok(await consult.from("t3b_records").select("*")).length, 0);
  assert.equal(ok(await analyst.from("t3b_audit").select("*")).length, 0);
  assert.ok(
    (
      await consult
        .from("t3b_records")
        .insert({ kind: "recebimentos", cells: [] })
    ).error,
  );
  assert.ok(
    (
      await analyst
        .from("t3b_profiles")
        .update({ role: "editor" })
        .eq("id", testUser.id)
    ).error,
  );
  console.log(
    "PASS: RLS bloqueia anônimo, registros da Consulta, auditoria do Analista e promoção de perfil",
  );
  const safe = ok(await consult.rpc("t3b_dashboard"));
  const original=JSON.parse(fs.readFileSync('.private/history.json','utf8'));
  assert.equal(safe.filter((r) => r.kind === "recebimentos").length, original.filter(r=>r.kind==='recebimentos').length);
  assert.ok(
    safe
      .filter((r) => r.kind === "recebimentos")
      .every((r) => [0, 5, 6, 7, 13, 15, 16].every((i) => r.cells[i] === null)),
  );
  assert.ok(Math.abs(summarize(safe).balance - summarize(original).balance) < 1e-6);
  console.log(
    "PASS: dashboard Consulta completo, totais conciliados, dados fiscais removidos",
  );
  const c = Array(19).fill(null);
  Object.assign(c, {
    0: "QA TEMP",
    1: "2026-10-07",
    2: "QA",
    3: "QA",
    4: "QA",
    8: "QA",
    9: 10,
    10: 1.142,
    11: 1.142,
  });
  const created = ok(
    await analyst
      .from("t3b_records")
      .insert({ kind: "recebimentos", cells: c })
      .select()
      .single(),
  );
  receiptId = created.id;
  const movement = ok(
    await admin
      .from("t3b_records")
      .select("*")
      .eq("parent_id", receiptId)
      .single(),
  );
  childId = movement.id;
  assert.equal(movement.cells[6], 10);
  c[9] = 12;
  c[11] = 1.3704;
  ok(
    await coordinator
      .from("t3b_records")
      .update({ cells: c, revision: 2 })
      .eq("id", receiptId)
      .eq("revision", 1)
      .select()
      .single(),
  );
  const updated = ok(
    await admin
      .from("t3b_records")
      .select("*")
      .eq("parent_id", receiptId)
      .single(),
  );
  assert.equal(updated.cells[6], 12);
  assert.equal(
    ok(
      await analyst
        .from("t3b_records")
        .update({ cells: c, revision: 2 })
        .eq("id", receiptId)
        .eq("revision", 1)
        .select(),
    ).length,
    0,
  );
  ok(
    await analyst
      .from("t3b_records")
      .update({ deleted_at: new Date().toISOString(), revision: 3 })
      .eq("id", receiptId)
      .select()
      .single(),
  );
  assert.ok(
    ok(
      await admin
        .from("t3b_records")
        .select("*")
        .eq("parent_id", receiptId)
        .single(),
    ).deleted_at,
  );
  console.log(
    "PASS: cadastro, entrada automática, edição pelo Coordenador, concorrência e exclusão lógica",
  );
  const audits = ok(await editor.from("t3b_audit").select("*"));
  assert.ok(audits.some((a) => a.action === "login" && a.role === "analista"));
  assert.ok(
    audits.some(
      (a) => a.details?.record_id === receiptId && a.action === "create_record",
    ),
  );
  assert.ok(audits.every((a) => a.role !== "editor"));
  console.log(
    "PASS: logins e alterações auditados; Editor excluído dos eventos",
  );
  if (process.env.TEST_EDGE === "1") {
    const rejected = await analyst.functions.invoke("t3b-create-user", {
      body: { email: "blocked@t3b.example", password, role: "editor" },
    });
    assert.ok(rejected.error);
    console.log("PASS: função de contas bloqueia Analista");
  }
  fs.writeFileSync(
    ".private/live-verification.json",
    JSON.stringify(
      { verifiedAt: new Date().toISOString(), checks: 12, status: "passed" },
      null,
      2,
    ),
  );
} finally {
  for (const c of clients) await c.auth.signOut();
  if (childId) ok(await admin.from("t3b_records").delete().eq("id", childId));
  if (receiptId)
    ok(await admin.from("t3b_records").delete().eq("id", receiptId));
  if (testUser) {
    await admin.from("t3b_audit").delete().eq("actor_id", testUser.id);
    ok(await admin.auth.admin.deleteUser(testUser.id));
  }
  for (const id of [receiptId, childId].filter(Boolean))
    await admin
      .from("t3b_audit")
      .delete()
      .contains("details", { record_id: id });
}
