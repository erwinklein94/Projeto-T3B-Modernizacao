import React, { useMemo, useState } from "react";
import { Upload, Search } from "lucide-react";
import { Chart, bar } from "./charts";
import { dateText, fmt, num } from "./domain.mjs";
import { sourceById } from "./sources.mjs";
import { summarizeWeekly, summarizeTaxonomy } from "./supplement-domain.mjs";
import { SourceStatus } from "./import-page";

function Heading({ source }) {
  return <div className="heading"><div><span className="eyebrow">DASHBOARD</span><h1>{source.title}</h1><p>{source.description}</p></div></div>;
}
function Empty({ onInsert }) {
  return <div className="notice empty-import"><div><strong>Nenhuma planilha importada</strong><p>Insira a planilha correspondente em Inserir dados para preencher este dashboard.</p></div>
    <button onClick={onInsert}><Upload size={16} />Ir para Inserir dados</button></div>;
}
function Metrics({ items }) {
  return <div className={`kpis${items.length === 3 ? " kpis-three" : ""}`}>{items.map(([label, value, detail], i) => <article className={`kpi kpi-${i}`} key={label}><div>{label}</div><strong>{fmt(value)}</strong><small>{detail}</small></article>)}</div>;
}
function Select({ label, value, onChange, options, all = "Todos" }) {
  return <label>{label}<select aria-label={label} value={value} onChange={(e) => onChange(e.target.value)}><option value="">{all}</option>{options.map((option) => <option key={option}>{option}</option>)}</select></label>;
}
const weeklyNote = "Quantidades por fornecedor da planilha semanal. Os totais são calculados pelas colunas de fornecedores; linhas TOTAL, TOTAL GERAL e notas não são somadas novamente.";
const taxonomyNote = "Contagem de registros do catálogo importado. Nomes, famílias, gêneros e observações são apresentados conforme a planilha.";
function SourceNotes({ notes }) {
  return notes?.length > 0 && <details className="panel source-notes"><summary>Fontes e notas da planilha</summary><dl>{notes.map(([item, description], i) => <div key={i}><dt>{item}</dt><dd>{description}</dd></div>)}</dl></details>;
}

export function WeeklyDashboard({ dataset, dark, onInsert }) {
  const [week, setWeek] = useState(""), [supplier, setSupplier] = useState("");
  const source = sourceById.weekly;
  const summary = useMemo(() => summarizeWeekly(dataset, { week, supplier }), [dataset, week, supplier]);
  const hasStart = Boolean(dataset?.records.some((r) => r.weekStart !== undefined));
  const hasEnd = Boolean(dataset?.records.some((r) => r.weekEnd !== undefined));
  const periodColumns = Number(hasStart) + Number(hasEnd);
  const context = [week || "Todas as semanas", supplier || "Todos os fornecedores"].join(" · ");
  return <>
    <Heading source={source} />
    {!dataset ? <Empty onInsert={onInsert} /> : <SourceStatus dataset={dataset} />}
    <div className="filters panel"><div className="filter-title"><Search size={17} /><strong>Filtros</strong><button className="text-button" onClick={() => { setWeek(""); setSupplier(""); }}>Limpar</button></div>
      <div className="filter-fields">
        <Select label="Semana" value={week} onChange={setWeek} all="Todas" options={[...new Set((dataset?.records || []).map((r) => r.cells[0]))]} />
        <Select label="Fornecedor" value={supplier} onChange={setSupplier} options={source.headers.slice(1, 5)} />
      </div>
    </div>
    <div className="period">{context}</div>
    <Metrics items={[["Recebidos no período", summary.total, "unidades · controle semanal"], ["Semanas", summary.rows.length, "semanas no filtro"], ["Fornecedores com recebimento", summary.totals.filter((p) => p.value > 0).length, "fornecedores no filtro"]]} />
    <div className="charts-grid">
      <div className="wide"><Chart title="Recebimentos por semana e fornecedor" subtitle="Quantidade semanal por fornecedor · unidades" dark={dark} filterText={context} note={weeklyNote} height={380}
        option={{ ...bar(summary.rows.map((r) => r.cells[0]), summary.providers.map((p) => ({ name: p.name, stack: "semanal", data: summary.rows.map((r) => num(r.cells[p.index])) }))),
          stackTotalLabels: true, yAxis: { type: "value", max: ({ max }) => max > 0 ? max * 1.15 : 1, splitLine: { lineStyle: { color: "#bdccd433" } } },
          dataZoom: summary.rows.length > 12 ? [{ type: "slider", bottom: 0, start: 0, end: 12 / summary.rows.length * 100 }] : [], grid: { left: 65, right: 25, top: 45, bottom: 115 } }} /></div>
      <Chart title="Total por fornecedor" subtitle="Soma das semanas selecionadas · unidades" dark={dark} filterText={context} note={weeklyNote}
        option={bar(summary.totals.map((p) => p.name), [{ name: "Recebidos", data: summary.totals.map((p) => p.value) }])} />
      <Chart title="Participação por fornecedor" subtitle="Distribuição dos recebimentos no filtro" dark={dark} filterText={context} note={weeklyNote}
        option={{ tooltip: { trigger: "item" }, legend: { bottom: 0, type: "scroll" }, series: [{ type: "pie", radius: ["40%", "65%"], center: ["50%", "43%"], data: summary.totals.filter((p) => p.value > 0) }] }} />
    </div>
    <article className="panel supplement-table"><div className="table-title"><h3>Consulta semanal</h3><span>{summary.rows.length} semanas</span></div>
      <div className="table-wrap"><table><thead><tr><th>Semana</th>{hasStart && <th>Início</th>}{hasEnd && <th>Fim</th>}{summary.providers.map((p) => <th key={p.name}>{p.name}</th>)}<th>Total selecionado</th></tr></thead>
        <tbody>{summary.rows.map((row, i) => <tr key={row.id}><td>{row.cells[0]}</td>{hasStart && <td>{dateText(row.weekStart)}</td>}{hasEnd && <td>{dateText(row.weekEnd)}</td>}{summary.providers.map((p) => <td key={p.name}>{row.cells[p.index] === null ? "—" : fmt(row.cells[p.index])}</td>)}<td>{fmt(summary.byWeek[i].total)}</td></tr>)}</tbody>
        {summary.rows.length > 0 && <tfoot><tr><th colSpan={1 + periodColumns}>Total</th>{summary.totals.map((p) => <th key={p.name}>{fmt(p.value)}</th>)}<th>{fmt(summary.total)}</th></tr></tfoot>}
      </table></div>{!summary.rows.length && <p className="empty">Nenhuma semana encontrada.</p>}
    </article><SourceNotes notes={dataset?.notes} /><p className="footnote">{weeklyNote} Este controle é independente do dashboard operacional de estoque.</p>
  </>;
}

