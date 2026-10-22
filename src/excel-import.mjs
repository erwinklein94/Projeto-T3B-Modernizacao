import definitions from "./definitions.json" with { type: "json" };
import { norm, validDate } from "./domain.mjs";
import { sourceById } from "./sources.mjs";

const optional = new Set(["madeiras", "semanal", "apuracoes"]);
const numeric = {
  recebimentos: [9, 10, 11, 17], movimentacoes: [6, 7, 8, 9],
  danificados: [9, 10, 15, 16], devolucoes: [10, 11, 15, 16],
  conciliacao: [3, 4, 5, 6, 7, 8, 9, 13, 14, 15], consumo: [5, 6, 8, 9],
  transferencias: [6, 7, 9, 10, 11, 12, 17], parametros: [1],
  madeiras: [2, 3, 4, 5, 6, 7, 8, 9], semanal: [1, 2, 3, 4, 5],
};
const normalized = (v) => norm(v).replace(/\s+/g, " ");
const isFormula = (v) => v && typeof v === "object" && ("formula" in v || "sharedFormula" in v);
const present = (v) => v !== null && v !== undefined && v !== "";

function valueOf(value) {
  if (isFormula(value)) return valueOf(value.result);
  if (value instanceof Date) {
    if (!Number.isFinite(value.getTime())) return null;
    return value.getUTCFullYear() < 1900
      ? value.toISOString().slice(11, 19) : value.toISOString().slice(0, 10);
  }
  if (value && typeof value === "object") {
    if (value.error) return value.error;
    if (value.richText) return value.richText.map((run) => run.text).join("");
    if (value.text !== undefined) return String(value.text);
    throw Error("A planilha contém um tipo de célula não suportado.");
  }
  return value ?? null;
}

function numberOf(value) {
  if (typeof value !== "string" || !value.trim()) return value;
  const text = value.trim();
  // Excel stores real numeric cells as numbers. Only convert text in metric columns.
  const candidate = text.includes(",") ? text.replace(/\./g, "").replace(",", ".") : text;
  return /^[+-]?\d+(\.\d+)?$/.test(candidate) && Number.isFinite(Number(candidate))
    ? Number(candidate) : value;
}

function dateOf(value, date1904) {
  if (typeof value === "number" && Number.isFinite(value)) {
    if (value >= 0 && value < 1) {
      return new Date(Math.round(value * 86400000)).toISOString().slice(11, 19);
    }
    const date = new Date((Math.floor(value) - (date1904 ? 24107 : 25569)) * 86400000);
    return Number.isFinite(date.getTime()) ? date.toISOString().slice(0, 10) : String(value);
  }
  if (typeof value === "string") {
    const match = value.trim().match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
    if (match) {
      const iso = `${match[3]}-${match[2]}-${match[1]}`;
      if (validDate(iso) && new Date(iso).toISOString().slice(0, 10) === iso) return iso;
    }
  }
  return value;
}

function headerRow(sheet, def) {
  for (let row = 1; row <= Math.min(10, sheet.rowCount); row++) {
    if (normalized(valueOf(sheet.getCell(row, 1).value)) !== normalized(def.headers[0])) continue;
    if (def.id === "apuracoes" || def.headers.every((header, i) =>
      header === `Coluna ${i + 1}` || normalized(valueOf(sheet.getCell(row, i + 1).value)) === normalized(header))) return row;
  }
  throw Error(`A aba "${def.sheet}" está fora do padrão. Confira os nomes e a ordem das colunas.`);
}

