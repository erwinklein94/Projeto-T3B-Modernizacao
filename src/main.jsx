import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  ShieldCheck,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Download,
  Upload,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  TrainFront,
  ChevronRight,
  CalendarRange,
  Leaf,
  FlaskConical,
  Menu,
} from "lucide-react";
import definitions from "./definitions.json";
import { readDataset, saveDataset, clearDataset, storageKey } from "./storage.mjs";
import { importExcelFile } from "./import-excel.js";
import { SOURCES, sourceById } from "./sources.mjs";
import { ImportPage, SourceStatus } from "./import-page";
import { WeeklyDashboard, TaxonomyDashboard } from "./supplement-dashboards";
import { WoodDashboard } from "./wood-dashboard";
import { DamagePanel } from "./damage-panel";
import { damageSnapshots } from "./damage-snapshots.mjs";
import {
  emptyFilters,
  fields,
  fmt,
  fmtQuantity,
  dateText,
  norm,
  matches,
  supplierIndex,
  supplierOf,
  summarize,
  filterDescription,
} from "./domain.mjs";
import { DashboardCharts, ReceiptSpecies } from "./charts";
import { speciesNames } from "./species-reference.mjs";
import { exportExcel, exportPDF } from "./exports";
import "./style.css";
const labels = { dashboard: sourceById.operations.title, insert: "Inserir dados", weekly: sourceById.weekly.title, taxonomy: sourceById.taxonomy.title, wood: sourceById.wood.title };
function Button({ children, icon: Icon, ...p }) {
  return (
    <button {...p}>
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Brand() {
  return (
    <div className="brand" aria-label="Projeto T3B Modernização">
      <span>
        Projeto T3B
        <br />
        <small>MODERNIZAÇÃO</small>
      </span>
    </div>
  );
}
function Filters({ value: f, onChange, records, kind, dashboard = false }) {
  const idx = useMemo(() => supplierIndex(records), [records]);
  const options = (key) => {
    const values = records
      .filter((r) => !kind || r.kind === kind)
      .map((r) =>
        key === "supplier"
          ? supplierOf(r, idx)
          : r.cells[fields[r.kind]?.[key]],
      )
      .filter(Boolean);
    return [...new Set(values.map((v) => String(v).trim()))].sort((a, b) =>
      a.localeCompare(b, "pt-BR"),
    );
  };
  const set = (k, v) => onChange({ ...f, [k]: v });
  return (
    <div className="filters panel" role="region" aria-label={dashboard ? "Filtros do dashboard" : "Filtros dos registros"}>
      <div className="filter-title">
        <Search size={17} />
        <strong>{dashboard ? "Filtros do dashboard" : "Filtros dos registros"}</strong>
        <button
          className="text-button"
          onClick={() => onChange({ ...emptyFilters })}
        >
          Limpar
        </button>
      </div>
      <div className="filter-fields">
        <label>
          Data inicial
          <input
            type="date"
            value={f.start}
            onChange={(e) => set("start", e.target.value)}
          />
        </label>
        <label>
          Data final
          <input
            type="date"
            min={f.start}
            value={f.end}
            onChange={(e) => set("end", e.target.value)}
          />
        </label>
        {["supplier", "species", "yard", ...(!dashboard ? ["status"] : [])].map(
          (key) => (
            <label key={key}>
              {
                {
                  supplier: "Fornecedor",
                  species: "Espécie",
                  yard: "Pátio",
                  status: "Status",
                }[key]
              }
              <select aria-label={{ supplier: "Fornecedor", species: "Espécie", yard: "Pátio", status: "Status" }[key]} value={f[key]} onChange={(e) => set(key, e.target.value)}>
                <option value="">Todos</option>
                {options(key).map((v) => (
                  <option key={v}>{v}</option>
                ))}
              </select>
            </label>
          ),
        )}
        {!dashboard && (
          <label className="search-field">
            Busca livre
            <input
              placeholder="NF, lote, DOF, responsável…"
              value={f.search}
              onChange={(e) => set("search", e.target.value)}
            />
          </label>
        )}
      </div>
      {f.start && f.end && f.start > f.end && (
        <p className="error">A data final deve ser posterior à inicial.</p>
      )}
    </div>
  );
}
function App() {
  const [initial] = useState(() => {
    const datasets = {}, errors = [];
    for (const source of SOURCES) {
      try { datasets[source.id] = readDataset(undefined, source.id); }
      catch (error) { datasets[source.id] = null; errors.push(`${source.title}: ${error.message}`); }
    }
    return { datasets, error: errors.join(" ") };
  });
  const [datasets, setDatasets] = useState(initial.datasets),
    [page, setPage] = useState("dashboard"),
    [dark, setDark] = useState(false),
    [busySource, setBusySource] = useState(""),
    [message, setMessage] = useState(initial.error),
    [filter, setFilter] = useState({ ...emptyFilters }),
    [regFilter, setRegFilter] = useState({ ...emptyFilters }),
    [kind, setKind] = useState("recebimentos"),
    [pagination, setPagination] = useState(0),
    [focusSupplier, setFocusSupplier] = useState(""),
    [full, setFull] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [exporting, setExporting] = useState(false),
    [removing, setRemoving] = useState("");
  const dataset = datasets.operations;
  const loading = Boolean(busySource);
  const records = dataset?.records || [];
  const currentDefinitions = dataset?.definitions || definitions;
  const defById = Object.fromEntries(currentDefinitions.map((d) => [d.id, d]));
  const applyDataset = (source, data) => {
    setDatasets((current) => ({ ...current, [source]: data }));
    if (source !== "operations") return;
    setFilter({ ...emptyFilters });
    setRegFilter({ ...emptyFilters });
    setPagination(0);
    setFocusSupplier("");
  };
  const importFile = async (event, source) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setBusySource(source);
    setMessage("");
    try {
      const data = await importExcelFile(file, source);
      saveDataset(data, undefined, source);
      applyDataset(source, data);
      setMessage(`Planilha importada: ${data.records.length} registros. Os dados anteriores deste campo foram substituídos.`);
    } catch (error) {
      setMessage(error.message);
    } finally { setBusySource(""); }
  };
  useEffect(() => {
    const sync = (event) => {
      for (const source of SOURCES) {
        if (event.key !== storageKey(source.id) && event.key !== null) continue;
        try { applyDataset(source.id, readDataset(undefined, source.id)); }
        catch (error) { applyDataset(source.id, null); setMessage(`${source.title}: ${error.message}`); }
      }
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);
  useEffect(() => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
  }, [dark]);
  useEffect(() => {
    const fn = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", fn);
    return () => document.removeEventListener("fullscreenchange", fn);
  }, []);
  useEffect(() => {
    setPagination(0);
  }, [kind, regFilter]);
  const navigate = (p) => setPage(p);
  const summary = useMemo(() => summarize(records, filter), [records, filter]);
  const names = useMemo(() => speciesNames(records, datasets.taxonomy?.records), [records, datasets.taxonomy]);
  const idx = useMemo(() => supplierIndex(records), [records]);
  const rows = useMemo(
    () => records.filter((r) => r.kind === kind && matches(r, regFilter, idx)),
    [records, kind, regFilter, idx],
  );
  const def = defById[kind];
  const runExport = async (task) => {
    setExporting(true);
    try {
      await task();
    } catch (e) {
      setMessage(e.message);
    } finally {
      setExporting(false);
    }
  };
  const recordsSection = (
    <section id="registros" className="records-section" aria-labelledby="records-title">
      <div className="heading">
        <div>
          <span className="eyebrow">CONTROLE OPERACIONAL</span>
          <h2 id="records-title">Registros</h2>
          <p>Consulte os dados desta planilha. Os filtros dos registros são independentes dos filtros dos gráficos.</p>
        </div>
        <div className="actions">
          <Button icon={Download} disabled={exporting || loading || !rows.length}
            onClick={() => runExport(() => exportExcel(def, rows))}>Exportar Excel</Button>
        </div>
      </div>
      <div className="tabs" role="tablist">
        {currentDefinitions
          .filter((d) => d.id !== "parametros")
          .map((d) => (
            <button
              role="tab"
              aria-selected={kind === d.id}
              className={kind === d.id ? "selected" : ""}
              onClick={() => {
                setKind(d.id);
                setRegFilter({ ...emptyFilters });
              }}
              key={d.id}
            >
              {d.name}
            </button>
          ))}
        <button
          onClick={() => {
            setKind("parametros");
            setRegFilter({ ...emptyFilters });
          }}
          className={kind === "parametros" ? "selected" : ""}
        >
          Parâmetros
        </button>
      </div>
      <Filters
        value={regFilter}
        onChange={setRegFilter}
        records={records}
        kind={kind}
      />
      <article className="panel">
        <div className="table-title">
          <h3>{def.name}</h3>
          <span>
            {rows.length} registros · colunas na ordem do Excel original
          </span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                {def.headers.map((h, i) => (
                  <th key={i}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {rows
                .slice(pagination * 30, (pagination + 1) * 30)
                .map((r) => (
                  <tr key={r.id || r.source_key}>
                    {r.cells.map((v, i) => (
                      <td key={i} title={String(v ?? "")}>
                        {def.dates.includes(i)
                          ? dateText(v)
                          : typeof v === "number"
                            ? fmt(v, 6)
                            : (v ?? "—")}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!rows.length && (
          <p className="empty">
            Nenhum registro encontrado. Importe uma planilha ou ajuste os filtros.
          </p>
        )}
        <div className="pagination">
          <span>
            Página {pagination + 1} de{" "}
            {Math.max(1, Math.ceil(rows.length / 30))}
          </span>
          <Button
            disabled={!pagination}
            onClick={() => setPagination(pagination - 1)}
          >
            Anterior
          </Button>
          <Button
            disabled={(pagination + 1) * 30 >= rows.length}
            onClick={() => setPagination(pagination + 1)}
          >
            Próxima
          </Button>
        </div>
      </article>
      <p className="footnote">Consulta dos valores salvos no Excel, sem edição de registros no site. O saldo é calculado pelas movimentações, sem somar novamente os recebimentos.</p>
    </section>
  );
  const dashboard = (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">OPERAÇÃO EM NÚMEROS</span>
          <h1>{sourceById.operations.title}</h1>
          <p>Acompanhe os recebimentos e o estoque de dormentes.</p>
        </div>
        <Button
          icon={Download}
          disabled={exporting || loading || !dataset}
          onClick={() =>
            runExport(async () => {
              await exportPDF(summary, filter, names, damageSnapshots(records, defById.apuracoes, filter));
            })
          }
        >
          {exporting ? "Gerando PDF…" : "Exportar PDF"}
        </Button>
      </div>
      <Filters
        value={filter}
        onChange={setFilter}
        records={records}
        dashboard
      />
      <div className="period">
        <span className="status-dot" /> {filterDescription(filter)}
        <span>{summary.receipts.length} recebimentos</span>
      </div>
      <div className="kpis operation-kpis">
        {[
          [
            "Entradas",
            summary.cardIncoming,
            "unidades · sem refugo ou danificados",
            ArrowDownToLine,
          ],
          [
            "Saídas",
            summary.cardOutgoing,
            "unidades · sem refugo ou danificados",
            ArrowUpFromLine,
          ],
        ].map(([label, value, caption, Icon], i) => (
          <article className={`kpi kpi-${i}`} key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{fmtQuantity(value)}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      <ReceiptSpecies summary={summary} names={names} dark={dark} filterText={filterDescription(filter)} />
      <div className="section-heading">
        <div>
          <h2>Panorama da operação</h2>
          <p>Informação para acompanhar cada etapa.</p>
        </div>
      </div>
      <DashboardCharts
        summary={summary}
        filterText={filterDescription(filter)}
        dark={dark}
        focusSupplier={focusSupplier}
        onFocusSupplier={setFocusSupplier}
      />
      <div className="lower-grid damage-section">
        <DamagePanel records={records} definition={defById.apuracoes} filters={filter} summary={summary} />
        <article className="panel">
          <div className="panel-heading">
            <h3>Conferência do histórico</h3>
            <p>Rastreabilidade dos dados importados</p>
          </div>
          <div className="quality">
            <span className="quality-icon">
              <ShieldCheck />
            </span>
            <div>
              <strong>Valores originais preservados</strong>
              <p>
                Quantidades fracionadas e datas em texto foram mantidas para
                conferência do analista.
              </p>
            </div>
          </div>
          <p className="notice">
            {summary.unknownDates} registros sem data válida no histórico. Ao
            filtrar um período, eles ficam fora dos indicadores. O saldo
            filtrado representa a movimentação do período, não o estoque
            acumulado anterior.
          </p>
        </article>
      </div>
      <HistoricalTables records={records} filters={filter} defById={defById} />
      {recordsSection}
    </>
  );
  return (
    <div className={`app ${full ? "presentation" : ""} ${sidebarOpen ? "" : "sidebar-closed"}`}>
      <aside id="main-sidebar">
        <Brand />
        <div className="project-label">GESTÃO DE DORMENTES</div>
        <nav>
          {[
            [LayoutDashboard, "dashboard"],
            [CalendarRange, "weekly"],
            [Leaf, "taxonomy"],
            [FlaskConical, "wood"],
            [Upload, "insert"],
          ].map(([Icon, p]) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => navigate(p)}
            >
              <Icon size={20} />
              <span>{labels[p]}</span>
              {page === p && <ChevronRight size={16} />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="project-card">
            <TrainFront size={25} />
            <div>
              Projeto T3B<small>Modernização ferroviária</small>
            </div>
          </div>
          <small>Somos o Brasil em movimento.</small>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Button
            className="menu-toggle"
            icon={Menu}
            aria-label={sidebarOpen ? "Fechar menu lateral" : "Abrir menu lateral"}
            aria-controls="main-sidebar"
            aria-expanded={sidebarOpen}
            onClick={() => setSidebarOpen((open) => !open)}
          />
          <div className="breadcrumb">
            Projeto T3B <ChevronRight size={13} />
            <strong>{labels[page]}</strong>
          </div>
          <div className="top-actions">
            <Button
              icon={dark ? Sun : Moon}
              aria-label={dark ? "Ativar tema claro" : "Ativar tema escuro"}
              onClick={() => setDark(!dark)}
            />
            <Button
              icon={full ? Minimize : Maximize}
              onClick={async () => {
                try {
                  if (document.fullscreenElement)
                    await document.exitFullscreen();
                  else {
                    if (!["dashboard", "weekly", "taxonomy", "wood"].includes(page)) setPage("dashboard");
                    await document.documentElement.requestFullscreen();
                  }
                } catch (e) {
                  setMessage(
                    "Não foi possível abrir em tela cheia: " + e.message,
                  );
                }
              }}
            >
              {full ? "Sair da apresentação" : "Apresentar"}
            </Button>
          </div>
        </header>
        <main>
          {!dataset && page === "dashboard" && (
            <div className="notice empty-import">
              <div><strong>Nenhuma planilha importada</strong>
              <p>Importe sua planilha de controle em Inserir dados para preencher os dados e o dashboard. Os dados ficam salvos somente neste navegador.</p></div>
              <Button icon={Upload} onClick={() => navigate("insert")}>Ir para Inserir dados</Button>
            </div>
          )}
          {loading && <div role="status" className="notice">Lendo e validando a planilha… Aguarde a conclusão da importação.</div>}
          {page === "dashboard" && <SourceStatus dataset={dataset} />}
          {page === "insert" && <ImportPage datasets={datasets} busySource={busySource} onImport={importFile} onClear={setRemoving} onNavigate={navigate} />}
          {page === "weekly" && <WeeklyDashboard key={`weekly:${datasets.weekly?.importedAt || "empty"}`} dataset={datasets.weekly} dark={dark} onInsert={() => navigate("insert")} />}
          {page === "taxonomy" && <TaxonomyDashboard key={`taxonomy:${datasets.taxonomy?.importedAt || "empty"}`} dataset={datasets.taxonomy} dark={dark} onInsert={() => navigate("insert")} />}
          {page === "wood" && <WoodDashboard key={`wood:${datasets.wood?.importedAt || "empty"}`} dataset={datasets.wood} dark={dark} onInsert={() => navigate("insert")} />}
          {page === "dashboard" && dashboard}
          <footer className="main-footer">
            <span>RUMO · Projeto T3B Modernização</span>
            <span>Gestão de dormentes de madeira</span>
          </footer>
        </main>
      </div>
      {message && (
        <div className="toast" role="alert">
          {message}
          <button aria-label="Fechar aviso" onClick={() => setMessage("")}>
            ×
          </button>
        </div>
      )}
      {removing && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true" aria-labelledby="clear-title">
            <h2 id="clear-title">Limpar dados deste navegador?</h2>
            <p>
              Os dados de {sourceById[removing].title} serão removidos deste navegador. As outras planilhas serão preservadas. Você poderá importar este arquivo novamente em Inserir dados.
            </p>
            <div className="actions">
              <Button onClick={() => setRemoving("")}>Cancelar</Button>
              <Button
                className="danger"
                onClick={async () => {
                  try {
                    clearDataset(undefined, removing);
                    applyDataset(removing, null);
                    setRemoving("");
                    setMessage("Dados locais removidos.");
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
              >
                Confirmar limpeza
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function HistoricalTables({ records, filters, defById }) {
  const filtered = Boolean(
    filters.start || filters.end || filters.species || filters.yard,
  );
  return (
    <details className="panel history-details">
      <summary>Controle semanal original</summary>
      <p className="footnote">
        Fotografias de apuração preservadas do Excel. Estes quadros são
        referências históricas independentes e não são somados aos indicadores.{" "}
        {filtered &&
          "Filtros de período, espécie e pátio não se aplicam a estes resumos."}
      </p>
      {["semanal"].map((k) => (
        <div key={k}>
          <h3>{defById[k].name}</h3>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  {defById[k].headers.map((h, i) => (
                    <th key={i}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {records
                  .filter(
                    (r) =>
                      r.kind === k &&
                      (!filters.supplier ||
                        k === "semanal" ||
                        norm(r.cells[0]) === norm(filters.supplier)),
                  )
                  .map((r, i) => (
                    <tr key={i}>
                      {r.cells.map((c, j) => (
                        <td key={j}>
                          {typeof c === "number" ? fmtQuantity(c) : String(c ?? "—")}
                        </td>
                      ))}
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}
    </details>
  );
}
createRoot(document.getElementById("root")).render(<App />);
