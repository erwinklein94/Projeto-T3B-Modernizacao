import React, { useEffect, useRef, useState, useId } from "react";
import * as echarts from "echarts";
import { fmt, fmtQuantity, norm, validDate, dateText } from "./domain.mjs";
import { chartDetails } from "./chart-details.mjs";
import { stackTotalLabels } from "./stack-labels.mjs";
export const palette = [
  "#003865",
  "#32A6E6",
  "#1E9F7F",
  "#7FE06C",
  "#F78344",
  "#9F4BB9",
  "#BDCCD4",
  "#FBD300",
];
function ChartCanvas({ title, option, height, dark, onSelect, decimals }) {
  const el = useRef();
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const chart = echarts.init(el.current);
    const ink = dark ? "#dce8ee" : "#526574";
    const axisTheme = (axis) => ({
      ...axis,
      ...(axis.type === "value" && decimals === 0 ? { minInterval: 1 } : {}),
      axisLabel: { ...(axis.type === "value" ? { formatter: (v) => fmt(v, decimals) } : {}), ...axis.axisLabel, color: ink },
    });
    chart.setOption({
      animation: false,
      color: palette,
      textStyle: { fontFamily: "Verdana", color: dark ? "#dce8ee" : "#526574" },
      tooltip: {
        trigger: "axis",
        confine: true,
        valueFormatter: (v) => fmt(v, decimals),
        ...option.tooltip,
      },
      ...Object.fromEntries(Object.entries(option).filter(([key]) => key !== "tooltip" && key !== "stackTotalLabels")),
      legend: { ...option.legend, textStyle: { color: ink } },
      ...(option.xAxis ? { xAxis: axisTheme(option.xAxis) } : {}),
      ...(option.yAxis ? { yAxis: axisTheme(option.yAxis) } : {}),
      series: option.series.map((s) => s.type === "pie"
        ? { ...s, label: { color: ink, textBorderWidth: 0, ...s.label } }
        : s),
    });
    if (option.stackTotalLabels) {
      const updateTotals = (selected = {}) => chart.setOption({
        series: stackTotalLabels(option.series, selected, (value) => fmt(value, decimals))
          .map((s) => ({ ...s, label: { ...s.label, color: ink } })),
      });
      updateTotals(option.legend?.selected);
      chart.on("legendselectchanged", (event) => updateTotals(event.selected));
    }
    chart.on("click", (event) => {
      if (event.componentType === "series") select.current?.(
        option.series[event.seriesIndex]?.stack ? `${event.name} · ${event.seriesName}` : event.name,
      );
    });
    chart.getZr().on("click", (event) => {
      if (!event.target) select.current?.(null);
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [option, dark, decimals]);
  return <div ref={el} style={{ height }} role="img" aria-label={title} />;
}
export function Chart({ title, subtitle, option, height = 300, dark = false, filterText, unit = "un.", decimals = 2, comparison = false, controls, note = "Quantidades em unidades. Saldo representa entradas menos saídas do período; percentuais não são calculados para valores negativos ou totais não positivos." }) {
  const [detail, setDetail] = useState(null);
  const dialog = useRef();
  const opener = useRef();
  const expandButton = useRef();
  const headingId = useId();
  const { columns, rows, totals } = chartDetails(option, { preserveMissing: comparison });
  const selected = rows.find((r) => r.label === detail?.label);
  const visible = selected ? [selected] : rows;
  const expanded = {
    ...option,
    dataZoom: (option.dataZoom || []).map((z) => ({ ...z, start: 0, end: 100 })),
  };
  useEffect(() => {
    if (!detail) return;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => {
      document.body.style.overflow = overflow;
      const previous = opener.current;
      if (previous instanceof HTMLElement && previous !== document.body) previous.focus();
      else expandButton.current?.focus();
    };
  }, [Boolean(detail)]);
  const open = (label = null) => {
    if (!detail) opener.current = document.activeElement;
    setDetail({ label });
  };
  return (
    <article className="panel chart-card" data-chart-title={title}>
      <div className="panel-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
        <button ref={expandButton} className="chart-expand" onClick={() => open()} aria-label={`Ampliar ${title}`}>
          Ampliar e detalhar ↗
        </button>
      </div>
      {controls && <div className="chart-controls">{controls}</div>}
      <ChartCanvas title={title} option={option} height={height} dark={dark} decimals={decimals} onSelect={open} />
      {detail && (
        <dialog ref={dialog} className="chart-dialog" aria-labelledby={headingId}
          onCancel={() => setDetail(null)} onClose={() => setDetail(null)}
          onClick={(e) => { if (e.target === e.currentTarget) setDetail(null); }}>
          <div className="chart-detail-content">
            <header className="chart-detail-header">
              <div><h2 id={headingId}>{title}</h2><p>{subtitle}</p></div>
              <button autoFocus onClick={() => setDetail(null)} aria-label="Fechar detalhes do gráfico">Fechar ✕</button>
            </header>
            <p className="chart-filter-context">Filtros do dashboard: {filterText || "Todo o histórico"}</p>
            <ChartCanvas title={`${title} ampliado`} option={expanded}
              height={Math.max(360, option.yAxis?.type === "category" ? rows.length * 28 + 65 : 440)}
              dark={dark} decimals={decimals} onSelect={open} />
            <div className="chart-detail-selection">
              <h3>{selected ? `Detalhes: ${selected.label}` : "Detalhamento completo"}</h3>
              {selected && <button onClick={() => open()}>Mostrar todas as categorias</button>}
            </div>
            <p>{comparison ? "Clique em uma barra para consultar a propriedade da espécie. Valores sem dados não são convertidos em zero." : "Clique em uma barra ou fatia para consultar sua contribuição. Os totais abaixo respeitam os filtros do dashboard."}</p>
            {!comparison && <div className="chart-detail-metrics">
              {columns.map((name, i) => <div key={`${name}-${i}`}><span>{name} · total do gráfico</span><strong>{fmt(totals[i], decimals)}</strong></div>)}
            </div>}
            <div className="chart-detail-table">
              <table>
                <thead><tr><th>Categoria</th>{columns.map((name, i) => <React.Fragment key={i}><th>{name} ({unit})</th>{!comparison && <th>% do total de {name}</th>}</React.Fragment>)}</tr></thead>
                <tbody>{visible.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, i) => <React.Fragment key={i}><td>{value === null ? "Sem dado" : fmt(value, comparison ? 4 : decimals)}</td>{!comparison && <td>{totals[i] > 0 && value >= 0 ? `${fmt(value / totals[i] * 100, decimals)}%` : "—"}</td>}</React.Fragment>)}</tr>)}</tbody>
              </table>
              {!rows.length && <p>Não há dados para os filtros selecionados.</p>}
            </div>
            <p className="chart-detail-note">{note}</p>
            {title === "Recebimentos por mês" && <p className="chart-detail-note">Recebimentos sem data válida não entram na distribuição mensal; por isso, o total deste gráfico pode diferir do indicador geral.</p>}
          </div>
        </dialog>
      )}
    </article>
  );
}
export const bar = (labels, series) => ({
  grid: { left: 55, right: 25, top: 42, bottom: 85 },
  legend: { type: "scroll", top: 4 },
  xAxis: {
    type: "category",
    data: labels,
    axisLabel: {
      rotate: 35,
      fontSize: 10,
      interval: 0,
      overflow: "truncate",
      width: 100,
    },
  },
  yAxis: { type: "value", splitLine: { lineStyle: { color: "#bdccd433" } } },
  series: series.map((s) => ({ type: "bar", barMaxWidth: 32, ...s })),
});
const OperationChart = (props) => <Chart decimals={0} note="Quantidades e percentuais arredondados apenas na exibição. Cálculos e dados originais preservam as frações. Saldo representa entradas menos saídas no período." {...props} />;

