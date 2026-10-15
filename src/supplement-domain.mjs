import { norm, num } from "./domain.mjs";
import { sourceById } from "./sources.mjs";

export function summarizeWeekly(dataset, { week = "", supplier = "" } = {}) {
  const providers = sourceById.weekly.headers.slice(1, 5).map((name, i) => ({ name, index: i + 1 }))
    .filter((provider) => !supplier || provider.name === supplier);
  const rows = (dataset?.records || []).filter((r) => !week || r.cells[0] === week);
  const totals = providers.map(({ name, index }) => ({ name, value: rows.reduce((sum, r) => sum + num(r.cells[index]), 0) }));
  const byWeek = rows.map((r) => ({ label: r.cells[0], total: providers.reduce((sum, p) => sum + num(r.cells[p.index]), 0) }));
  return { rows, providers, totals, byWeek, total: totals.reduce((sum, p) => sum + p.value, 0), activeWeeks: byWeek.filter((r) => r.total > 0).length };
}

function counts(rows, column) {
  const result = new Map();
  for (const row of rows) {
    const name = String(row.cells[column] || "Não informado").trim();
    result.set(name, (result.get(name) || 0) + 1);
  }
  return [...result].map(([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value || a.name.localeCompare(b.name, "pt-BR"));
}
export function summarizeTaxonomy(dataset, { family = "", genus = "", search = "" } = {}) {
  const rows = (dataset?.records || []).filter(({ cells }) => (!family || cells[2] === family) && (!genus || cells[3] === genus) && (!search || norm(cells.join(" ")).includes(norm(search))));
  return {
    rows, families: counts(rows, 2), genera: counts(rows, 3),
    familyCount: new Set(rows.map((r) => r.cells[2]).filter(Boolean)).size,
    genusCount: new Set(rows.map((r) => r.cells[3]).filter(Boolean)).size,
    annotated: rows.filter((r) => String(r.cells[7] || "").trim()).length,
  };
}
