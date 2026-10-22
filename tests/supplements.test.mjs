import test from "node:test";
import assert from "node:assert/strict";
import { fixture, weeklyFixture, taxonomyFixture, updatedWeeklyFixture, splitTaxonomyFixture } from "./workbook-fixture.mjs";
import { parseWorkbook, parseSupplement, readExcel } from "../src/excel-import.mjs";
import { summarizeWeekly, summarizeTaxonomy } from "../src/supplement-domain.mjs";
import { readDataset, saveDataset, clearDataset, validateDataset, STORAGE_KEY, storageKey } from "../src/storage.mjs";

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

test("Semanal atualizado preserva datas e notas sem somar TOTAL GERAL nem rodapés", async () => {
  const data = await readExcel(await updatedWeeklyFixture().xlsx.writeBuffer(), "semanal-novo.xlsx", "weekly");
  assert.equal(data.records.length, 2);
  assert.equal(summarizeWeekly(data).total, 15.75);
  assert.equal(summarizeWeekly(data, { supplier: "Granoski" }).total, 2.25);
  assert.equal(data.records[0].weekStart, "2026-06-01");
  assert.equal(data.records[0].weekEnd, "2026-06-06");
  assert.equal(data.notes.length, 2);
  assert.deepEqual(data.warnings, []);
  assert.deepEqual(validateDataset(JSON.parse(JSON.stringify(data)), "weekly"), data);
});

function reorder(sheet, order) {
  sheet.eachRow((row) => {
    const values = order.map((column) => row.getCell(column).value);
    row.values = values;
  });
}

test("Colunas semanais são associadas pelo cabeçalho mesmo reordenadas e com coluna extra", () => {
  const workbook = updatedWeeklyFixture();
  const sheet = workbook.getWorksheet("Recebimento Semanal");
  reorder(sheet, [8, 6, 2, 4, 1, 7, 3, 5]);
  sheet.getCell("I4").value = "Conferência";
  sheet.getCell("I5").value = "Conferido";
  const data = parseSupplement(workbook, "weekly", "reordenada.xlsx");
  assert.equal(summarizeWeekly(data).total, 15.75);
  assert.equal(data.records[0].weekStart, "2026-06-01");
  assert.equal(data.records[0].weekEnd, "2026-06-06");
  assert.deepEqual(data.records[0].cells.slice(1), [10.5, 2.25, 0, 0, 12.75]);
  sheet.getCell("I4").value = "Pandolfi";
  assert.throws(() => parseSupplement(workbook, "weekly", "duplicada.xlsx"), /duplicado/);
});

test("Datas seriais, datas em texto e métricas inválidas não confundem a leitura semanal", () => {
  const workbook = updatedWeeklyFixture();
  workbook.properties.date1904 = true;
  const sheet = workbook.getWorksheet("Recebimento Semanal");
  sheet.getCell("B5").value = Date.parse("2026-06-01") / 86400000 + 24107;
  sheet.getCell("C5").value = "06/06/2026";
  sheet.getCell("B6").value = "data a conferir";
  const data = parseSupplement(workbook, "weekly", "datas.xlsx");
  assert.equal(data.records[0].weekStart, "2026-06-01");
  assert.equal(data.records[0].weekEnd, "2026-06-06");
  assert.equal(data.records[1].weekStart, "data a conferir");
  assert.equal(data.warnings.length, 1);
  sheet.getCell("D5").value = "inválido";
  assert.throws(() => parseSupplement(workbook, "weekly", "erro.xlsx"), /maior ou igual a zero/);
});

test("Catálogo une resumo de quatro colunas e detalhes sem duplicar espécies", async () => {
  const data = await readExcel(await splitTaxonomyFixture().xlsx.writeBuffer(), "catalogo-novo.xlsx", "taxonomy");
  assert.equal(data.records.length, 3);
  assert.equal(summarizeTaxonomy(data, { search: "Observação de origem" }).rows.length, 1);
  assert.equal(data.records[0].cells[4], "Região Norte");
  assert.equal(data.records[0].detail_sheet, "Especies.Completo");
  assert.equal(data.notes.length, 1);
  assert.deepEqual(data.warnings, []);
  validateDataset(data, "taxonomy");
});

test("Catálogo aceita só resumo ou só completo e mantém espécies presentes em apenas uma aba", () => {
  const reduced = splitTaxonomyFixture();
  reduced.removeWorksheet("Especies.Completo");
  const simple = parseSupplement(reduced, "taxonomy", "resumo.xlsx");
  assert.equal(simple.records.length, 3);
  assert.deepEqual(simple.records[0].cells.slice(4), [null, null, null, null]);
  const detailed = splitTaxonomyFixture();
  detailed.removeWorksheet("Espécies");
  assert.equal(parseSupplement(detailed, "taxonomy", "completo.xlsx").records[0].cells[4], "Região Norte");
  const union = splitTaxonomyFixture();
  union.getWorksheet("Espécies").addRow(["Nome só no resumo", "Madeira D", "Família D", "Gênero D"]);
  union.getWorksheet("Especies.Completo").addRow(["Nome só no completo", "Madeira E", "Família E", "Gênero E", "Região E"]);
  const data = parseSupplement(union, "taxonomy", "uniao.xlsx");
  assert.equal(data.records.length, 5);
  assert.equal(data.records.at(-1).cells[4], "Região E");
});

test("Catálogo associa detalhes pelo nome científico, conserva edições do resumo e sinaliza ambiguidades", () => {
  const workbook = splitTaxonomyFixture();
  const primary = workbook.getWorksheet("Espécies");
  primary.getCell("B2").value = "Nome editado no resumo";
  primary.getCell("A2").value = " Espécie exemplo A ";
  const complete = workbook.getWorksheet("Especies.Completo");
  const first = complete.getRow(2).values;
  complete.getRow(2).values = complete.getRow(4).values;
  complete.getRow(4).values = first;
  reorder(primary, [4, 2, 1, 3]);
  const data = parseSupplement(workbook, "taxonomy", "edicoes.xlsx");
  assert.equal(data.records[0].cells[1], "Nome editado no resumo");
  assert.equal(data.records[0].cells[4], "Região Norte");
  assert.equal(data.warnings.length, 1);
  complete.addRow(first);
  assert.throws(() => parseSupplement(workbook, "taxonomy", "duplicada.xlsx"), /nome científico duplicado/);
});
