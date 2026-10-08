import test from "node:test";
import assert from "node:assert/strict";
import {
  summarize,
  matches,
  emptyFilters,
  supplierIndex,
  recalculate,
} from "../src/domain.mjs";
const receipt = {
  kind: "recebimentos",
  cells: [
    1,
    "2026-06-20",
    "Jales",
    "L1",
    "Fornecedor A",
    null,
    null,
    null,
    "Espécie A",
    10.5,
    1.2,
    1.1991,
  ],
};
const move = {
  kind: "movimentacoes",
  cells: [
    "2026-06-20",
    "Recebimento",
    "jales",
    "L1",
    null,
    "Espécie A",
    10.5,
    2.25,
    1.2,
    0.25,
  ],
};
test("Preserva frações e calcula o saldo com movimentações, sem duplicar recebimentos", () => {
  const s = summarize([receipt, move]);
  assert.equal(s.received, 10.5);
  assert.equal(s.incoming, 10.5);
  assert.equal(s.outgoing, 2.25);
  assert.equal(s.balance, 8.25);
  assert.equal(s.volume, 0.95);
});
test("Período inclui os limites e exclui datas inválidas apenas quando filtrado", () => {
  const bad = { ...receipt, cells: [...receipt.cells] };
  bad.cells[1] = "04 e 05 de setembro";
  assert.equal(matches(bad, emptyFilters), true);
  assert.equal(matches(bad, { ...emptyFilters, start: "2026-01-01" }), false);
  assert.equal(
    matches(receipt, {
      ...emptyFilters,
      start: "2026-06-20",
      end: "2026-06-20",
    }),
    true,
  );
});
test("Filtro de fornecedor também limita movimentações pelo lote, pátio e espécie", () => {
  const f = { ...emptyFilters, supplier: "Fornecedor A" };
  assert.equal(matches(move, f, supplierIndex([receipt, move])), true);
  assert.equal(summarize([receipt, move], f).balance, 8.25);
});
test("Lote ambíguo não atribui estoque ao fornecedor errado", () => {
  const other = { ...receipt, cells: [...receipt.cells] };
  other.cells[4] = "Fornecedor B";
  assert.equal(
    matches(
      move,
      { ...emptyFilters, supplier: "Fornecedor A" },
      supplierIndex([receipt, other]),
    ),
    false,
  );
});
test("Danos pendentes descontam quantidade tratada", () => {
  const c = Array(21).fill(null);
  c[9] = 20;
  c[15] = 5;
  assert.equal(summarize([{ kind: "danificados", cells: c }]).damaged, 15);
  assert.equal(recalculate("danificados", c)[16], 15);
});
test("Volume interno respeita dimensão selecionada e arredondamento", () => {
  const c = recalculate("recebimentos", receipt.cells, 0.105);
  assert.equal(c[11], 1.1025);
  assert.equal(receipt.cells[11], 1.1991);
});
