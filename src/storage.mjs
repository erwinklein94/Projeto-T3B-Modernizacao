import definitions from "./definitions.json" with { type: "json" };
import { sourceById } from "./sources.mjs";

export const STORAGE_KEY = "t3b:excel:v1";
export function storageKey(source = "operations") {
  if (!sourceById[source]) throw Error("Tipo de planilha não reconhecido.");
  return source === "operations" ? STORAGE_KEY : `t3b:excel:${source}:v1`;
}
const scalar = (v) => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
export function validateDataset(data, source = "operations") {
  if (source !== "operations") {
    const config = sourceById[source];
    const valid = config?.headers && data?.version === 1 && data.source === source &&
      typeof data.fileName === "string" && typeof data.importedAt === "string" && Number.isFinite(Date.parse(data.importedAt)) &&
      JSON.stringify(data.headers) === JSON.stringify(config.headers) &&
      Array.isArray(data.warnings) && data.warnings.every((v) => typeof v === "string") &&
      Array.isArray(data.notes) && data.notes.every((v) => Array.isArray(v) && v.length === 2 && v.every((c) => typeof c === "string")) &&
      Array.isArray(data.records) && data.records.every((row) => row?.kind === source && typeof row.id === "string" &&
        Array.isArray(row.cells) && row.cells.length === config.headers.length && row.cells.every(scalar) &&
        typeof row.cells[0] === "string" &&
        (source !== "weekly" || (row.cells.slice(1).every((v) => v === null || (typeof v === "number" && v >= 0)) &&
          [row.weekStart, row.weekEnd].every((v) => v === undefined || v === null || typeof v === "string"))));
    if (!valid) throw Error("Os dados locais estão inválidos ou são de outra versão. Importe novamente a planilha Excel.");
    return data;
  }
  const valid = data?.version === 1 && typeof data.fileName === "string" &&
    typeof data.importedAt === "string" && Number.isFinite(Date.parse(data.importedAt)) &&
    Array.isArray(data.warnings) && data.warnings.every((w) => typeof w === "string") &&
    Array.isArray(data.definitions) && data.definitions.length === definitions.length &&
    definitions.every((original, i) => {
      const def = data.definitions[i];
      return def?.id === original.id && def.sheet === original.sheet && def.name === original.name &&
        Array.isArray(def.headers) && def.headers.length > 0 && def.headers.every((h) => typeof h === "string") &&
        (def.id === "apuracoes" || JSON.stringify(def.headers) === JSON.stringify(original.headers)) &&
        JSON.stringify(def.dates) === JSON.stringify(original.dates);
    }) && Array.isArray(data.records) && data.records.every((row) => {
      const def = data.definitions.find((d) => d.id === row?.kind);
      return def && typeof row.id === "string" && Array.isArray(row.cells) &&
        row.cells.length === def.headers.length && row.cells.every(scalar);
    });
  if (!valid) throw Error("Os dados locais estão inválidos ou são de outra versão. Importe novamente a planilha Excel.");
  return data;
}
export function readDataset(storage, source = "operations") {
  let raw;
  try { raw = (storage || window.localStorage).getItem(storageKey(source)); }
  catch { throw Error("O navegador bloqueou o armazenamento local. Habilite o armazenamento deste site para importar a planilha."); }
  if (raw === null) return null;
  try { return validateDataset(JSON.parse(raw), source); }
  catch { throw Error("Não foi possível recuperar os dados locais. Importe novamente a planilha Excel."); }
}
export function saveDataset(data, storage, source = "operations") {
  validateDataset(data, source);
  try { (storage || window.localStorage).setItem(storageKey(source), JSON.stringify(data)); }
  catch { throw Error("Não foi possível salvar a planilha neste navegador. Verifique o espaço disponível e a permissão de armazenamento. Os dados anteriores foram mantidos."); }
}
export function clearDataset(storage, source = "operations") {
  try { (storage || window.localStorage).removeItem(storageKey(source)); }
  catch { throw Error("Não foi possível limpar os dados locais. Verifique a permissão de armazenamento do navegador."); }
}
