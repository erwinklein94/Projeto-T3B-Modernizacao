import React, { useEffect, useRef } from "react";
import * as echarts from "echarts";
import { fmt } from "./domain.mjs";
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
export function Chart({ title, subtitle, option, height = 300, dark = false }) {
  const el = useRef();
  useEffect(() => {
    const chart = echarts.init(el.current);
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
    });
    const ro = new ResizeObserver(() => chart.resize());
    ro.observe(el.current);
    return () => {
      ro.disconnect();
      chart.dispose();
    };
  }, [option, dark]);
  return (
    <article className="panel chart-card" data-chart-title={title}>
      <div className="panel-heading">
        <h3>{title}</h3>
        <p>{subtitle}</p>
      </div>
      <div ref={el} style={{ height }} role="img" aria-label={title} />
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
export function DashboardCharts({ summary: s, dark, focusSupplier }) {
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
        option={{
          ...bar(
            s.months.map(([m]) => m.split("-").reverse().join("/")),
            [
              {
                name: "Recebidos",
                data: s.months.map((x) => x[1]),
                itemStyle: { color: "#32A6E6", borderRadius: [4, 4, 0, 0] },
              },
            ],
          ),
        }}
      />
      <Chart
        title="Participação dos fornecedores"
        subtitle="Distribuição dos recebimentos no período"
        dark={dark}
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
        height={380}
        option={{
          grid: { left: 160, right: 45, top: 15, bottom: 30 },
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
            },
          ],
        }}
      />
    </div>
  );
}
