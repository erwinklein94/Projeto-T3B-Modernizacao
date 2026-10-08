import React, { useEffect, useMemo, useState } from "react";
import { createRoot } from "react-dom/client";
import {
  LayoutDashboard,
  Rows3,
  ShieldCheck,
  Users,
  LogOut,
  Sun,
  Moon,
  Maximize,
  Minimize,
  Download,
  Plus,
  Search,
  ArrowDownToLine,
  ArrowUpFromLine,
  Package,
  AlertTriangle,
  TrainFront,
  ChevronRight,
  RefreshCw,
  Pencil,
  Trash2,
  X,
  LoaderCircle,
} from "lucide-react";
import definitions from "./definitions.json";
import {
  sb,
  configured,
  loadRecords,
  loadDashboard,
  audit,
  saveRecord,
  deleteRecord,
  loadAudit,
} from "./api";
import {
  emptyFilters,
  fields,
  fmt,
  dateText,
  validDate,
  norm,
  num,
  matches,
  supplierIndex,
  supplierOf,
  summarize,
  recalculate,
  filterDescription,
} from "./domain.mjs";
import { DashboardCharts } from "./charts";
import { exportExcel, exportPDF } from "./exports";
import "./style.css";
const preview =
  import.meta.env.DEV && new URLSearchParams(location.search).has("preview");
