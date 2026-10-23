import { norm, validDate, emptyFilters } from "./domain.mjs";

function snapshotDate(header) {
  if (validDate(header)) return header;
  const match = String(header).match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!match) return null;
  const date = `${match[3]}-${match[2]}-${match[1]}`;
  return validDate(date) && new Date(date).toISOString().slice(0, 10) === date ? date : null;
}

export function damageSnapshots(records, definition, filters = emptyFilters) {
  const all = records.filter((row) => row.kind === "apuracoes");
  const rows = all.filter((row) => !filters.supplier || norm(row.cells[0]) === norm(filters.supplier));
  const columns = (definition?.headers || []).slice(1).map((label, i) => ({ label, index: i + 1, date: snapshotDate(label) }))
    .filter(({ date }) => !(filters.start || filters.end) || (date && (!filters.start || date >= filters.start) && (!filters.end || date <= filters.end)));
  const totals = columns.map(({ index }) => {
    const values = rows.map((row) => row.cells[index]).filter((value) => typeof value === "number" && Number.isFinite(value));
    return { value: values.length ? values.reduce((sum, value) => sum + value, 0) : null, partial: values.length > 0 && values.length < rows.length };
  });
  return { available: all.length > 0, rows, columns, totals };
}
