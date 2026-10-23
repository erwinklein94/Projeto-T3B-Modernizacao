import test from "node:test";
import assert from "node:assert/strict";
import { stackTotalLabels } from "../src/stack-labels.mjs";

test("weekly totals appear once above the highest nonzero supplier and follow legend filters", () => {
  const series = [{ name: "A", data: [1000, 7, 0] }, { name: "B", data: [250, 0, 0] }, { name: "C", data: [0, 3, 0] }];
  const labels = (selected, dataIndex) => stackTotalLabels(series, selected, (n) => n.toLocaleString("pt-BR"))
    .map((s) => s.label.formatter({ dataIndex }));
  assert.deepEqual(labels({}, 0), ["", "1.250", ""]);
  assert.deepEqual(labels({}, 1), ["", "", "10"]);
  assert.deepEqual(labels({ B: false }, 0), ["1.000", "", ""]);
  assert.deepEqual(labels({ A: false }, 1), ["", "", "3"]);
  assert.deepEqual(labels({ A: false, B: false, C: false }, 0), ["", "", ""]);
  assert.deepEqual(labels({}, 2), ["", "", ""]);
});
