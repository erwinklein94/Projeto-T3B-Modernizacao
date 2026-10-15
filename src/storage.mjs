import definitions from "./definitions.json" with { type: "json" };

export const STORAGE_KEY = "t3b:excel:v1";
const scalar = (v) => v === null || typeof v === "string" || typeof v === "boolean" || (typeof v === "number" && Number.isFinite(v));
export function validateDataset(data) {
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
export function readDataset(storage) {
  let raw;
  try { raw = (storage || window.localStorage).getItem(STORAGE_KEY); }
  catch { throw Error("O navegador bloqueou o armazenamento local. Habilite o armazenamento deste site para importar a planilha."); }
  if (raw === null) return null;
  try { return validateDataset(JSON.parse(raw)); }
  catch { throw Error("Não foi possível recuperar os dados locais. Importe novamente a planilha Excel."); }
}
export function saveDataset(data, storage) {
  validateDataset(data);
  try { (storage || window.localStorage).setItem(STORAGE_KEY, JSON.stringify(data)); }
  catch { throw Error("Não foi possível salvar a planilha neste navegador. Verifique o espaço disponível e a permissão de armazenamento. Os dados anteriores foram mantidos."); }
}
export function clearDataset(storage) {
  try { (storage || window.localStorage).removeItem(STORAGE_KEY); }
  catch { throw Error("Não foi possível limpar os dados locais. Verifique a permissão de armazenamento do navegador."); }
}
