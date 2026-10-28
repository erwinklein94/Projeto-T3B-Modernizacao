import React, { useEffect, useId, useMemo, useRef, useState } from "react";
import { Search, Upload } from "lucide-react";
import { Chart, ChartCanvas } from "./charts";
import { fmt } from "./domain.mjs";
import { SourceStatus } from "./import-page";
import { sourceById } from "./sources.mjs";
import { WOOD_METRICS, filterWood, woodValue, woodCaveat, woodGroup } from "./wood-domain.mjs";

const groupOptions = [["", "Todas"], ["eucalyptus", "Eucaliptos"], ["other", "Demais espécies"]];
const colors = ["#328dcc", "#102f50", "#b71359", "#3d8b42", "#ef9847", "#9959b4", "#c5a328", "#1d9c92", "#6266b2", "#aa6a49", "#497e84", "#8a7251", "#477229"];
const note = "Valores das colunas destacadas em verde no Excel, sem conversão de unidades ou estimativas. A condição de umidade, a fonte e as observações de cada registro ficam na consulta abaixo. Barras hachuradas identificam ressalvas de umidade informadas na planilha.";

function Select({ label, value, onChange, options }) {
  return <label>{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}>{options.map(([value, name]) => <option key={value} value={value}>{name}</option>)}</select></label>;
}

function propertyOption(metric, plotted, allRows, dark) {
  return { legend: { show: false }, grid: { left: 72, right: 25, top: 28, bottom: 150 },
        xAxis: { type: "category", data: plotted.map((row) => `${row.cells[1] || row.cells[0]}\n(${row.cells[0]})`), axisLabel: { interval: 0, rotate: plotted.length > 5 ? 35 : 0, fontSize: 9, width: 105, overflow: "break" } },
        yAxis: { type: "value", name: metric.unit, splitLine: { lineStyle: { color: "#bdccd433" } } },
        dataZoom: plotted.length > 8 ? [{ type: "slider", bottom: 0, start: 0, end: 8 / plotted.length * 100 }] : [],
        series: [{ name: metric.title, type: "bar", barMaxWidth: 48,
          label: { show: true, position: "top", color: dark ? "#dce8ee" : "#003865", fontSize: 10, fontWeight: "bold", formatter: ({ value }) => value === null ? "" : fmt(value, 0) },
          data: plotted.map((row) => ({ value: woodValue(row, metric), itemStyle: { color: colors[allRows.findIndex((r) => r.id === row.id) % colors.length], ...(woodCaveat(row, metric) ? { decal: { symbol: "rect", symbolSize: 1, dashArrayX: [1, 0], dashArrayY: [2, 4], rotation: -Math.PI / 4, color: "rgba(255,255,255,0.75)" } } : {}) } })) }] };
}

