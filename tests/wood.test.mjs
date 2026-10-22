import test from "node:test";
import assert from "node:assert/strict";
import { woodFixture, weeklyFixture } from "./workbook-fixture.mjs";
import { readExcel, parseSupplement } from "../src/excel-import.mjs";
import { WOOD_METRICS, woodValue, woodCaveat, filterWood } from "../src/wood-domain.mjs";
import { validateDataset, readDataset, saveDataset, clearDataset } from "../src/storage.mjs";
import { chartDetails } from "../src/chart-details.mjs";

test("Lê as quatro propriedades verdes com precisão e preserva fontes, umidade e valores sem dado", async () => {
  const workbook = woodFixture();
  assert.deepEqual(WOOD_METRICS.map((metric) => metric.column), [2, 5, 6, 9]);
  for (const metric of WOOD_METRICS) assert.equal(workbook.getWorksheet("Propriedades da Madeira").getCell(1, metric.column + 1).fill.fgColor.argb, "FF00B050");
  const data = await readExcel(await workbook.xlsx.writeBuffer(), "propriedades.xlsx", "wood");
  assert.equal(data.records.length, 4);
  assert.equal(woodValue(data.records[0], WOOD_METRICS[1]), 123.45);
  assert.equal(woodValue(data.records[3], WOOD_METRICS[0]), null);
  assert.equal(data.records[3].cells[2], "S/D");
  assert.match(data.records[0].cells[14], /SÓ VERDE/);
  assert.deepEqual(data.notes, [["Fonte A", "Dados sintéticos para testes"]]);
  assert.deepEqual(data.warnings, []);
  validateDataset(data, "wood");
});

test("Filtra por grupo, múltiplas espécies e texto sem usar ressalvas de uma propriedade em outra", () => {
  const { records } = parseSupplement(woodFixture(), "wood", "propriedades.xlsx");
  assert.equal(filterWood(records, { group: "eucalyptus" }).length, 2);
  assert.equal(filterWood(records, { group: "other" }).length, 2);
  assert.equal(filterWood(records, { search: "observacao de origem" }).length, 1);
  assert.equal(filterWood(records, { species: [] }).length, 0);
  assert.equal(filterWood(records, { species: ["Corymbia exemplo", "Espécie exemplo A"], group: "other" }).length, 1);
  assert.ok(woodCaveat(records[0], WOOD_METRICS[2]));
  assert.ok(woodCaveat(records[1], WOOD_METRICS[3]));
  assert.equal(woodCaveat(records[0], WOOD_METRICS[1]), "");
  assert.equal(woodCaveat(records[2], WOOD_METRICS[2]), "");
});

test("Colunas reconhecidas pelo nome aceitam ordem diferente e os cabeçalhos curtos anteriores", () => {
  const workbook = woodFixture();
  const sheet = workbook.getWorksheet("Propriedades da Madeira");
  sheet.getCell("F1").value = "MOR 15% (MPa)";
  sheet.getCell("G1").value = "MOE flexão (MPa)";
  sheet.getCell("J1").value = "Dureza Janka (N)";
  const order = [15, 13, 10, 6, 2, 1, 3, 7, 4, 5, 8, 9, 11, 12, 14];
  sheet.eachRow((row) => { const values = order.map((column) => row.getCell(column).value); row.values = values; });
  const data = parseSupplement(workbook, "wood", "reordenada.xlsx");
  assert.equal(data.records[0].cells[0], "Corymbia exemplo");
  assert.equal(data.records[0].cells[5], 123.45);
  assert.equal(data.records[0].cells[9], 5000);
  assert.match(data.records[0].cells[14], /SÓ VERDE/);
  sheet.getCell("P1").value = "Dureza Janka (N)";
  assert.throws(() => parseSupplement(workbook, "wood", "duplicada.xlsx"), /duplicado/);
});

test("Erros e fórmulas sem cache ficam indisponíveis; zero é um valor informado", () => {
  const workbook = woodFixture();
  const sheet = workbook.getWorksheet("Propriedades da Madeira");
  sheet.getCell("C2").value = 0;
  sheet.getCell("F2").value = { formula: "1+2" };
  sheet.getCell("G2").value = { error: "#VALUE!" };
  const data = parseSupplement(workbook, "wood", "sem-cache.xlsx");
  assert.equal(woodValue(data.records[0], WOOD_METRICS[0]), 0);
  assert.equal(woodValue(data.records[0], WOOD_METRICS[1]), null);
  assert.equal(woodValue(data.records[0], WOOD_METRICS[2]), null);
  assert.equal(data.warnings.length, 2);
  sheet.getCell("J2").value = -1;
  assert.throws(() => parseSupplement(workbook, "wood", "negativa.xlsx"), /maior ou igual a zero/);
  assert.throws(() => parseSupplement(weeklyFixture(), "wood", "arquivo-errado.xlsx"), /aba obrigatória/);
});

test("A quarta base persiste e é substituída ou limpa sem alterar bases anteriores", () => {
  const values = new Map();
  const storage = { getItem: (key) => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: (key) => values.delete(key) };
  const weekly = parseSupplement(weeklyFixture(), "weekly", "semanal.xlsx");
  const wood = parseSupplement(woodFixture(), "wood", "propriedades.xlsx");
  saveDataset(weekly, storage, "weekly");
  saveDataset(wood, storage, "wood");
  assert.deepEqual(readDataset(storage, "wood"), wood);
  saveDataset({ ...wood, fileName: "nova.xlsx", records: wood.records.slice(0, 1) }, storage, "wood");
  assert.equal(readDataset(storage, "wood").records.length, 1);
  clearDataset(storage, "wood");
  assert.equal(readDataset(storage, "wood"), null);
  assert.deepEqual(readDataset(storage, "weekly"), weekly);
});

test("Detalhes comparativos preservam ausência e zero como situações distintas", () => {
  const option = { xAxis: { type: "category", data: ["A", "B", "C"] }, series: [{ name: "MOR", data: [{ value: null }, { value: 0 }, { value: 123.45 }] }] };
  assert.deepEqual(chartDetails(option, { preserveMissing: true }).rows.map((row) => row.values[0]), [null, 0, 123.45]);
  assert.equal(chartDetails(option).rows[0].values[0], 0);
});