const roles = {
  editor: "Editor",
  coordenador: "Coordenador",
  analista: "Analista",
  consulta: "Consulta",
};
const labels = {
  dashboard: "Dashboard",
  records: "Registros",
  audit: "Auditoria",
  users: "Contas de acesso",
};
const defById = Object.fromEntries(definitions.map((d) => [d.id, d]));
const typeNumbers = {
  recebimentos: [9, 10, 11, 17],
  movimentacoes: [6, 7, 8, 9],
  danificados: [9, 10, 15, 16],
  devolucoes: [10, 11, 15, 16],
  conciliacao: [3, 4, 5, 6, 7, 8, 9, 13, 14, 15],
  consumo: [5, 6, 8, 9],
  transferencias: [6, 7, 9, 10, 11, 12, 17],
  semanal: [1, 2, 3, 4, 5],
  apuracoes: [1, 2],
  parametros: [1],
  madeiras: [2, 3, 4, 5, 6, 7, 8, 9],
};
function Button({ children, icon: Icon, ...p }) {
  return (
    <button {...p}>
      {Icon && <Icon size={16} />} {children}
    </button>
  );
}
function Brand() {
  return (
    <div className="brand">
      <span className="wordmark">
        rumo<span>›</span>
      </span>
      <div className="brand-divider" />
      <span>
        T3B
        <br />
        <small>MODERNIZAÇÃO</small>
      </span>
    </div>
  );
}
function Login({ onLogin }) {
  const [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <div className="login">
      <section className="login-story">
        <Brand />
        <div>
          <span className="eyebrow">PÁTIO DE JALES · PROJETO T3B</span>
          <h1>
            Cada dormente.
            <br />
            Um novo avanço.
          </h1>
          <p>
            Recebimentos, estoque e informação
            <br />
            conectados em um só lugar.
          </p>
          <div className="rail-art">
            <TrainFront size={100} />
            <i />
            <i />
            <i />
          </div>
        </div>
        <small>GESTÃO DE DORMENTES DE MADEIRA</small>
      </section>
      <section className="login-form">
        <div className="login-box">
          <span className="badge">PORTAL DE OPERAÇÕES</span>
          <h2>Bem-vindo de volta.</h2>
          <p>Entre com sua conta para continuar.</p>
          <form
            onSubmit={async (e) => {
              e.preventDefault();
              if (!configured) return;
              setBusy(true);
              setError("");
              try {
                const f = new FormData(e.currentTarget);
                const { data, error } = await sb.auth.signInWithPassword({
                  email: f.get("email"),
                  password: f.get("password"),
                });
                if (error) throw error;
                await onLogin(data.session);
              } catch (err) {
                setError(err.message);
              } finally {
                setBusy(false);
              }
            }}
          >
            <label>
              E-mail corporativo
              <input
                name="email"
                type="email"
                placeholder="Seu e-mail corporativo"
                required
                autoComplete="username"
              />
            </label>
            <label>
              Senha
              <input
                name="password"
                type="password"
                placeholder="Sua senha"
                required
                autoComplete="current-password"
              />
            </label>
            {error && (
              <p role="alert" className="error">
                {error}
              </p>
            )}
            {!configured && (
              <p className="notice">
                Conexão em configuração. O acesso será liberado após a ativação
                do banco de dados.
              </p>
            )}
            <Button
              className="primary"
              disabled={busy || !configured}
              icon={busy ? LoaderCircle : ChevronRight}
            >
              {busy ? "Entrando…" : "Entrar no portal"}
            </Button>
          </form>
          <small>Seu acesso é definido pelo Editor do projeto.</small>
        </div>
      </section>
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
function RecordForm({ row, onClose, onSave, records }) {
  const def = defById[row.kind],
    [cells, setCells] = useState([...row.cells]),
    [unit, setUnit] = useState(row.kind === 'recebimentos' && num(row.cells[9]) > 0 && num(row.cells[11]) > 0 ? num(row.cells[11]) / num(row.cells[9]) : 0.1142),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  const derived =
    {
      recebimentos: [11],
      danificados: [16],
      devolucoes: [16],
      transferencias: [11, 12],
      semanal: [5],
    }[row.kind] || [];
  const numeric = typeNumbers[row.kind] || [];
  const dateFields = [
    ...new Set([
      ...def.dates,
      ...({ devolucoes: [2, 3, 18], consumo: [1], transferencias: [1, 14] }[
        row.kind
      ] || []),
    ]),
  ];
  return (
    <div className="modal-backdrop">
      <section
        role="dialog"
        aria-modal="true"
        aria-labelledby="record-title"
        className="modal"
      >
        <header>
          <div>
            <span className="eyebrow">{def.name}</span>
            <h2 id="record-title">
              {row.id ? "Editar registro" : "Novo registro"}
            </h2>
          </div>
          <Button aria-label="Fechar" icon={X} onClick={onClose} />
        </header>
        <form
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            setError("");
            try {
              const c = [...cells];
              const required =
                {
                  recebimentos: [1, 2, 3, 4, 8, 9],
                  movimentacoes: [0, 1, 2, 5],
                  danificados: [1, 2, 9],
                }[row.kind] || [];
              if (
                required.some(
                  (i) => c[i] === null || c[i] === undefined || c[i] === "",
                )
              )
                throw Error("Preencha os campos obrigatórios.");
              if (
                numeric.some(
                  (i) =>
                    typeof c[i] === "number" &&
                    (!Number.isFinite(c[i]) || c[i] < 0) &&
                    !derived.includes(i),
                )
              )
                throw Error("As quantidades e volumes devem ser positivos.");
              await onSave({ ...row, cells: c });
              onClose();
            } catch (err) {
              setError(
                err.message.includes("0 rows")
                  ? "O registro mudou desde que foi aberto. Atualize e tente novamente."
                  : err.message,
              );
            } finally {
              setBusy(false);
            }
          }}
        >
          {row.kind === "recebimentos" && (
            <div className="notice">
              <label>
                Volume unitário interno (m³/dormente)
                <input
                  aria-label="Volume unitário"
                  type="number"
                  step="0.000001"
                  min="0.000001"
                  value={unit}
                  onChange={(e) => {
                    const u = Number(e.target.value);
                    setUnit(u);
                    setCells(recalculate(row.kind, cells, u));
                  }}
                />
              </label>
              Novos recebimentos geram uma entrada no estoque. O histórico
              importado mantém as movimentações originais.
            </div>
          )}
          <div className="form-grid">
            {def.headers.map((header, i) => {
              const isDate = dateFields.includes(i),
                isNum = numeric.includes(i),
                legacy = isDate && cells[i] && !validDate(cells[i]);
              const values = [
                ...new Set(
                  records
                    .filter((r) => r.kind === row.kind)
                    .map((r) => r.cells[i])
                    .filter((v) => typeof v === "string"),
                ),
              ].slice(0, 100);
              return (
                <label key={i}>
                  {header}
                  {derived.includes(i) && <small> calculado</small>}
                  <input
                    aria-label={header}
                    type={
                      legacy
                        ? "text"
                        : isDate
                          ? "date"
                          : isNum
                            ? "number"
                            : "text"
                    }
                    step="any"
                    value={cells[i] ?? ""}
                    readOnly={derived.includes(i)}
                    list={!isDate && !isNum ? `options-${i}` : undefined}
                    onChange={(e) => {
                      const c = [...cells];
                      c[i] =
                        e.target.value === ""
                          ? null
                          : isNum
                            ? Number(e.target.value)
                            : e.target.value;
                      setCells(recalculate(row.kind, c, unit));
                    }}
                  />
                  {legacy && (
                    <small>
                      Data original em texto. Informe AAAA-MM-DD para
                      regularizar.
                    </small>
                  )}
                  {!isDate && !isNum && (
                    <datalist id={`options-${i}`}>
                      {values.map((v) => (
                        <option value={v} key={v} />
                      ))}
                    </datalist>
                  )}
                </label>
              );
            })}
          </div>
          {error && (
            <p className="error" role="alert">
              {error}
            </p>
          )}
          <footer>
            <Button type="button" onClick={onClose}>
              Cancelar
            </Button>
            <Button className="primary" disabled={busy}>
              {busy ? "Salvando…" : "Salvar registro"}
            </Button>
          </footer>
        </form>
      </section>
    </div>
  );
}
function App() {
  const [session, setSession] = useState(null),
    [profile, setProfile] = useState(null),
    [page, setPage] = useState("dashboard"),
    [dark, setDark] = useState(false),
    [records, setRecords] = useState([]),
    [loading, setLoading] = useState(false),
    [message, setMessage] = useState(""),
    [filter, setFilter] = useState({ ...emptyFilters }),
    [regFilter, setRegFilter] = useState({ ...emptyFilters }),
    [kind, setKind] = useState("recebimentos"),
    [edit, setEdit] = useState(null),
    [pagination, setPagination] = useState(0),
    [focusSupplier, setFocusSupplier] = useState(""),
    [logs, setLogs] = useState([]),
    [logSearch, setLogSearch] = useState(""),
    [full, setFull] = useState(false),
    [exporting, setExporting] = useState(false),
    [removing, setRemoving] = useState(null);
  const canWrite = profile && profile.role !== "consulta",
    isEditor = profile?.role === "editor";
  const hydrate = async (s) => {
    if (!s) {
      setSession(null);
      setProfile(null);
      setRecords([]);
      return;
    }
    const { data, error } = await sb
      .from("t3b_profiles")
      .select("*")
      .eq("id", s.user.id)
      .single();
    if (error || !data?.active) {
      await sb.auth.signOut();
      throw Error("Conta sem perfil ativo. Solicite acesso ao Editor.");
    }
    setSession(s);
    setProfile(data);
  };
  const refresh = async () => {
    setLoading(true);
    try {
      if (preview) {
        setRecords(
          await (
            await fetch("/Projeto-T3B-Modernizacao/__preview-data")
          ).json(),
        );
      } else setRecords(canWrite ? await loadRecords() : await loadDashboard());
    } catch (e) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };
  useEffect(() => {
    if (preview) {
      setProfile({ email: "Prévia local", role: "editor", active: true });
      setSession({ user: { id: "preview" } });
      return;
    }
    if (!sb) return;
    sb.auth
      .getSession()
      .then(({ data }) =>
        hydrate(data.session).catch((e) => setMessage(e.message)),
      );
    const { data } = sb.auth.onAuthStateChange((event, s) => {
      if (event === "SIGNED_OUT") {
        setSession(null);
        setProfile(null);
        setRecords([]);
      }
      if (event === "TOKEN_REFRESHED") setSession(s);
    });
    return () => data.subscription.unsubscribe();
  }, []);
  useEffect(() => {
    if (profile) refresh();
  }, [profile]);
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
  const log = async (action, details = {}) => {
    if (!preview) await audit(action, details);
  };
  const navigate = async (p) => {
    if (
      (!isEditor && ["audit", "users"].includes(p)) ||
      (!canWrite && p === "records")
    )
      return;
    setPage(p);
    try {
      await log("page_view", { page: p });
      if (p === "audit" && !preview) setLogs(await loadAudit());
    } catch (e) {
      setMessage(e.message);
    }
  };
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
  if (!session || !profile)
    return (
      <>
        <Login onLogin={hydrate} />
        {message && (
          <div className="toast" role="alert">
            {message}
            <button onClick={() => setMessage("")}>×</button>
          </div>
        )}
      </>
    );
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
          disabled={exporting || loading}
          onClick={() =>
            runExport(async () => {
              await log("export_pdf", { filters: filter });
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
      <HistoricalTables records={records} filters={filter} />
    </>
  );
  return (
    <div className={`app ${full ? "presentation" : ""}`}>
      <aside>
        <Brand />
        <div className="project-label">GESTÃO DE DORMENTES</div>
        <nav>
          {[
            [LayoutDashboard, "dashboard"],
            ...(canWrite ? [[Rows3, "records"]] : []),
            ...(isEditor
              ? [
                  [ShieldCheck, "audit"],
                  [Users, "users"],
                ]
              : []),
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
                    await log("presentation");
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
            <div className="user">
              <span className="avatar">
                {profile.email.slice(0, 2).toUpperCase()}
              </span>
              <div>
                <strong>{profile.email.split("@")[0]}</strong>
                <small>{roles[profile.role]}</small>
              </div>
            </div>
            <Button
              icon={LogOut}
              aria-label="Sair da conta"
              onClick={async () => {
                try {
                  if (!preview) {
                    await log("logout");
                    await sb.auth.signOut();
                  }
                  setSession(null);
                  setRecords([]);
                } catch (e) {
                  setMessage(e.message);
                }
              }}
            />
          </div>
        </header>
        <main>
          {preview && (
            <div className="notice">
              Prévia local com o histórico original. Alterações e criação de
              contas estão desabilitadas.
            </div>
          )}
          {loading && (
            <div role="status" className="notice">
              Carregando dados…
            </div>
          )}
          {page === "dashboard" && dashboard}
          {page === "records" && canWrite && (
            <>
              <div className="heading">
                <div>
                  <span className="eyebrow">CONTROLE OPERACIONAL</span>
                  <h1>Registros</h1>
                  <p>Consulte, inclua e atualize os dados da operação.</p>
                </div>
                <div className="actions">
                  <Button icon={RefreshCw} onClick={refresh} disabled={loading}>
                    Atualizar
                  </Button>
                  <Button
                    icon={Download}
                    disabled={exporting}
                    onClick={() =>
                      runExport(async () => {
                        await log("export_excel", {
                          kind,
                          filters: regFilter,
                          count: rows.length,
                        });
                        await exportExcel(def, rows);
                      })
                    }
                  >
                    Exportar Excel
                  </Button>
                  <Button
                    icon={Plus}
                    className="primary"
                    disabled={preview}
                    onClick={() =>
                      setEdit({
                        kind,
                        cells: Array(def.headers.length).fill(null),
                      })
                    }
                  >
                    Novo registro
                  </Button>
                </div>
              </div>
              <div className="tabs" role="tablist">
                {definitions
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
                        <th>Ações</th>
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
                            <td>
                              <div className="actions">
                                <Button
                                  icon={Pencil}
                                  aria-label="Editar registro"
                                  disabled={preview || Boolean(r.parent_id)}
                                  onClick={() => setEdit(r)}
                                />
                                <Button
                                  icon={Trash2}
                                  aria-label="Excluir registro"
                                  disabled={preview || Boolean(r.parent_id)}
                                  onClick={() => setRemoving(r)}
                                />
                              </div>
                            </td>
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
                    Nenhum registro encontrado. Ajuste os filtros ou adicione um
                    registro.
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
              <p className="footnote">
                Movimentações vinculadas a novos recebimentos são atualizadas
                pelo registro de origem. Exclusões são lógicas e ficam
                registradas na auditoria.
              </p>
            </>
          )}
          {page === "audit" && isEditor && (
            <>
              <div className="heading">
                <div>
                  <span className="eyebrow">ACESSO EXCLUSIVO DO EDITOR</span>
                  <h1>Auditoria</h1>
                  <p>
                    Acessos e ações dos perfis Coordenador, Analista e Consulta.
                  </p>
                </div>
                <Button
                  icon={RefreshCw}
                  onClick={async () => {
                    try {
                      setLogs(await loadAudit());
                    } catch (e) {
                      setMessage(e.message);
                    }
                  }}
                >
                  Atualizar
                </Button>
              </div>
              <label className="audit-search">
                Buscar na auditoria
                <input
                  placeholder="E-mail, perfil, ação ou data…"
                  value={logSearch}
                  onChange={(e) => setLogSearch(e.target.value)}
                />
              </label>
              <div className="panel table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Data e hora</th>
                      <th>Usuário</th>
                      <th>Perfil</th>
                      <th>Ação</th>
                      <th>Detalhes</th>
                    </tr>
                  </thead>
                  <tbody>
                    {logs
                      .filter((l) =>
                        norm(JSON.stringify(l)).includes(norm(logSearch)),
                      )
                      .map((l) => (
                        <tr key={l.id}>
                          <td>
                            {new Date(l.occurred_at).toLocaleString("pt-BR")}
                          </td>
                          <td>{l.email}</td>
                          <td>{roles[l.role]}</td>
                          <td>{l.action}</td>
                          <td>
                            <details>
                              <summary>Ver detalhes</summary>
                              <pre>{JSON.stringify(l.details, null, 2)}</pre>
                            </details>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
                {!logs.length && (
                  <p className="empty">
                    Nenhuma atividade registrada para os demais perfis.
                  </p>
                )}
              </div>
              <p className="footnote">
                Até 10.000 eventos recentes. Alterações são auditadas no banco;
                navegação e exportações são registradas pela aplicação.
              </p>
            </>
          )}
          {page === "users" && isEditor && (
            <Accounts preview={preview} notify={setMessage} />
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
      {edit && (
        <RecordForm
          row={edit}
          records={records}
          onClose={() => setEdit(null)}
          onSave={async (row) => {
            await saveRecord(row);
            await refresh();
            setMessage("Registro salvo com sucesso.");
          }}
        />
      )}
      {removing && (
        <div className="modal-backdrop">
          <section className="modal small" role="dialog" aria-modal="true">
            <h2>Excluir este registro?</h2>
            <p>
              Ele deixará de compor os indicadores. O conteúdo anterior ficará
              preservado na auditoria.
            </p>
            <div className="actions">
              <Button onClick={() => setRemoving(null)}>Cancelar</Button>
              <Button
                className="danger"
                onClick={async () => {
                  try {
                    await deleteRecord(removing);
                    setRemoving(null);
                    await refresh();
                  } catch (e) {
                    setMessage(e.message);
                  }
                }}
              >
                Confirmar exclusão
              </Button>
            </div>
          </section>
        </div>
      )}
    </div>
  );
}
function HistoricalTables({ records, filters }) {
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
function Accounts({ preview, notify }) {
  const [busy, setBusy] = useState(false),
    [users, setUsers] = useState([]);
  const refresh = async () => {
    if (preview) return;
    const { data, error } = await sb
      .from("t3b_profiles")
      .select("*")
      .order("email");
    if (error) notify(error.message);
    else setUsers(data);
  };
  useEffect(() => {
    refresh();
  }, []);
  return (
    <>
      <div className="heading">
        <div>
          <span className="eyebrow">ADMINISTRAÇÃO</span>
          <h1>Contas de acesso</h1>
          <p>Somente o Editor pode criar contas e definir perfis.</p>
        </div>
      </div>
      <div className="accounts-grid">
        <form
          className="panel account-form"
          onSubmit={async (e) => {
            e.preventDefault();
            setBusy(true);
            const form = e.currentTarget,
              f = new FormData(form);
            try {
              const { data, error } = await sb.functions.invoke(
                "t3b-create-user",
                {
                  body: {
                    email: f.get("email"),
                    password: f.get("password"),
                    role: f.get("role"),
                  },
                },
              );
              if (error || data?.error)
                throw Error(data?.error || error.message);
              notify("Conta criada com sucesso.");
              form.reset();
              await refresh();
            } catch (err) {
              notify(err.message);
            } finally {
              setBusy(false);
            }
          }}
        >
          <h3>Nova conta</h3>
          <label>
            E-mail
            <input name="email" type="email" required />
          </label>
          <label>
            Senha inicial
            <input
              name="password"
              type="password"
              minLength={8}
              required
              autoComplete="new-password"
            />
          </label>
          <label>
            Perfil
            <select name="role">
              {Object.entries(roles).map(([v, l]) => (
                <option value={v} key={v}>
                  {l}
                </option>
              ))}
            </select>
          </label>
          <Button className="primary" disabled={busy || preview} icon={Plus}>
            {busy ? "Criando…" : "Criar conta"}
          </Button>
          <p className="footnote">
            Consulta vê apenas o dashboard. Editor, Coordenador e Analista podem
            gerenciar registros. Contas e auditoria são exclusivas do Editor.
          </p>
        </form>
        <div className="panel table-wrap">
          <table>
            <thead>
              <tr>
                <th>E-mail</th>
                <th>Perfil</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {users.map((u) => (
                <tr key={u.id}>
                  <td>{u.email}</td>
                  <td>{roles[u.role]}</td>
                  <td>{u.active ? "Ativo" : "Inativo"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}
createRoot(document.getElementById("root")).render(<App />);
