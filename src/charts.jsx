import React, { useEffect, useRef, useState, useId } from "react";
import * as echarts from "echarts";
import { fmt } from "./domain.mjs";
import { chartDetails } from "./chart-details.mjs";
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
function ChartCanvas({ title, option, height, dark, onSelect }) {
  const el = useRef();
  const select = useRef(onSelect);
  select.current = onSelect;
  useEffect(() => {
    const chart = echarts.init(el.current);
    const ink = dark ? "#dce8ee" : "#526574";
    const axisTheme = (axis) => ({
      ...axis,
      axisLabel: { ...axis.axisLabel, color: ink },
    });
    chart.setOption({
      animation: false,
      color: palette,
      textStyle: { fontFamily: "Verdana", color: dark ? "#dce8ee" : "#526574" },
      tooltip: {
        trigger: "axis",
        confine: true,
        valueFormatter: (v) => fmt(v),
      },
      ...option,
      legend: { ...option.legend, textStyle: { color: ink } },
      ...(option.xAxis ? { xAxis: axisTheme(option.xAxis) } : {}),
      ...(option.yAxis ? { yAxis: axisTheme(option.yAxis) } : {}),
      series: option.series.map((s) => s.type === "pie"
        ? { ...s, label: { ...s.label, color: ink, textBorderWidth: 0 } }
        : s),
    });
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
  }, [option, dark]);
  return <div ref={el} style={{ height }} role="img" aria-label={title} />;
}
export function Chart({ title, subtitle, option, height = 300, dark = false, filterText }) {
  const [detail, setDetail] = useState(null);
  const dialog = useRef();
  const opener = useRef();
  const expandButton = useRef();
  const headingId = useId();
  const { columns, rows, totals } = chartDetails(option);
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
      <ChartCanvas title={title} option={option} height={height} dark={dark} onSelect={open} />
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
              dark={dark} onSelect={open} />
            <div className="chart-detail-selection">
              <h3>{selected ? `Detalhes: ${selected.label}` : "Detalhamento completo"}</h3>
              {selected && <button onClick={() => open()}>Mostrar todas as categorias</button>}
            </div>
            <p>Clique em uma barra ou fatia para consultar sua contribuição. Os totais abaixo respeitam os filtros do dashboard.</p>
            <div className="chart-detail-metrics">
              {columns.map((name, i) => <div key={`${name}-${i}`}><span>{name} · total do gráfico</span><strong>{fmt(totals[i], 4)}</strong></div>)}
            </div>
            <div className="chart-detail-table">
              <table>
                <thead><tr><th>Categoria</th>{columns.map((name, i) => <React.Fragment key={i}><th>{name} (un.)</th><th>% do total de {name}</th></React.Fragment>)}</tr></thead>
                <tbody>{visible.map((row) => <tr key={row.label}><th scope="row">{row.label}</th>{row.values.map((value, i) => <React.Fragment key={i}><td>{fmt(value, 4)}</td><td>{totals[i] > 0 && value >= 0 ? `${fmt(value / totals[i] * 100)}%` : "—"}</td></React.Fragment>)}</tr>)}</tbody>
              </table>
              {!rows.length && <p>Não há dados para os filtros selecionados.</p>}
            </div>
            <p className="chart-detail-note">Quantidades em unidades, preservando as frações do histórico. Saldo representa entradas menos saídas do período; percentuais não são calculados para valores negativos ou totais não positivos.</p>
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
export function DashboardCharts({ summary: s, dark, focusSupplier, filterText }) {
  const species = s.species;
  const chosen = focusSupplier || s.suppliers[0]?.[0];
  const comp = s.composition
    .filter(([k]) => k.startsWith(chosen + "|"))
    .map(([k, v]) => [k.split("|")[1], v])
    .sort((a, b) => b[1] - a[1]);
  const allSpecies = [...new Set(s.composition.map(([k]) => k.split("|")[1]))];
  return (
    <div className="charts-grid">
      <Chart
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
                  formatter: ({ value }) => fmt(value, 2),
                },
              },
            ],
          ),
          grid: { left: 55, right: 25, top: 65, bottom: 85 },
        }}
      />
      <Chart
        title="Participação dos fornecedores"
        subtitle="Distribuição dos recebimentos no período"
        dark={dark}
        filterText={filterText}
        option={{
          tooltip: { trigger: "item", valueFormatter: (v) => fmt(v) },
          legend: { bottom: 0, type: "scroll" },
          series: [
            {
              type: "pie",
              radius: ["43%", "67%"],
              center: ["50%", "44%"],
              label: { formatter: "{d}%", fontSize: 12 },
              data: s.suppliers.map(([name, value]) => ({ name, value })),
            },
          ],
        }}
      />
      <div className="wide">
        <Chart
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
      <Chart
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
      <Chart
        title={`Espécies · ${chosen || "Fornecedor"}`}
        subtitle="Selecione um fornecedor acima para detalhar"
        dark={dark}
        filterText={filterText}
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
                formatter: ({ value }) => fmt(value, 2),
              },
            },
          ],
        }}
      />
    </div>
  );
}