export function ReceiptSpecies({ summary, names, dark, filterText }) {
  const entries = summary.receivedSpecies;
  const dates = summary.receipts.map((r) => r.cells[1]).filter(validDate).sort();
  const colors = ["#32a6d5", "#102e50", "#24713d", "#179f99", "#d22f70", "#90bf47", "#8055b7", "#f5a34c", "#56b3b0", "#306780", "#315d39", "#63899d", "#9c7953", "#baa26e", "#a35927", "#c3a32b", "#5e3f8e", "#e5c9a6", "#444444", "#d58c16"];
  const rows = entries.map((entry, i) => ({ ...entry, popular: names.get(norm(entry.name)) || "Não informado", color: colors[i] || `hsl(${i * 137.508 % 360}, 45%, 42%)` }));
  const validPercent = summary.received > 0 && rows.every((r) => r.value >= 0);
  return <section className="receipt-species" aria-label="Recebimentos por espécie">
    <div className="section-heading"><div><h2>Recebimentos de dormentes por espécie</h2><p>{dates.length ? `Período: ${dateText(dates[0])} até ${dateText(dates.at(-1))}` : "Nenhuma data válida no filtro"}</p></div></div>
    <div className="species-overview">
      <OperationChart title="Participação por espécie" subtitle="Recebimentos em unidades · todas as espécies do filtro" dark={dark} filterText={filterText} height={Math.max(360, Math.min(680, rows.length * 19))}
        option={{ tooltip: { trigger: "item" }, legend: { show: false }, series: [{ name: "Recebidos", type: "pie", radius: "85%", center: ["50%", "50%"],
          label: { position: "inside", color: "#ffffff", fontWeight: "bold", formatter: ({ value }) => value / summary.received * 100 >= 1.5 ? `${fmtQuantity(value / summary.received * 100)}%` : "" },
          itemStyle: { borderColor: dark ? "#132c3c" : "#ffffff", borderWidth: 1 },
          data: validPercent ? rows.filter((r) => r.value > 0).map((r) => ({ name: r.popular === "Não informado" ? r.name : `${r.popular} (${r.name})`, value: r.value, itemStyle: { color: r.color } })) : [] }] }} />
      <article className="panel species-summary">
        <div className="table-title"><h3>Resumo por espécie</h3><span>{rows.length} espécies</span></div>
        <div className="table-wrap"><table><caption>Quantidades da aba Recebimentos no filtro selecionado</caption><thead><tr><th>Nome popular</th><th>Nome científico</th><th>Entrada (un.)</th><th>% total</th></tr></thead>
          <tbody>{rows.map((r) => <tr key={r.name}><td><span className="species-swatch" style={{ background: r.color }} />{r.popular}</td><td><i>{r.name}</i></td><td>{fmtQuantity(r.value)}</td><td>{validPercent ? `${fmtQuantity(r.value / summary.received * 100)}%` : "—"}</td></tr>)}</tbody>
          <tfoot><tr><th colSpan={2}>Total</th><td>{fmtQuantity(summary.received)}</td><td>{validPercent ? "100%" : "—"}</td></tr></tfoot>
        </table></div>
        {!rows.length && <p className="empty">Nenhum recebimento encontrado.</p>}
      </article>
    </div>
    <p className="footnote">Percentuais calculados sobre o total de recebimentos do filtro. Quantidades e percentuais arredondados apenas na exibição; a soma dos valores exibidos pode diferir do total. Nomes populares: catálogo importado, propriedades da madeira ou imagem de referência; nomes sem correspondência ficam como “Não informado”.</p>
    {!validPercent && rows.length > 0 && <p className="notice">A participação não está disponível para quantidades negativas ou total não positivo.</p>}
  </section>;
}

