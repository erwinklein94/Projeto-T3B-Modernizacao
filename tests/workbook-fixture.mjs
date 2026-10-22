import ExcelJS from "exceljs";
import definitions from "../src/definitions.json" with { type: "json" };
import { sourceById } from "../src/sources.mjs";

export function fixture(quantity = 10.5) {
  const workbook = new ExcelJS.Workbook();
  for (const def of definitions) {
    if (["apuracoes", "semanal", "madeiras"].includes(def.id)) continue;
    const sheet = workbook.addWorksheet(def.sheet);
    sheet.getCell("A1").value = "Título da planilha";
    sheet.getRow(4).values = def.headers.map((h) => /^Coluna \d+$/.test(h) ? null : h);
  }
  workbook.getWorksheet("Parametros").addRow(["Volume unitário", 0.1142]);
  const receipt = Array(19).fill(null);
  Object.assign(receipt, { 0: "00123", 1: new Date("2026-06-20T00:00:00Z"), 2: "Pátio A", 3: "L1", 4: "Fornecedor A", 6: "00042", 8: "Espécie A", 9: { formula: "10+0.5", result: quantity }, 10: quantity * 0.114, 11: quantity * 0.1142 });
  workbook.getWorksheet("Recebimentos").addRow(receipt);
  const move = Array(19).fill(null);
  Object.assign(move, { 0: new Date("2026-06-20T00:00:00Z"), 1: "Recebimento", 2: "Pátio A", 3: "L1", 5: "Espécie A", 6: quantity, 7: 2.25, 8: quantity * 0.1142, 9: 0.25 });
  workbook.getWorksheet("Movimentacoes").addRow(move);
  return workbook;
}

export async function filePayload(workbook = fixture(), name = "controle.xlsx") {
  return { name, mimeType: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", buffer: Buffer.from(await workbook.xlsx.writeBuffer()) };
}

export function weeklyFixture(quantity = 10.5) {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sourceById.weekly.sheet);
  sheet.getCell("A1").value = "RECEBIMENTO SEMANAL DE DORMENTES POR FORNECEDOR";
  sheet.getRow(3).values = sourceById.weekly.headers;
  sheet.addRow(["01/06 a 06/06/2026", quantity, 2.25, 0, 0, { formula: "SUM(B4:E4)", result: quantity + 2.25 }]);
  sheet.addRow(["08/06 a 13/06/2026", 0, 0, 3, 0, 3]);
  sheet.addRow(["TOTAL ", quantity, 2.25, 3, 0, quantity + 5.25]);
  return workbook;
}

export function taxonomyFixture() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sourceById.taxonomy.sheet);
  sheet.addRow(sourceById.taxonomy.headers);
  sheet.addRow(["Espécie exemplo A", "Madeira A", "Família A", "Gênero A", "Região Norte", "Nome A", "Apelido A", "Observação de origem"]);
  sheet.addRow(["Espécie exemplo B", "Madeira B", "Família A", "Gênero A", "Região Sul", "Nome B", null, null]);
  sheet.addRow(["Espécie exemplo C", "Madeira C", "Família B", "Gênero B", "Região Sul", "Nome C", null, "Outra observação"]);
  const notes = workbook.addWorksheet("Fontes e notas");
  notes.addRow(["Item", "Descrição"]);
  notes.addRow(["Fonte", "Catálogo de exemplo para testes"]);
  return workbook;
}

export function updatedWeeklyFixture() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sourceById.weekly.sheet);
  sheet.getCell("A1").value = "Recebimentos de exemplo";
  sheet.getRow(4).values = ["Semana", "Início", "Fim", ...sourceById.weekly.headers.slice(1)];
  sheet.addRow(["01/06 a 06/06/2026", new Date("2026-06-01T00:00:00Z"), new Date("2026-06-06T00:00:00Z"), 10.5, 2.25, 0, 0, 12.75]);
  sheet.addRow(["08/06 a 13/06/2026", new Date("2026-06-08T00:00:00Z"), new Date("2026-06-13T00:00:00Z"), 0, 0, 3, 0, 3]);
  sheet.addRow(["TOTAL GERAL", null, null, 10.5, 2.25, 3, 0, 15.75]);
  sheet.addRow([]);
  sheet.addRow(["Fonte: dados fictícios para teste."]);
  sheet.addRow(["Quantidades arredondadas para apresentação."]);
  return workbook;
}

export function splitTaxonomyFixture() {
  const workbook = taxonomyFixture();
  const complete = workbook.getWorksheet("Espécies");
  complete.name = "Especies.Completo";
  const primary = workbook.addWorksheet("Espécies");
  primary.addRow(sourceById.taxonomy.headers.slice(0, 4));
  for (let n = 2; n <= complete.rowCount; n++) primary.addRow(complete.getRow(n).values.slice(1, 5));
  return workbook;
}

export function woodFixture() {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet(sourceById.wood.sheet);
  sheet.addRow(sourceById.wood.headers);
  for (const column of [3, 6, 7, 10]) sheet.getCell(1, column).fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF00B050" } };
  sheet.addRow(["Corymbia exemplo", "Eucalipto A", 800, 900, 90, 123.45, 10000, 40, 55, 5000, 9000, 4500, "Fonte A", "Observação A", "MOE e Janka: SÓ VERDE na ficha (sem dado seco)."]);
  sheet.addRow(["Eucalyptus exemplo", "Eucalipto B", 400, 500, 50, 70.25, 8000, 20, 35, 2500, null, null, "Fonte B", null, "MOE e Janka: provavelmente verde, a reconfirmar."]);
  sheet.addRow(["Espécie exemplo A", "Madeira A", 650, 750, 70, 99.75, 12000, 35, 50, 6000, null, null, "Fonte A", "Observação de origem", "Seca = 12%. MOE e Janka em madeira seca."]);
  sheet.addRow(["Espécie exemplo B", "Madeira B", "S/D", null, null, "S/D", null, null, null, "S/D", null, null, null, "Sem resultados nas fontes", "Sem dado."]);
  const notes = workbook.addWorksheet("Fontes e notas");
  notes.addRow(["Fonte", "Uso"]);
  notes.addRow(["Fonte A", "Dados sintéticos para testes"]);
  return workbook;
}
