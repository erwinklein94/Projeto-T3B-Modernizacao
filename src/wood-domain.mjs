import { norm } from "./domain.mjs";

// As quatro propriedades com cabeçalho verde no modelo de importação.
export const WOOD_METRICS = [
  { id: "density", column: 2, title: "Densidade básica", unit: "kg/m³" },
  { id: "mor", column: 5, title: "Resistência à flexão (MOR)", unit: "MPa" },
  { id: "moe", column: 6, title: "Módulo de elasticidade (MOE) — flexão", unit: "MPa" },
  { id: "janka", column: 9, title: "Dureza Janka (paralela)", unit: "N" },
];
export const woodValue = (row, metric) => typeof row.cells[metric.column] === "number" && Number.isFinite(row.cells[metric.column]) ? row.cells[metric.column] : null;
export const woodGroup = (row) => /^(eucalyptus|corymbia)\b/.test(norm(row.cells[0])) ? "eucalyptus" : "other";
export const woodCaveat = (row, metric) => ["moe", "janka"].includes(metric.id) && /\b(so verde|provavelmente verde|sem dado seco)\b/.test(norm(row.cells[14])) ? String(row.cells[14]) : "";

export function filterWood(records = [], { group = "", search = "", species = null } = {}) {
  return records.filter((row) => (!group || woodGroup(row) === group) && (!search || norm(row.cells.join(" ")).includes(norm(search))) && (species === null || species.includes(row.cells[0])));
}
