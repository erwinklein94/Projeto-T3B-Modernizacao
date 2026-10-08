import { dateText, filterDescription, fmt, validDate } from "./domain.mjs";
export async function exportExcel(def, rows) {
  const { default: ExcelJS } = await import("exceljs");
  const wb = new ExcelJS.Workbook();
  wb.creator = "Projeto T3B";
  const ws = wb.addWorksheet(def.sheet.slice(0, 31));
  ws.addRow(def.headers);
  rows.forEach((r) =>
    ws.addRow(
      r.cells.map((v, i) =>
        def.dates.includes(i) && validDate(v) ? new Date(v + "T12:00:00Z") : v,
      ),
    ),
  );
  ws.getRow(1).eachCell((c) => {
    c.font = { bold: true, color: { argb: "FFFFFFFF" } };
    c.fill = {
      type: "pattern",
      pattern: "solid",
      fgColor: { argb: "FF003865" },
    };
    c.alignment = { wrapText: true, vertical: "middle" };
  });
  ws.getRow(1).height = 42;
  ws.columns.forEach((c, i) => {
    c.width = Math.min(42, Math.max(18, def.headers[i].length * 0.65));
    if (def.dates.includes(i)) c.numFmt = "dd/mm/yyyy";
  });
  ws.autoFilter = {
    from: { row: 1, column: 1 },
    to: { row: rows.length + 1, column: def.headers.length },
  };
  ws.views = [{ state: "frozen", ySplit: 1 }];
  download(
    await wb.xlsx.writeBuffer(),
    `${def.sheet}.xlsx`,
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  );
}
function download(data, name, type) {
  const url = URL.createObjectURL(new Blob([data], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export async function exportPDF(summary, filters) {
  const [{ jsPDF }, echarts] = await Promise.all([
    import("jspdf"),
    import("echarts"),
  ]);
  const doc = new jsPDF({ orientation: "landscape", unit: "mm", format: "a4" });
  let page = 0;
  const header = (title) => {
    page++;
    doc.setFillColor("#003865");
    doc.rect(0, 0, 297, 22, "F");
    doc.setTextColor("#ffffff");
    doc.setFontSize(17);
    doc.text("rumo | T3B", 12, 14);
    doc.setFontSize(10);
    doc.text("Gestão de dormentes", 285, 14, { align: "right" });
    doc.setTextColor("#003865");
    doc.setFontSize(17);
    doc.text(title, 12, 34);
    doc.setFontSize(9);
    doc.setTextColor("#526574");
    doc.text(doc.splitTextToSize(filterDescription(filters), 270), 12, 42);
    doc.setFontSize(8);
    doc.text(
      `Emitido em ${new Date().toLocaleString("pt-BR")}  |  ${page}`,
      285,
      202,
      { align: "right" },
    );
  };
  header("Visão geral de recebimentos e estoque");
  const metrics = [
    ["Recebidos", summary.received],
    ["Entradas", summary.incoming],
    ["Saídas", summary.outgoing],
    ["Saldo do período", summary.balance],
    ["Volume de saldo (m³)", summary.volume],
    ["Danificados pendentes", summary.damaged],
  ];
  metrics.forEach(([label, value], i) => {
    const x = 12 + (i % 3) * 92,
      y = 61 + Math.floor(i / 3) * 45;
    doc.setFillColor("#F2F5F6");
    doc.roundedRect(x, y, 87, 37, 2, 2, "F");
    doc.setTextColor("#526574");
    doc.setFontSize(10);
    doc.text(label, x + 7, y + 11);
    doc.setTextColor("#003865");
    doc.setFontSize(23);
    doc.text(fmt(value, 4), x + 7, y + 27);
  });
  doc.setFontSize(9);
  doc.setTextColor("#526574");
  doc.text(
    "Saldo = entradas menos saídas no período filtrado. Valores históricos preservados, incluindo frações.",
    12,
    163,
  );
  doc.text(
    `${summary.unknownDates} registros históricos sem data válida. Filtros de período excluem esses registros.`,
    12,
    170,
  );
  for (const card of document.querySelectorAll("[data-chart-title]")) {
    const el = card.querySelector("[_echarts_instance_]");
    const chart = el && echarts.getInstanceByDom(el);
    if (!chart) continue;
    doc.addPage();
    header(card.dataset.chartTitle);
    const data = chart.getDataURL({
      type: "png",
      pixelRatio: 2,
      backgroundColor: "#ffffff",
    });
    const props = doc.getImageProperties(data);
    const height = Math.min(137, (273 * props.height) / props.width),
      width = (height * props.width) / props.height;
    doc.addImage(data, "PNG", (297 - width) / 2, 56, width, height);
  }
  const tables = [
    [
      "Estoque por espécie",
      ["Espécie", "Entrada", "Saída", "Saldo", "m³"],
      summary.species.map((v) => [
        v.name,
        fmt(v.in, 4),
        fmt(v.out, 4),
        fmt(v.balance, 4),
        fmt(v.volume, 4),
      ]),
    ],
    [
      "Recebimentos por fornecedor",
      ["Fornecedor", "Recebidos"],
      summary.suppliers.map(([n, v]) => [n, fmt(v, 4)]),
    ],
    [
      "Danificados no período",
      ["Fornecedor", "Identificação", "Identificados", "Tratados", "Pendentes"],
      summary.damages.map((r) => [
        String(r.cells[6] || "Não informado"),
        dateText(r.cells[1]),
        fmt(r.cells[9]),
        fmt(r.cells[15]),
        fmt((r.cells[9] || 0) - (r.cells[15] || 0)),
      ]),
    ],
  ];
  for (const [title, columns, rows] of tables) {
    for (let start = 0; start < Math.max(1, rows.length); start += 14) {
      doc.addPage();
      header(title);
      let y = 57;
      const widths = columns.length === 2 ? [200, 73] : [99, 51, 41, 41, 41];
      const positions = widths.map(
        (_, i) => 12 + widths.slice(0, i).reduce((a, b) => a + b, 0),
      );
      doc.setFillColor("#003865");
      doc.rect(12, y, 273, 10, "F");
      doc.setTextColor("#ffffff");
      doc.setFontSize(9);
      columns.forEach((c, i) => doc.text(c, positions[i] + 3, y + 6));
      y += 10;
      for (const row of rows.slice(start, start + 14)) {
        doc.setFillColor("#F2F5F6");
        doc.rect(12, y, 273, 8, "F");
        doc.setTextColor("#003865");
        doc.setFontSize(8);
        row.forEach((c, i) =>
          doc.text(
            doc.splitTextToSize(String(c), widths[i] - 5)[0] || "",
            positions[i] + 3,
            y + 5,
          ),
        );
        y += 8;
      }
      if (!rows.length) {
        doc.setTextColor("#526574");
        doc.text("Nenhum registro no filtro selecionado.", 15, y + 8);
      }
    }
  }
  doc.save("T3B-dashboard.pdf");
}
