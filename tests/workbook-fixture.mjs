import ExcelJS from "exceljs";
import definitions from "../src/definitions.json" with { type: "json" };

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
