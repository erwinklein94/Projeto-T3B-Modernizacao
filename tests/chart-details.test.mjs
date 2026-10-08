import test from "node:test";
import assert from "node:assert/strict";
import { chartDetails } from "../src/chart-details.mjs";

test("details preserve every category beyond chart zoom and fractional balances", () => {
  const data = chartDetails({
    xAxis: { type: "category", data: ["A", "B", "C"] },
    dataZoom: [{ start: 0, end: 20 }],
    series: [{ name: "Saldo", data: [12.5, -2, 0] }],
  });
  assert.equal(data.rows.length, 3);
  assert.deepEqual(data.totals, [10.5]);
  assert.equal(data.rows[1].values[0], -2);
});
test("pie details use category names and numeric values", () => {
  assert.deepEqual(chartDetails({ series: [{ type: "pie", data: [{ name: "A", value: 7.25 }] }] }), {
    columns: ["Recebidos"], rows: [{ label: "A", values: [7.25] }], totals: [7.25],
  });
});
test("horizontal series keep independent totals", () => {
  const details = chartDetails({ yAxis: { type: "category", data: ["A", "B"] }, series: [
    { name: "Espécie 1", data: [3, 1] }, { name: "Espécie 2", data: [2, 4] },
  ] });
  assert.deepEqual(details.totals, [4, 6]);
  assert.deepEqual(details.rows[1], { label: "B", values: [1, 4] });
  assert.deepEqual(chartDetails({ series: [] }).rows, []);
});
test("stacked composition gives readable supplier/species rows and an unduplicated total", () => {
  const details = chartDetails({ xAxis: { type: "category", data: ["A", "B"] }, series: [
    { name: "Madeira 1", stack: "total", data: [3.5, 0] },
    { name: "Madeira 2", stack: "total", data: [2, 4] },
  ] });
  assert.deepEqual(details.totals, [9.5]);
  assert.equal(details.rows.length, 3);
  assert.deepEqual(details.rows[0], { label: "A · Madeira 1", values: [3.5] });
});