export function parseWorkbook(workbook, fileName, importedAt = new Date().toISOString()) {
  const records = [], importedDefinitions = [], warnings = [], sheets = [];
  for (const original of definitions) {
    const sheet = workbook.worksheets.find((s) => normalized(s.name) === normalized(original.sheet));
    const def = { ...original, headers: [...original.headers], dates: [...original.dates] };
    importedDefinitions.push(def);
    if (!sheet) {
      if (optional.has(def.id)) continue;
      throw Error(`A aba obrigatória "${def.sheet}" não foi encontrada. Importe a planilha completa no padrão original.`);
    }
    const header = headerRow(sheet, def);
    if (def.id === "apuracoes") {
      let last = sheet.getRow(header).cellCount;
      while (last > 1 && !present(valueOf(sheet.getCell(header, last).value))) last--;
      if (last < 2) throw Error(`A aba "${def.sheet}" deve conter pelo menos uma coluna de apuração.`);
      def.headers = Array.from({ length: last }, (_, i) => {
        const label = valueOf(sheet.getCell(header, i + 1).value);
        return validDate(label) ? label.split("-").reverse().join("/") : String(label ?? `Coluna ${i + 1}`);
      });
      def.numbers = Array.from({ length: last - 1 }, (_, i) => i + 1);
    }
    const cols = def.headers.length;
    const numericColumns = numeric[def.id] || def.numbers;
    let count = 0, ignored = 0, errorCells = 0, missingMetrics = 0;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber <= header) return;
      const raw = Array.from({ length: cols }, (_, i) => row.getCell(i + 1).value);
      // Formula-only rows belong to the blank Excel template, even if their caches contain errors or zeros.
      if (!raw.some((v) => !isFormula(v) && present(valueOf(v)))) { ignored++; return; }
      const cells = raw.map(valueOf);
      if (def.id === "recebimentos" && ![0, 1, 3, 4, 6, 7, 8, 9, 10].some((i) => present(cells[i]))) { ignored++; return; }
      if (["semanal", "apuracoes"].includes(def.id) && normalized(cells[0]) === "total") { ignored++; return; }
      for (let i = 0; i < cols; i++) {
        if (def.dates.includes(i)) cells[i] = dateOf(cells[i], workbook.properties.date1904);
        else if (numericColumns.includes(i)) cells[i] = numberOf(cells[i]);
        if (typeof cells[i] === "string" && /^#(REF!|DIV\/0!|VALUE!|NAME\?|N\/A|NUM!|NULL!|SPILL!|CALC!)/.test(cells[i])) errorCells++;
        if (["recebimentos", "movimentacoes", "danificados"].includes(def.id) && numericColumns.includes(i) && isFormula(raw[i]) && !present(cells[i])) missingMetrics++;
      }
      records.push({ id: `${def.id}:${rowNumber}`, kind: def.id, cells, source_sheet: sheet.name, source_row: rowNumber });
      count++;
    });
    sheets.push({ name: sheet.name, count, ignored });
    if (errorCells) warnings.push(`${sheet.name}: ${errorCells} células com erro do Excel foram preservadas como texto e não entram nas somas. Corrija o arquivo e importe novamente.`);
    if (missingMetrics) warnings.push(`${sheet.name}: ${missingMetrics} fórmulas de quantidade/volume estão sem valor salvo. Campos vazios não entram nas somas. Recalcule e salve no Excel antes de importar novamente.`);
  }
  return { version: 1, fileName, importedAt, records, definitions: importedDefinitions, warnings, sheets };
}

function supplementColumns(sheet, headers, required = headers) {
  for (let row = 1; row <= Math.min(10, sheet.rowCount); row++) {
    const columns = new Map();
    sheet.getRow(row).eachCell((cell, index) => {
      const key = normalized(valueOf(cell.value));
      if (!key) return;
      columns.set(key, [...(columns.get(key) || []), index]);
    });
    if (!required.every((name) => columns.has(normalized(name)))) continue;
    for (const name of headers) {
      if (columns.get(normalized(name))?.length > 1) throw Error(`A aba "${sheet.name}" tem o cabeçalho "${name}" duplicado. Identifique cada coluna uma única vez.`);
    }
    return { row, indices: headers.map((name) => columns.get(normalized(name))?.[0] ?? null) };
  }
  throw Error(`A aba "${sheet.name}" está fora do padrão. Confira as colunas obrigatórias: ${required.join(", ")}. A ordem das colunas pode variar.`);
}

const totalRow = (value) => /^(total|totais)(\s+geral)?\s*:?$/.test(normalized(value));
const footerNote = (value) => /^(fontes?\s*:|notas?\s*:|observacoes\s*:|quantidades? arredondad)/.test(normalized(value));

function taxonomyRows(sheet, config) {
  const layout = supplementColumns(sheet, config.headers, config.headers.slice(0, 4));
  const rows = [];
  sheet.eachRow((row, n) => {
    if (n <= layout.row) return;
    const cells = layout.indices.map((index) => index === null ? null : valueOf(row.getCell(index).value));
    if (!cells.some(present) || totalRow(cells[0])) return;
    if (!present(cells[0])) throw Error(`${sheet.name}, linha ${n}: preencha ${config.headers[0]} antes de importar.`);
    rows.push({ id: `taxonomy:${sheet.name}:${n}`, kind: "taxonomy", cells: cells.map((value) => value === null ? null : String(value)), source_sheet: sheet.name, source_row: n });
  });
  return rows;
}