function PropertyComparison({ metric, allRows, initialRows, dark, onClose }) {
  const dialog = useRef();
  const headingId = useId();
  const [selected, setSelected] = useState(() => initialRows.map((row) => row.id));
  const plotted = allRows.filter((row) => selected.includes(row.id));
  useEffect(() => {
    const opener = document.activeElement;
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialog.current.showModal();
    return () => {
      document.body.style.overflow = overflow;
      if (opener instanceof HTMLElement) opener.focus();
    };
  }, []);
  const option = propertyOption(metric, plotted, allRows, dark);
  const comparisonOption = {
    ...option,
    grid: { left: 145, right: 60, top: 35, bottom: 35 },
    xAxis: { ...option.yAxis, splitNumber: 3, axisLabel: { hideOverlap: true } },
    yAxis: { type: "category", inverse: true, data: option.xAxis.data, axisLabel: { interval: 0, fontSize: 10, width: 130, overflow: "break" } },
    dataZoom: [],
    series: option.series.map((series) => ({ ...series, label: { ...series.label, position: "right" } })),
  };
  return <dialog ref={dialog} className="chart-dialog wood-comparison-dialog" aria-labelledby={headingId}
    onCancel={onClose} onClose={onClose} onClick={(event) => { if (event.target === event.currentTarget) onClose(); }}>
    <div className="chart-detail-content">
      <header className="chart-detail-header">
        <div><h2 id={headingId}>Comparar — {metric.title}</h2><p>Selecione quantos itens quiser. O gráfico é atualizado a cada seleção.</p></div>
        <button autoFocus onClick={onClose} aria-label="Fechar comparação">Fechar ✕</button>
      </header>
      <p>Todos os registros importados estão disponíveis aqui. A seleção desta comparação é independente dos filtros do dashboard.</p>
      <div className="wood-species-picker">
        <div className="actions"><button onClick={() => setSelected(allRows.map((row) => row.id))}>Selecionar todos</button><button onClick={() => setSelected([])}>Desmarcar todos</button></div>
        <fieldset><legend>Itens para comparar — {metric.title}</legend>
          {allRows.map((row) => <label key={row.id}>
            <input type="checkbox" checked={selected.includes(row.id)} onChange={() => setSelected((current) => current.includes(row.id) ? current.filter((id) => id !== row.id) : [...current, row.id])} />
            <span>{row.cells[1] || row.cells[0]}<small>{row.cells[0]}</small>{woodValue(row, metric) === null && <small>Sem dado em {metric.unit}</small>}{woodCaveat(row, metric) && <small>Ressalva: {woodCaveat(row, metric)}</small>}</span>
          </label>)}
        </fieldset>
      </div>
      <p role="status">{plotted.length} de {allRows.length} itens selecionados</p>
      {!allRows.length ? <p className="empty">Importe uma planilha de propriedades da madeira para comparar os itens.</p> : !plotted.length ? <p className="empty">Selecione os itens que deseja comparar.</p> : <>
        <div className="wood-comparison-plot"><ChartCanvas title={'Comparação — ' + metric.title} option={comparisonOption} height={Math.max(280, plotted.length * 58 + 70)} dark={dark} decimals={0} /></div>
        <div className="chart-detail-table"><table>
          <thead><tr><th>Item</th><th>{metric.title} ({metric.unit})</th><th>Ressalva de umidade</th></tr></thead>
          <tbody>{plotted.map((row) => <tr key={row.id}><th scope="row">{row.cells[1] || row.cells[0]} ({row.cells[0]})</th><td>{woodValue(row, metric) === null ? "Sem dado" : fmt(woodValue(row, metric), 4)}</td><td>{woodCaveat(row, metric) || "—"}</td></tr>)}</tbody>
        </table></div>
      </>}
      <p className="chart-detail-note">{note} Registros sem dado não têm barra e não são convertidos em zero.</p>
    </div>
  </dialog>;
}