export function TaxonomyDashboard({ dataset, dark, onInsert }) {
  const [family, setFamily] = useState(""), [genus, setGenus] = useState(""), [search, setSearch] = useState("");
  const source = sourceById.taxonomy;
  const summary = useMemo(() => summarizeTaxonomy(dataset, { family, genus, search }), [dataset, family, genus, search]);
  const options = (column) => [...new Set((dataset?.records || []).map((r) => r.cells[column]).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
  const context = [family, genus, search].filter(Boolean).join(" · ") || "Todo o catálogo";
  const horizontal = (values) => ({ grid: { left: 165, right: 45, top: 20, bottom: 30 }, xAxis: { type: "value", minInterval: 1 }, yAxis: { type: "category", inverse: true, data: values.map((v) => v.name), axisLabel: { width: 145, overflow: "truncate" } }, series: [{ name: "Registros", type: "bar", data: values.map((v) => v.value), label: { show: true, position: "right" } }] });
  return <>
    <Heading source={source} />
    {!dataset ? <Empty onInsert={onInsert} /> : <SourceStatus dataset={dataset} />}
    <div className="filters panel"><div className="filter-title"><Search size={17} /><strong>Filtros</strong><button className="text-button" onClick={() => { setFamily(""); setGenus(""); setSearch(""); }}>Limpar</button></div>
      <div className="filter-fields"><Select label="Família" value={family} onChange={setFamily} options={options(2)} all="Todas" /><Select label="Gênero" value={genus} onChange={setGenus} options={options(3)} />
        <label className="search-field">Buscar no catálogo<input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Nome científico, popular, região ou observação…" /></label>
      </div>
    </div><div className="period">{context}</div>
    <Metrics items={[["Registros de espécies", summary.rows.length, "entradas do catálogo no filtro"], ["Famílias", summary.familyCount, "famílias informadas"], ["Gêneros", summary.genusCount, "gêneros informados"], ["Com observações", summary.annotated, "registros com observações"]]} />
    <div className="charts-grid">
      <Chart title="Registros por família" subtitle="Distribuição das entradas do catálogo" dark={dark} filterText={context} unit="registros" note={taxonomyNote} height={Math.max(300, summary.families.length * 30 + 60)} option={horizontal(summary.families)} />
      <Chart title="Registros por gênero" subtitle="Gêneros conforme o cadastro importado" dark={dark} filterText={context} unit="registros" note={taxonomyNote} height={Math.max(300, summary.genera.length * 30 + 60)} option={horizontal(summary.genera)} />
    </div>
    <article className="panel supplement-table taxonomy-table"><div className="table-title"><h3>Consulta do catálogo</h3><span>{summary.rows.length} registros</span></div>
      <div className="table-wrap"><table><thead><tr>{source.headers.map((h) => <th key={h}>{h}</th>)}</tr></thead><tbody>{summary.rows.map((row) => <tr key={row.id}>{row.cells.map((cell, i) => <td key={i}>{cell ?? "—"}</td>)}</tr>)}</tbody></table></div>
      {!summary.rows.length && <p className="empty">Nenhuma espécie encontrada.</p>}
    </article>
    <SourceNotes notes={dataset?.notes} />
    <p className="footnote">{taxonomyNote}</p>
  </>;
}