function mergeTaxonomy(primary, complete, headers, warnings) {
  const keyOf = (row) => normalized(row.cells[0]);
  for (const rows of [primary, complete]) {
    const seen = new Set();
    for (const row of rows) {
      const key = keyOf(row);
      if (seen.has(key)) throw Error(`${row.source_sheet}, linha ${row.source_row}: nome científico duplicado. Confira os registros antes de combinar as abas do catálogo.`);
      seen.add(key);
    }
  }
  const index = new Map(primary.map((row) => [keyOf(row), row]));
  for (const row of complete) {
    const match = index.get(keyOf(row));
    if (!match) { primary.push(row); index.set(keyOf(row), row); continue; }
    match.detail_sheet = row.source_sheet;
    match.detail_row = row.source_row;
    for (let i = 1; i < headers.length; i++) {
      if (!present(match.cells[i])) match.cells[i] = row.cells[i];
      else if (present(row.cells[i]) && normalized(match.cells[i]) !== normalized(row.cells[i])) warnings.push(`${match.source_sheet}, linha ${match.source_row}: "${headers[i]}" difere da aba ${row.source_sheet}. Foi mantido o valor da aba ${match.source_sheet}.`);
    }
  }
  return primary;
}

export function parseSupplement(workbook, source, fileName, importedAt = new Date().toISOString()) {
  const config = sourceById[source];
  if (!config?.headers) throw Error("Tipo de planilha não reconhecido.");
  const sheet = workbook.worksheets.find((s) => normalized(s.name) === normalized(config.sheet));
  const complete = source === "taxonomy" ? workbook.worksheets.find((s) => normalized(s.name).replace(/[.\s_-]/g, "") === "especiescompleto") : null;
  if (!sheet && !complete) throw Error(`A aba obrigatória "${config.sheet}" não foi encontrada. Selecione a planilha de ${config.title}.`);
  let records = [];
  const warnings = [], notes = [];
  if (source === "weekly") {
    const layout = supplementColumns(sheet, [...config.headers, "Início", "Fim"], config.headers);
    sheet.eachRow((row, n) => {
      if (n <= layout.row) return;
      const values = layout.indices.map((index) => index === null ? null : valueOf(row.getCell(index).value));
      const cells = values.slice(0, config.headers.length);
      if (!values.some(present) || totalRow(cells[0])) return;
      if (footerNote(cells[0]) && !values.slice(1).some(present)) { notes.push(["Nota da planilha", String(cells[0])]); return; }
      if (!present(cells[0])) throw Error(`${sheet.name}, linha ${n}: preencha ${config.headers[0]} antes de importar.`);
      cells[0] = String(cells[0]);
      for (let i = 1; i < cells.length; i++) {
        cells[i] = numberOf(cells[i]);
        if (present(cells[i]) && (typeof cells[i] !== "number" || !Number.isFinite(cells[i]) || cells[i] < 0)) {
          throw Error(`${sheet.name}, linha ${n}: o valor de "${config.headers[i]}" deve ser um número maior ou igual a zero.`);
        }
      }
      const sum = cells.slice(1, 5).reduce((total, value) => total + (value || 0), 0);
      if (cells.slice(1, 5).some((value) => !present(value))) warnings.push(`Linha ${n}: há fornecedor sem quantidade salva. Campos vazios não entram nas somas.`);
      if (!present(cells[5]) || Math.abs(sum - cells[5]) > 0.000001) warnings.push(`Linha ${n}: o TOTAL salvo difere da soma dos fornecedores ou está vazio. O dashboard usa a soma das colunas de fornecedores.`);
      const period = {};
      for (const [name, i] of [["weekStart", 6], ["weekEnd", 7]]) {
        if (layout.indices[i] === null) continue;
        period[name] = present(values[i]) ? String(dateOf(values[i], workbook.properties.date1904)) : null;
        if (present(period[name]) && !validDate(period[name])) warnings.push(`${sheet.name}, linha ${n}: data de ${i === 6 ? "início" : "fim"} não interpretável, preservada para consulta.`);
      }
      records.push({ id: `${source}:${n}`, kind: source, cells, source_sheet: sheet.name, source_row: n, ...period });
    });
  } else {
    records = taxonomyRows(sheet || complete, config);
    if (sheet && complete) records = mergeTaxonomy(records, taxonomyRows(complete, config), config.headers, warnings);
  }
  if (source === "taxonomy") {
    const noteSheet = workbook.worksheets.find((s) => normalized(s.name) === "fontes e notas");
    if (noteSheet) {
      noteSheet.eachRow((row, n) => {
        if (n === 1) return;
        const item = valueOf(row.getCell(1).value), description = valueOf(row.getCell(2).value);
        if (present(item) || present(description)) notes.push([String(item ?? ""), String(description ?? "")]);
      });
    }
  }
  return { version: 1, source, fileName, importedAt, records, headers: [...config.headers], warnings, notes };
}

export async function readExcel(buffer, fileName, source = "operations") {
  const { default: ExcelJS } = await import("exceljs");
  const workbook = new ExcelJS.Workbook();
  try { await workbook.xlsx.load(buffer); }
  catch { throw Error("Não foi possível ler o arquivo. Selecione uma planilha .xlsx válida, sem senha de proteção para abertura."); }
  return source === "operations" ? parseWorkbook(workbook, fileName) : parseSupplement(workbook, source, fileName);
}
