import React, { useRef } from "react";
import { Upload, Trash2, ChevronRight } from "lucide-react";
import { SOURCES } from "./sources.mjs";

export function SourceStatus({ dataset }) {
  if (!dataset) return null;
  return <div className="notice import-status">
    <strong>Planilha: {dataset.fileName}</strong>
    <span>{dataset.records.length} registros · Importada em {new Date(dataset.importedAt).toLocaleString("pt-BR")}</span>
    <span>Dados salvos somente neste navegador. Uma nova importação substitui apenas esta planilha.</span>
    {dataset.warnings.length > 0 && <details><summary>Conferir avisos da planilha ({dataset.warnings.length})</summary>
      <ul>{dataset.warnings.map((warning, i) => <li key={i}>{warning}</li>)}</ul>
    </details>}
  </div>;
}

function ImportCard({ source, dataset, busySource, onImport, onClear, onNavigate }) {
  const input = useRef();
  const busy = busySource === source.id;
  return <article className="panel import-card" aria-labelledby={`source-${source.id}`}>
    <div className="import-card-title"><Upload size={23} /><h2 id={`source-${source.id}`}>{source.title}</h2></div>
    <p>{source.description}</p>
    <p className="import-file-pattern">{source.id === "operations" ? "Planilha completa de controle de dormentes (.xlsx)." : source.id === "weekly" ? "Planilha .xlsx com a aba “Recebimento Semanal”. Aceita Início e Fim; as colunas são reconhecidas pelo nome." : "Planilha .xlsx com a aba “Espécies” (quatro ou oito colunas) e/ou “Especies.Completo”. As informações são reunidas pelo nome científico."}</p>
    <label className="sr-only" htmlFor={`file-${source.id}`}>{source.title}</label>
    <input id={`file-${source.id}`} ref={input} type="file" accept=".xlsx" hidden disabled={Boolean(busySource)}
      onChange={(event) => onImport(event, source.id)} />
    {dataset ? <SourceStatus dataset={dataset} /> : <p className="import-card-empty">Nenhuma planilha inserida neste campo.</p>}
    <div className="actions">
      <button className="primary" onClick={() => input.current?.click()} disabled={Boolean(busySource)}>
        <Upload size={16} />{busy ? "Importando…" : "Importar planilha Excel"}
      </button>
      <button onClick={() => onClear(source.id)} disabled={!dataset || Boolean(busySource)} aria-label={`Limpar dados de ${source.title}`}><Trash2 size={16} />Limpar dados locais</button>
      <button onClick={() => onNavigate(source.page)}><ChevronRight size={16} />Abrir dashboard</button>
    </div>
  </article>;
}

export function ImportPage({ datasets, busySource, onImport, onClear, onNavigate }) {
  return <>
    <div className="heading"><div><span className="eyebrow">PLANILHAS DA OPERAÇÃO</span><h1>Inserir dados</h1>
      <p>Insira a versão mais recente de cada planilha no campo correspondente.</p></div></div>
    <p className="notice">Cada campo mantém uma base independente neste navegador. Importar ou limpar uma planilha preserva as outras duas. Os arquivos são lidos no seu dispositivo.</p>
    <div className="import-grid">{SOURCES.map((source) => <ImportCard key={source.id} source={source} dataset={datasets[source.id]} busySource={busySource} onImport={onImport} onClear={onClear} onNavigate={onNavigate} />)}</div>
  </>;
}