function PropertyChart({ metric, rows, allRows, dark, context }) {
  const [comparing, setComparing] = useState(false);
  const [species, setSpecies] = useState(""), [group, setGroup] = useState(""), [condition, setCondition] = useState("");
  const available = filterWood(rows, { group });
  const options = [...new Map(available.map((row) => [row.cells[0], [row.cells[0], `${row.cells[1] || row.cells[0]} (${row.cells[0]})`]])).values()];
  const chosen = options.some(([name]) => name === species) ? species : "";
  const plotted = available.filter((row) => (!chosen || row.cells[0] === chosen) && (!condition || Boolean(woodCaveat(row, metric)) === (condition === "flagged")));
  const missing = plotted.filter((row) => woodValue(row, metric) === null);
  const flagged = plotted.filter((row) => woodValue(row, metric) !== null && woodCaveat(row, metric));
  const filterText = [context, groupOptions.find(([id]) => id === group)?.[1], chosen, condition === "flagged" ? "Com ressalva de umidade" : condition === "clear" ? "Sem ressalva de umidade" : ""].filter(Boolean).join(" · ");
  return <div className="wood-property-card">
    <Chart title={metric.title} subtitle={`${metric.unit} · ${plotted.length - missing.length} de ${plotted.length} registros com valor`} unit={metric.unit} decimals={0} comparison onCompare={() => setComparing(true)} dark={dark} filterText={filterText} note={note} height={400}
      controls={<div className="wood-chart-filters">
        <Select label={`Grupo — ${metric.title}`} value={group} onChange={setGroup} options={groupOptions} />
        <Select label={`Espécie — ${metric.title}`} value={chosen} onChange={setSpecies} options={[["", "Todas as espécies"], ...options]} />
        {["moe", "janka"].includes(metric.id) && <Select label={`Umidade — ${metric.title}`} value={condition} onChange={setCondition} options={[["", "Todos os registros"], ["clear", "Sem ressalva de umidade"], ["flagged", "Com ressalva de umidade"]]} />}
        {(group || species || condition) && <button className="text-button" onClick={() => { setGroup(""); setSpecies(""); setCondition(""); }}>Limpar este gráfico</button>}
      </div>}
      option={propertyOption(metric, plotted, allRows, dark)} />
    {comparing && <PropertyComparison metric={metric} allRows={allRows} initialRows={plotted} dark={dark} onClose={() => setComparing(false)} />}
    <div className="wood-chart-notes">
      {!plotted.length && <p className="empty">Nenhuma espécie corresponde aos filtros deste gráfico.</p>}
      {missing.length > 0 && <p>Sem dado em {metric.unit}: {missing.map((row) => row.cells[1] || row.cells[0]).join(", ")}. Esses registros não têm barra.</p>}
      {flagged.length > 0 && <p><span className="wood-hatch" /> Ressalva de umidade: {flagged.map((row) => row.cells[1] || row.cells[0]).join(", ")}. Consulte a condição informada no Excel.</p>}
    </div>
  </div>;
}

