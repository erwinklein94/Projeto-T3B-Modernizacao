import test from "node:test";
import assert from "node:assert/strict";
import { fixture, weeklyFixture, taxonomyFixture } from "./workbook-fixture.mjs";
import { parseWorkbook, parseSupplement, readExcel } from "../src/excel-import.mjs";
import { summarizeWeekly, summarizeTaxonomy } from "../src/supplement-domain.mjs";
import { readDataset, saveDataset, clearDataset, STORAGE_KEY, storageKey } from "../src/storage.mjs";

test("Controle semanal importa frações e fórmulas sem duplicar a linha TOTAL", async () => {
  const data = await readExcel(await weeklyFixture().xlsx.writeBuffer(), "semanal.xlsx", "weekly");
  const summary = summarizeWeekly(data);
  assert.equal(data.records.length, 2);
  assert.equal(summary.total, 15.75);
  assert.equal(summary.activeWeeks, 2);
  assert.deepEqual(data.warnings, []);
  assert.equal(summarizeWeekly(data, { supplier: "Pandolfi" }).total, 10.5);
  assert.equal(summarizeWeekly(data, { week: "08/06 a 13/06/2026" }).total, 3);
  assert.equal(summarizeWeekly(data, { supplier: "Madebel" }).total, 0);
});
test("Controle semanal sinaliza total divergente e rejeita valores não numéricos", () => {
  const wb = weeklyFixture();
  wb.getWorksheet("Recebimento Semanal").getCell("F4").value = 99;
  const data = parseSupplement(wb, "weekly", "semanal.xlsx");
  assert.equal(data.warnings.length, 1);
  assert.equal(summarizeWeekly(data).total, 15.75);
  wb.getWorksheet("Recebimento Semanal").getCell("B4").value = "não é quantidade";
  assert.throws(() => parseSupplement(wb, "weekly", "semanal.xlsx"), /maior ou igual a zero/);
});
test("Catálogo preserva textos e notas e filtra família, gênero e busca sem acentos", async () => {
  const data = await readExcel(await taxonomyFixture().xlsx.writeBuffer(), "catalogo.xlsx", "taxonomy");
  const summary = summarizeTaxonomy(data);
  assert.equal(summary.rows.length, 3);
  assert.equal(summary.familyCount, 2);
  assert.equal(summary.genusCount, 2);
  assert.equal(summary.annotated, 2);
  assert.equal(summarizeTaxonomy(data, { family: "Família A" }).rows.length, 2);
  assert.equal(summarizeTaxonomy(data, { genus: "Gênero B" }).rows.length, 1);
  assert.equal(summarizeTaxonomy(data, { search: "regiao norte" }).rows.length, 1);
  assert.equal(summarizeTaxonomy(data, { family: "Família B", search: "Norte" }).rows.length, 0);
  assert.deepEqual(data.notes, [["Fonte", "Catálogo de exemplo para testes"]]);
});
test("Planilhas no campo errado ou com colunas alteradas são rejeitadas", () => {
  assert.throws(() => parseSupplement(weeklyFixture(), "taxonomy", "semanal.xlsx"), /aba obrigatória/);
  assert.throws(() => parseSupplement(taxonomyFixture(), "weekly", "catalogo.xlsx"), /aba obrigatória/);
  const wrong = taxonomyFixture(); wrong.getWorksheet("Espécies").getCell("C1").value = "Coluna alterada";
  assert.throws(() => parseSupplement(wrong, "taxonomy", "catalogo.xlsx"), /fora do padrão/);
});
test("Três bases independentes preservam dados antigos, substituem e limpam só o campo escolhido", () => {
  const values = new Map();
  const storage = { getItem: (k) => values.get(k) ?? null, setItem: (k, v) => values.set(k, v), removeItem: (k) => values.delete(k) };
  const operations = parseWorkbook(fixture(), "controle.xlsx");
  const catalogue = parseSupplement(taxonomyFixture(), "taxonomy", "catalogo.xlsx");
  saveDataset(operations, storage);
  assert.equal(storageKey(), STORAGE_KEY);
  assert.deepEqual(readDataset(storage), operations);
  assert.equal(readDataset(storage, "weekly"), null);
  saveDataset(catalogue, storage, "taxonomy");
  saveDataset(parseSupplement(weeklyFixture(), "weekly", "semanal.xlsx"), storage, "weekly");
  saveDataset(parseSupplement(weeklyFixture(20), "weekly", "atualizada.xlsx"), storage, "weekly");
  assert.equal(summarizeWeekly(readDataset(storage, "weekly")).total, 25.25);
  assert.deepEqual(readDataset(storage), operations);
  assert.deepEqual(readDataset(storage, "taxonomy"), catalogue);
  assert.throws(() => saveDataset(catalogue, storage, "weekly"), /inválidos/);
  clearDataset(storage, "weekly");
  assert.equal(readDataset(storage, "weekly"), null);
  assert.deepEqual(readDataset(storage), operations);
  assert.deepEqual(readDataset(storage, "taxonomy"), catalogue);
});
