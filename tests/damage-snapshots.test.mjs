import test from "node:test";
import assert from "node:assert/strict";
import { damageSnapshots } from "../src/damage-snapshots.mjs";
import { emptyFilters } from "../src/domain.mjs";
import { fixture } from "./workbook-fixture.mjs";
import { readExcel } from "../src/excel-import.mjs";

const definition = { headers: ["DANIFICADOS", "01/06/2026", "08/06/2026", "15/06/2026"] };
const records = [
  { id: "a", kind: "apuracoes", cells: ["Fornecedor A", 3, 0, null] },
  { id: "b", kind: "apuracoes", cells: ["Fornecedor B", 4, null, null] },
];
test("Apurações somam fornecedores em cada data, preservando zeros e lacunas", () => {
  const matrix = damageSnapshots(records, definition);
  assert.deepEqual(matrix.totals, [{ value: 7, partial: false }, { value: 0, partial: true }, { value: null, partial: false }]);
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.columns.length, 3);
  assert.equal(matrix.available, true);
});
test("Fornecedor e período selecionam linhas e colunas, sem aplicar espécie ou pátio ao resumo", () => {
  const matrix = damageSnapshots(records, definition, { ...emptyFilters, supplier: "fornecedor a", start: "2026-06-08", end: "2026-06-15", species: "Não consta", yard: "Não consta" });
  assert.equal(matrix.rows.length, 1);
  assert.deepEqual(matrix.columns.map((c) => c.label), ["08/06/2026", "15/06/2026"]);
  assert.equal(matrix.totals[0].value, 0);
  assert.equal(matrix.totals[0].partial, false);
  assert.equal(damageSnapshots(records, definition, { ...emptyFilters, start: "2027-01-01" }).columns.length, 0);
  assert.equal(damageSnapshots(records, definition, { ...emptyFilters, supplier: "Inexistente" }).rows.length, 0);
  assert.equal(damageSnapshots([], definition).available, false);
});
test("Importação aceita datas novas e exclui o total do Excel antes de calcular a matriz", async () => {
  const workbook = fixture();
  const sheet = workbook.addWorksheet("Danif.");
  sheet.addRow(["DANIFICADOS", new Date("2026-06-01T00:00:00Z"), new Date("2026-06-08T00:00:00Z"), new Date("2026-06-15T00:00:00Z")]);
  sheet.addRow(["Fornecedor A", 3, 0]);
  sheet.addRow(["Fornecedor B", 4]);
  sheet.addRow(["TOTAL GERAL", 7, 0]);
  const data = await readExcel(await workbook.xlsx.writeBuffer(), "controle.xlsx");
  const matrix = damageSnapshots(data.records, data.definitions.find((d) => d.id === "apuracoes"));
  assert.equal(matrix.rows.length, 2);
  assert.equal(matrix.totals[0].value, 7);
  assert.equal(matrix.totals[2].value, null);
});