export function WoodDashboard({ dataset, dark, onInsert }) {
  const [group, setGroup] = useState(""), [search, setSearch] = useState(""), [species, setSpecies] = useState(null);
  const records = dataset?.records || [];
  const rows = useMemo(() => filterWood(records, { group, search, species }), [records, group, search, species]);
  const choices = [...new Map(records.map((row) => [row.cells[0], row])).values()];
  const context = [groupOptions.find(([id]) => id === group)?.[1], search && `Busca: ${search}`, species === null ? "Todas as espécies" : `${species.length} espécies selecionadas`].filter(Boolean).join(" · ");
  const toggle = (scientific) => setSpecies((current) => {
    const selected = current === null ? choices.map((row) => row.cells[0]) : current;
    return selected.includes(scientific) ? selected.filter((name) => name !== scientific) : [...selected, scientific];
  });
  return <>
    <div className="heading"><div><span className="eyebrow">COMPARATIVO FÍSICO-MECÂNICO</span><h1>{sourceById.wood.title}</h1><p>{sourceById.wood.description}</p></div></div>
    {dataset ? <SourceStatus dataset={dataset} /> : <div className="notice empty-import"><div><strong>Nenhuma planilha importada</strong><p>Importe o banco de propriedades das madeiras para preencher este dashboard.</p></div><button onClick={onInsert}><Upload size={16} />Ir para Inserir dados</button></div>}
    <div className="filters panel"><div className="filter-title"><Search size={17} /><strong>Filtros do comparativo</strong><button className="text-button" onClick={() => { setGroup(""); setSearch(""); setSpecies(null); }}>Limpar filtros do comparativo</button></div>
      <div className="filter-fields"><Select label="Grupo de madeiras" value={group} onChange={setGroup} options={groupOptions} /><label className="search-field">Buscar madeiras<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome popular, científico, fonte ou observação…" /></label></div>
      <details className="wood-species-picker"><summary>Selecionar espécies ({species === null ? choices.length : species.length} de {choices.length})</summary>
        <div className="actions"><button onClick={() => setSpecies(null)}>Selecionar todas</button><button onClick={() => setSpecies([])}>Desmarcar todas</button></div>
        <fieldset><legend>Espécies do comparativo</legend>{choices.map((row) => <label key={row.cells[0]}><input type="checkbox" checked={species === null || species.includes(row.cells[0])} onChange={() => toggle(row.cells[0])} /><span>{row.cells[1] || row.cells[0]}<small>{row.cells[0]}</small></span></label>)}</fieldset>
      </details>
    </div>
    <div className="period">{context}</div>
    <div className="kpis">{[["Registros no comparativo", rows.length, "registros no filtro"], ["Com as quatro propriedades", rows.filter((row) => WOOD_METRICS.every((metric) => woodValue(row, metric) !== null)).length, "valores informados nas quatro colunas"], ["Eucaliptos", rows.filter((row) => woodGroup(row) === "eucalyptus").length, "Eucalyptus e Corymbia"], ["Com ressalva de umidade", rows.filter((row) => WOOD_METRICS.some((metric) => woodCaveat(row, metric))).length, "conforme a condição informada no Excel"]].map(([label, value, detail], i) => <article className={`kpi kpi-${i}`} key={label}><div>{label}</div><strong>{fmt(value, 0)}</strong><small>{detail}</small></article>)}</div>
    <p className="footnote wood-comparison-note">Os quatro gráficos usam os cabeçalhos verdes da planilha. Os rótulos das barras são arredondados; o detalhamento mantém a precisão. Madeira seca e madeira verde são condições de umidade: as ressalvas de cada linha ficam sinalizadas nos gráficos de MOE e Janka.</p>
    <div className="charts-grid wood-charts">{WOOD_METRICS.map((metric) => <PropertyChart key={metric.id} metric={metric} rows={rows} allRows={records} dark={dark} context={context} />)}</div>
    <article className="panel supplement-table wood-table"><div className="table-title"><h3>Consulta das propriedades e fontes</h3><span>{rows.length} registros</span></div>
      <div className="table-wrap"><table><thead><tr><th>Nome popular</th><th>Nome científico</th>{WOOD_METRICS.map((metric) => <th key={metric.id}>{metric.title} ({metric.unit})</th>)}<th>Condição, fonte e observações</th></tr></thead>
        <tbody>{rows.map((row) => <tr key={row.id}><td>{row.cells[1] || "—"}</td><td><i>{row.cells[0]}</i></td>{WOOD_METRICS.map((metric) => <td key={metric.id}>{woodValue(row, metric) === null ? (String(row.cells[metric.column] || "Sem dado")) : fmt(woodValue(row, metric), 4)}{woodCaveat(row, metric) && <span className="wood-caveat-mark" title={woodCaveat(row, metric)}> *</span>}</td>)}
          <td><details><summary>Consultar dados de {row.cells[0]}</summary><dl><dt>Condição de umidade usada</dt><dd>{row.cells[14] || "Não informada"}</dd><dt>Fonte</dt><dd>{row.cells[12] || "Não informada"}</dd><dt>Observações</dt><dd>{row.cells[13] || "Não informadas"}</dd></dl>
            <dl>{sourceById.wood.headers.map((header, i) => i >= 2 && i <= 11 && !WOOD_METRICS.some((metric) => metric.column === i) ? <React.Fragment key={i}><dt>{header}</dt><dd>{typeof row.cells[i] === "number" ? fmt(row.cells[i], 4) : row.cells[i] || "Sem dado"}</dd></React.Fragment> : null)}</dl>
          </details></td></tr>)}</tbody>
      </table></div>{!rows.length && <p className="empty">Nenhuma madeira encontrada para os filtros selecionados.</p>}
    </article>
    {dataset?.notes.length > 0 && <details className="panel source-notes"><summary>Fontes e notas da planilha</summary><dl>{dataset.notes.map(([item, description], i) => <div key={i}><dt>{item}</dt><dd>{description}</dd></div>)}</dl></details>}
  </>;
}
