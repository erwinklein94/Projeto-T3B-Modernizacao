import test from "node:test";
import assert from "node:assert/strict";
import { fixture } from "./workbook-fixture.mjs";
import { parseWorkbook, readExcel } from "../src/excel-import.mjs";
import { summarize } from "../src/domain.mjs";
import { STORAGE_KEY, readDataset, saveDataset, clearDataset } from "../src/storage.mjs";

test("Lê XLSX, valores de fórmulas, datas, frações e identificadores sem duplicar estoque", async () => {
  const data = await readExcel(await fixture().xlsx.writeBuffer(), "controle.xlsx");
  const receipt = data.records.find((r) => r.kind === "recebimentos");
  assert.equal(receipt.cells[0], "00123");
  assert.equal(receipt.cells[6], "00042");
  assert.equal(receipt.cells[1], "2026-06-20");
  assert.equal(receipt.cells[9], 10.5);
  assert.equal(summarize(data.records).balance, 8.25);
  assert.equal(data.warnings.length, 0);
});
test("Ignora linhas de modelo com fórmulas, mas preserva linhas operacionais com zero", () => {
  const wb = fixture();
  wb.getWorksheet("Recebimentos").addRow([null, null, null, null, null, null, null, null, null, { formula: "0", result: 0 }]);
  wb.getWorksheet("Recebimentos").getCell("M7").value = "Localização pré-preenchida";
  wb.getWorksheet("Movimentacoes").addRow([{ formula: "A99", result: { error: "#REF!" } }]);
  wb.getWorksheet("Danificados").addRow(["D1", "2026-06-20", "Pátio A", null, null, null, null, null, null, 0]);
  const data = parseWorkbook(wb, "controle.xlsx");
  assert.equal(data.records.filter((r) => r.kind === "recebimentos").length, 1);
  assert.equal(data.records.filter((r) => r.kind === "movimentacoes").length, 1);
  assert.equal(data.records.find((r) => r.kind === "danificados").cells[9], 0);
  assert.deepEqual(data.warnings, []);
});
test("Rejeita arquivos corrompidos, abas ausentes e cabeçalhos fora do padrão", async () => {
  await assert.rejects(readExcel(Buffer.from("arquivo inválido"), "controle.xlsx"), /xlsx válida/);
  const wb = fixture();
  wb.removeWorksheet("Movimentacoes");
  assert.throws(() => parseWorkbook(wb, "controle.xlsx"), /aba obrigatória "Movimentacoes"/);
  const wrong = fixture();
  wrong.getWorksheet("Recebimentos").getCell("J4").value = "Outra coluna";
  assert.throws(() => parseWorkbook(wrong, "controle.xlsx"), /fora do padrão/);
});
test("Lê novas datas de apuração e exclui totais para evitar duplicação", () => {
  const wb = fixture();
  const sheet = wb.addWorksheet("Danif.");
  sheet.getRow(2).values = ["DANIFICADOS", new Date("2026-09-15T00:00:00Z"), new Date("2026-10-09T00:00:00Z")];
  sheet.addRow(["Fornecedor A", 4, 8]);
  sheet.addRow(["TOTAL", { formula: "SUM(B3)", result: 4 }, 8]);
  const data = parseWorkbook(wb, "controle.xlsx");
  assert.deepEqual(data.definitions.find((d) => d.id === "apuracoes").headers, ["DANIFICADOS", "15/09/2026", "09/10/2026"]);
  assert.equal(data.records.filter((r) => r.kind === "apuracoes").length, 1);
});
test("Preserva datas em texto e converte datas seriais dos sistemas 1900 e 1904", () => {
  for (const date1904 of [false, true]) {
    const wb = fixture(); wb.properties.date1904 = date1904;
    const sheet = wb.getWorksheet("Recebimentos");
    const serial = Math.round(Date.parse("2026-06-20T00:00:00Z") / 86400000) + (date1904 ? 24107 : 25569);
    sheet.getCell("B5").value = serial;
    assert.equal(parseWorkbook(wb, "controle.xlsx").records.find((r) => r.kind === "recebimentos").cells[1], "2026-06-20");
    sheet.getCell("B5").value = "04 e 05 de setembro";
    assert.equal(parseWorkbook(wb, "controle.xlsx").records.find((r) => r.kind === "recebimentos").cells[1], "04 e 05 de setembro");
    sheet.getCell("B5").value = "20/06/2026";
    assert.equal(parseWorkbook(wb, "controle.xlsx").records.find((r) => r.kind === "recebimentos").cells[1], "2026-06-20");
  }
});
test("Expõe avisos de erros e fórmulas sem valores, sem inventar resultados", () => {
  const wb = fixture();
  const sheet = wb.getWorksheet("Recebimentos");
  sheet.getCell("J5").value = { formula: "1/0", result: { error: "#DIV/0!" } };
  sheet.getCell("L5").value = { formula: "J5*0.1142" };
  const data = parseWorkbook(wb, "controle.xlsx");
  assert.equal(data.warnings.length, 2);
  assert.equal(summarize(data.records).received, 0);
  assert.equal(data.records.find((r) => r.kind === "recebimentos").cells[9], "#DIV/0!");
});
function memoryStorage() {
  const map = new Map();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => map.set(k, v), removeItem: (k) => map.delete(k) };
}
test("LocalStorage começa vazio, substitui toda a base, restaura e limpa somente a chave do leitor", () => {
  const storage = memoryStorage();
  storage.setItem("outro-app", "preservar");
  assert.equal(readDataset(storage), null);
  saveDataset(parseWorkbook(fixture(), "primeira.xlsx"), storage);
  saveDataset(parseWorkbook(fixture(20), "segunda.xlsx"), storage);
  const restored = readDataset(storage);
  assert.equal(restored.fileName, "segunda.xlsx");
  assert.equal(restored.records.length, 3);
  assert.equal(summarize(restored.records).received, 20);
  clearDataset(storage);
  assert.equal(readDataset(storage), null);
  assert.equal(storage.getItem("outro-app"), "preservar");
});
test("Falha de armazenamento preserva a importação anterior e dados inválidos não são restaurados", () => {
  const storage = memoryStorage();
  const first = parseWorkbook(fixture(), "primeira.xlsx"); saveDataset(first, storage);
  const quota = { ...storage, setItem() { throw Error("quota"); } };
  assert.throws(() => saveDataset(parseWorkbook(fixture(20), "segunda.xlsx"), quota), /anteriores foram mantidos/);
  assert.deepEqual(readDataset(storage), first);
  storage.setItem(STORAGE_KEY, "não é JSON");
  assert.throws(() => readDataset(storage), /recuperar os dados locais/);
  assert.throws(() => saveDataset({ version: 1 }, storage), /inválidos/);
});
