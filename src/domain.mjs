export const norm = (v) =>
  String(v ?? "")
    .trim()
    .toLocaleLowerCase("pt-BR")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
export const num = (v) => (typeof v === "number" && Number.isFinite(v) ? v : 0);
export const fmt = (n, d = 2) =>
  new Intl.NumberFormat("pt-BR", { maximumFractionDigits: d }).format(num(n));
export const validDate = (v) =>
  typeof v === "string" &&
  /^\d{4}-\d{2}-\d{2}$/.test(v) &&
  !Number.isNaN(Date.parse(v));
export const dateText = (v) =>
  validDate(v) ? v.split("-").reverse().join("/") : String(v ?? "—");
export const fields = {
  recebimentos: {
    date: 1,
    yard: 2,
    lot: 3,
    supplier: 4,
    species: 8,
    qty: 9,
    status: 14,
  },
  movimentacoes: { date: 0, yard: 2, lot: 3, species: 5, qty: 6 },
  danificados: {
    date: 1,
    yard: 2,
    lot: 5,
    supplier: 6,
    species: 8,
    qty: 9,
    status: 17,
  },
  devolucoes: {
    date: 3,
    yard: 4,
    lot: 8,
    supplier: 6,
    species: 9,
    qty: 10,
    status: 17,
  },
  conciliacao: { date: 0, yard: 1, species: 2, status: 10 },
  consumo: { date: 1, yard: 2, lot: 3, species: 4, qty: 5 },
  transferencias: { date: 1, yard: 2, lot: 4, species: 5, qty: 6, status: 13 },
  madeiras: { species: 0 },
  apuracoes: { supplier: 0 },
  semanal: {},
  parametros: {},
};
export const emptyFilters = {
  start: "",
  end: "",
  supplier: "",
  species: "",
  yard: "",
  status: "",
  search: "",
};
export function supplierIndex(records) {
  const map = new Map();
  records
    .filter((r) => r.kind === "recebimentos")
    .forEach((r) => {
      const c = r.cells;
      const k = [c[2], c[3], c[8]].map(norm).join("|");
      const s = map.get(k) || new Set();
      s.add(String(c[4] || "Não informado").trim());
      map.set(k, s);
    });
  return map;
}
export function supplierOf(r, index) {
  const f = fields[r.kind] || {};
  if (f.supplier !== undefined)
    return String(r.cells[f.supplier] || "Não informado").trim();
  if (f.lot !== undefined) {
    const k = [r.cells[f.yard], r.cells[f.lot], r.cells[f.species]]
      .map(norm)
      .join("|");
    const set = index.get(k);
    return set?.size === 1 ? [...set][0] : "Não identificado";
  }
  return "";
}
export function matches(r, f, index = new Map()) {
  const m = fields[r.kind] || {},
    c = r.cells;
  if (f.start || f.end) {
    const d = c[m.date];
    if (!validDate(d) || (f.start && d < f.start) || (f.end && d > f.end))
      return false;
  }
  if (f.supplier && norm(supplierOf(r, index)) !== norm(f.supplier))
    return false;
  for (const k of ["species", "yard", "status"])
    if (f[k] && norm(c[m[k]]) !== norm(f[k])) return false;
  return !f.search || norm(c.join(" ")).includes(norm(f.search));
}
export function summarize(records, filters = emptyFilters) {
  const idx = supplierIndex(records),
    selected = records.filter((r) => matches(r, filters, idx));
  const receipts = selected.filter((r) => r.kind === "recebimentos"),
    moves = selected.filter((r) => r.kind === "movimentacoes"),
    damages = selected.filter((r) => r.kind === "danificados");
  const suppliers = new Map(),
    species = new Map(),
    months = new Map(),
    composition = new Map();
  receipts.forEach(({ cells: c }) => {
    const supplier = String(c[4] || "Não informado").trim(),
      sp = String(c[8] || "Não informada").trim(),
      q = num(c[9]);
    suppliers.set(supplier, (suppliers.get(supplier) || 0) + q);
    const key = supplier + "|" + sp;
    composition.set(key, (composition.get(key) || 0) + q);
    if (validDate(c[1])) {
      const m = c[1].slice(0, 7);
      months.set(m, (months.get(m) || 0) + q);
    }
  });
  moves.forEach(({ cells: c }) => {
    const sp = String(c[5] || "Não informada").trim(),
      v = species.get(sp) || { name: sp, in: 0, out: 0, balance: 0, volume: 0 };
    v.in += num(c[6]);
    v.out += num(c[7]);
    v.balance = v.in - v.out;
    v.volume += num(c[8]) - num(c[9]);
    species.set(sp, v);
  });
  const incoming = moves.reduce((s, r) => s + num(r.cells[6]), 0),
    outgoing = moves.reduce((s, r) => s + num(r.cells[7]), 0);
  return {
    receipts,
    moves,
    damages,
    suppliers: [...suppliers].sort((a, b) => b[1] - a[1]),
    species: [...species.values()].sort((a, b) => b.in - a.in),
    months: [...months].sort(),
    composition: [...composition],
    received: receipts.reduce((s, r) => s + num(r.cells[9]), 0),
    incoming,
    outgoing,
    balance: incoming - outgoing,
    volume: moves.reduce((s, r) => s + num(r.cells[8]) - num(r.cells[9]), 0),
    damaged: damages.reduce(
      (s, r) => s + num(r.cells[9]) - num(r.cells[15]),
      0,
    ),
    unknownDates: records.filter(
      (r) =>
        ["recebimentos", "movimentacoes", "danificados"].includes(r.kind) &&
        !validDate(r.cells[fields[r.kind].date]),
    ).length,
  };
}
export function recalculate(kind, cells, unit = 0.1142) {
  const c = [...cells];
  if (kind === "recebimentos") c[11] = Math.round(num(c[9]) * unit * 1e6) / 1e6;
  if (kind === "danificados") c[16] = num(c[9]) - num(c[15]);
  if (kind === "devolucoes") c[16] = num(c[10]) - num(c[15]);
  if (kind === "transferencias") {
    c[11] = num(c[6]) - num(c[9]);
    c[12] = num(c[7]) - num(c[10]);
  }
  if (kind === "semanal") c[5] = c.slice(1, 5).reduce((a, b) => a + num(b), 0);
  return c;
}
export const filterDescription = (f) =>
  [
    f.start && `De ${dateText(f.start)}`,
    f.end && `até ${dateText(f.end)}`,
    f.supplier,
    f.species,
    f.yard,
    f.status,
    f.search && `Busca: ${f.search}`,
  ]
    .filter(Boolean)
    .join(" · ") || "Todo o histórico";
