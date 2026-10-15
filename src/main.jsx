import React, { useEffect, useMemo, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Rows3,
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
  Package,
  AlertTriangle,
  TrainFront,
  ChevronRight,
  Trash2,
  Menu,
} from "lucide-react";
import definitions from "./definitions.json";
import { readDataset, saveDataset, clearDataset, STORAGE_KEY } from "./storage.mjs";
import { importExcelFile } from "./import-excel.js";
import {
  emptyFilters,
  fields,
  fmt,
  dateText,
  norm,
  num,
  matches,
  supplierIndex,
  supplierOf,
  summarize,
  filterDescription,
} from "./domain.mjs";
import { DashboardCharts } from "./charts";
import { exportExcel, exportPDF } from "./exports";
import "./style.css";
const labels = { dashboard: "Dashboard", records: "Registros" };
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
    <div className="filters panel">
      <div className="filter-title">
        <Search size={17} />
        <strong>Filtros</strong>
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
              <select value={f[key]} onChange={(e) => set(key, e.target.value)}>
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
    try { return { data: readDataset(), error: "" }; }
    catch (error) { return { data: null, error: error.message }; }
  });
  const [dataset, setDataset] = useState(initial.data),
    [page, setPage] = useState("dashboard"),
    [dark, setDark] = useState(false),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(initial.error),
    [filter, setFilter] = useState({ ...emptyFilters }),
    [regFilter, setRegFilter] = useState({ ...emptyFilters }),
    [kind, setKind] = useState("recebimentos"),
    [pagination, setPagination] = useState(0),
    [focusSupplier, setFocusSupplier] = useState(""),
    [full, setFull] = useState(false),
    [sidebarOpen, setSidebarOpen] = useState(true),
    [exporting, setExporting] = useState(false),
    [removing, setRemoving] = useState(false);
  const fileInput = useRef(null);
  const records = dataset?.records || [];
  const currentDefinitions = dataset?.definitions || definitions;
  const defById = Object.fromEntries(currentDefinitions.map((d) => [d.id, d]));
  const applyDataset = (data) => {
    setDataset(data);
    setFilter({ ...emptyFilters });
    setRegFilter({ ...emptyFilters });
    setPagination(0);
    setFocusSupplier("");
  };
  const importFile = async (event) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;
    setLoading(true);
    setMessage("");
    try {
      const data = await importExcelFile(file);
      saveDataset(data);
      applyDataset(data);
      setMessage(`Planilha importada: ${data.records.length} registros. Os dados anteriores foram substituídos.`);
    } catch (error) {
      setMessage(error.message);
    } finally { setLoading(false); }
  };
  useEffect(() => {
    const sync = (event) => {
      if (event.key !== STORAGE_KEY && event.key !== null) return;
      try { applyDataset(readDataset()); }
      catch (error) { applyDataset(null); setMessage(error.message); }
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
  const dashboard = (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">OPERAÇÃO EM NÚMEROS</span>
          <h1>Visão geral</h1>
          <p>Acompanhe os recebimentos e o estoque de dormentes.</p>
        </div>
        <Button
          icon={Download}
          disabled={exporting || loading || !dataset}
          onClick={() =>
            runExport(async () => {
              await exportPDF(summary, filter);
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
      <div className="kpis">
        {[
          ["Recebidos", summary.received, "unidades · recebimentos", Package],
          [
            "Entradas",
            summary.incoming,
            "unidades · movimentações",
            ArrowDownToLine,
          ],
          [
            "Saídas",
            summary.outgoing,
            "unidades · movimentações",
            ArrowUpFromLine,
          ],
          [
            "Saldo do período",
            summary.balance,
            `${fmt(summary.volume, 4)} m³ · volume de saldo`,
            Rows3,
          ],
        ].map(([label, value, caption, Icon], i) => (
          <article className={`kpi kpi-${i}`} key={label}>
            <div>
              {label}
              <Icon size={18} />
            </div>
            <strong>{fmt(value, 2)}</strong>
            <small>{caption}</small>
          </article>
        ))}
      </div>
      <div className="section-heading">
        <div>
          <h2>Panorama da operação</h2>
          <p>Informação para acompanhar cada etapa.</p>
        </div>
        <label className="inline-select">
          Detalhar fornecedor
          <select
            value={focusSupplier}
            onChange={(e) => setFocusSupplier(e.target.value)}
          >
            <option value="">Maior recebimento</option>
            {summary.suppliers.map(([s]) => (
              <option key={s}>{s}</option>
            ))}
          </select>
        </label>
      </div>
      <DashboardCharts
        summary={summary}
        filterText={filterDescription(filter)}
        dark={dark}
        focusSupplier={focusSupplier}
      />
      <div className="lower-grid">
        <article className="panel">
          <div className="panel-heading">
            <h3>Danificados e pendências</h3>
            <p>Ocorrências no período selecionado</p>
          </div>
          <div className="damage-total">
            <AlertTriangle size={25} />
            <strong>{fmt(summary.damaged)}</strong>
            <span>unidades pendentes</span>
          </div>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Fornecedor / origem</th>
                  <th>Identificação</th>
                  <th>Quantidade</th>
                  <th>Pendente</th>
                </tr>
              </thead>
              <tbody>
                {summary.damages.map((r, i) => (
                  <tr key={i}>
                    <td>{r.cells[6] || "Não identificado"}</td>
                    <td>{dateText(r.cells[1])}</td>
                    <td>{fmt(r.cells[9])}</td>
                    <td>{fmt(num(r.cells[9]) - num(r.cells[15]))}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {!summary.damages.length && (
            <p className="empty">Nenhuma ocorrência neste filtro.</p>
          )}
        </article>
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
            [Rows3, "records"],
          ].map(([Icon, p]) => (
            <button
              className={page === p ? "active" : ""}
              key={p}
              onClick={() => navigate(p)}
            >
              <Icon size={20} />
              {labels[p]}
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
                    setPage("dashboard");
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
          {!dataset && (
            <div className="notice empty-import">
              <div><strong>Nenhuma planilha importada</strong>
              <p>Importe sua planilha Excel em Registros para preencher os dados e o dashboard. Os dados ficam salvos somente neste navegador.</p></div>
              {page !== "records" && <Button icon={Upload} onClick={() => navigate("records")}>Ir para Registros</Button>}
            </div>
          )}
          {loading && <div role="status" className="notice">Lendo e validando a planilha… Aguarde a conclusão da importação.</div>}
          {dataset && (
            <div className="notice import-status">
              <strong>Planilha: {dataset.fileName}</strong>
              <span>{dataset.records.length} registros · Importada em {new Date(dataset.importedAt).toLocaleString("pt-BR")}</span>
              <span>Dados salvos somente neste navegador. Uma nova importação substitui toda a base local.</span>
              {dataset.warnings.length > 0 && <details><summary>Conferir avisos da planilha ({dataset.warnings.length})</summary>
                <ul>{dataset.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
              </details>}
            </div>
          )}
          {page === "dashboard" && dashboard}
          {page === "records" && (
            <>
              <div className="heading">
                <div>
                  <span className="eyebrow">CONTROLE OPERACIONAL</span>
                  <h1>Registros</h1>
                  <p>Importe a planilha mais atualizada para consultar os dados da operação.</p>
                </div>
                <div className="actions">
                  <input ref={fileInput} type="file" accept=".xlsx" aria-label="Selecionar planilha Excel" hidden onChange={importFile} disabled={loading} />
                  <Button icon={Upload} className="primary" disabled={loading} onClick={() => fileInput.current?.click()}>
                    {loading ? "Importando…" : "Importar planilha Excel"}
                  </Button>
                  <Button icon={Download} disabled={exporting || loading || !rows.length}
                    onClick={() => runExport(() => exportExcel(def, rows))}>Exportar Excel</Button>
                  <Button icon={Trash2} disabled={!dataset || loading} onClick={() => setRemoving(true)}>Limpar dados locais</Button>
                </div>
              </div>
              <p className="import-help">Selecione um arquivo .xlsx no mesmo padrão de abas e colunas. Para atualizar os valores, altere o Excel e importe novamente. O arquivo é lido no seu dispositivo.</p>
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
            </>
          )}
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
              O dashboard e os registros ficarão vazios. Você poderá importar a planilha novamente para restaurar os dados.
            </p>
            <div className="actions">
              <Button onClick={() => setRemoving(false)}>Cancelar</Button>
              <Button
                className="danger"
                onClick={async () => {
                  try {
                    clearDataset();
                    applyDataset(null);
                    setRemoving(false);
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
      <summary>Apurações históricas e controle semanal original</summary>
      <p className="footnote">
        Fotografias de apuração preservadas do Excel. Estes quadros são
        referências históricas independentes e não são somados aos indicadores.{" "}
        {filtered &&
          "Filtros de período, espécie e pátio não se aplicam a estes resumos."}
      </p>
      {["apuracoes", "semanal"].map((k) => (
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
                          {typeof c === "number" ? fmt(c) : String(c ?? "—")}
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