export function DashboardCharts({ summary: s, dark, focusSupplier, onFocusSupplier, filterText }) {
  const species = s.species;
  const chosen = s.suppliers.some(([name]) => name === focusSupplier) ? focusSupplier : s.suppliers[0]?.[0];
  const comp = s.composition
    .filter(([k]) => k.startsWith(chosen + "|"))
    .map(([k, v]) => [k.split("|")[1], v])
    .sort((a, b) => b[1] - a[1]);
  const allSpecies = [...new Set(s.composition.map(([k]) => k.split("|")[1]))];
  return (
    <div className="charts-grid">
      <OperationChart
        title="Recebimentos por mês"
        subtitle="Evolução do volume recebido · unidades"
        dark={dark}
        filterText={filterText}
        option={{
          ...bar(
            s.months.map(([m]) => m.split("-").reverse().join("/")),
            [
              {
                name: "Recebidos",
                data: s.months.map((x) => x[1]),
                itemStyle: { color: "#32A6E6", borderRadius: [4, 4, 0, 0] },
                label: {
                  show: true,
                  position: "top",
                  distance: 7,
                  color: dark ? "#dce8ee" : "#003865",
                  fontSize: 11,
                  fontWeight: "bold",
                  formatter: ({ value }) => fmtQuantity(value),
                },
              },
            ],
          ),
          grid: { left: 55, right: 25, top: 65, bottom: 85 },
        }}
      />
      <OperationChart
        title="Participação dos fornecedores"
        subtitle="Distribuição dos recebimentos no período"
        dark={dark}
        filterText={filterText}
        option={{
          tooltip: { trigger: "item" },
          legend: { bottom: 0, type: "scroll" },
          series: [
            {
              type: "pie",
              radius: ["43%", "67%"],
              center: ["50%", "44%"],
              label: { formatter: ({ value }) => s.received > 0 ? `${fmtQuantity(value / s.received * 100)}%` : "", fontSize: 12 },
              data: s.suppliers.map(([name, value]) => ({ name, value })),
            },
          ],
        }}
      />
      <div className="wide">
        <OperationChart
          title="Entradas, saídas e saldo por espécie"
          subtitle="Movimentações de estoque · saldo do período selecionado"
          dark={dark}
        filterText={filterText}
          height={390}
          option={{
            ...bar(
              species.map((v) => v.name),
              [
                { name: "Entradas", data: species.map((v) => v.in) },
                {
                  name: "Saídas",
                  data: species.map((v) => v.out),
                  itemStyle: { color: "#1E9F7F" },
                },
                {
                  name: "Saldo",
                  data: species.map((v) => v.balance),
                  itemStyle: { color: "#32A6E6" },
                },
              ],
            ),
            dataZoom: [
              {
                type: "slider",
                bottom: 0,
                start: 0,
                end: species.length > 12 ? (12 / species.length) * 100 : 100,
              },
            ],
            grid: { left: 65, right: 25, top: 45, bottom: 130 },
          }}
        />
      </div>
      <OperationChart
        title="Fornecedor × espécie"
        subtitle="Composição dos recebimentos · unidades"
        dark={dark}
        filterText={filterText}
        height={380}
        option={{
          ...bar(
            s.suppliers.map((x) => x[0]),
            allSpecies.map((sp) => ({
              name: sp,
              stack: "total",
              data: s.suppliers.map(
                ([supplier]) =>
                  s.composition.find(([k]) => k === supplier + "|" + sp)?.[1] ||
                  0,
              ),
            })),
          ),
          legend: { show: false },
        }}
      />
      <OperationChart
        title={`Espécies · ${chosen || "Fornecedor"}`}
        subtitle="Recebimentos por espécie do fornecedor selecionado · unidades"
        controls={<label className="inline-select">Fornecedor do gráfico<select aria-label="Fornecedor do gráfico de espécies" value={chosen || ""} onChange={(e) => onFocusSupplier(e.target.value)} disabled={!s.suppliers.length}>
          {!s.suppliers.length && <option value="">Nenhum fornecedor</option>}
          {s.suppliers.map(([name]) => <option key={name} value={name}>{name}</option>)}
        </select></label>}
        dark={dark}
        filterText={[filterText, chosen].filter(Boolean).join(" · ")}
        height={380}
        option={{
          grid: { left: 160, right: 85, top: 15, bottom: 30 },
          xAxis: { type: "value" },
          yAxis: {
            type: "category",
            inverse: true,
            data: comp.map((x) => x[0]),
            axisLabel: { width: 145, overflow: "truncate", fontSize: 10 },
          },
          dataZoom:
            comp.length > 10
              ? [
                  {
                    type: "inside",
                    yAxisIndex: 0,
                    start: 0,
                    end: (10 / comp.length) * 100,
                  },
                ]
              : [],
          series: [
            {
              type: "bar",
              data: comp.map((x) => x[1]),
              itemStyle: { color: "#1E9F7F", borderRadius: [0, 4, 4, 0] },
              barMaxWidth: 23,
              label: {
                show: true,
                position: "right",
                distance: 5,
                color: dark ? "#dce8ee" : "#003865",
                fontSize: 10,
                formatter: ({ value }) => fmtQuantity(value),
              },
            },
          ],
        }}
      />
    </div>
  );
}
