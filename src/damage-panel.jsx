import React from "react";
import { AlertTriangle } from "lucide-react";
import { dateText, fmtQuantity, num } from "./domain.mjs";
import { damageSnapshots } from "./damage-snapshots.mjs";

export function DamagePanel({ records, definition, filters, summary }) {
  const snapshot = damageSnapshots(records, definition, filters);
  const valueText = (value) => typeof value === "number" && Number.isFinite(value) ? fmtQuantity(value) : value === null || value === undefined || value === "" ? "—" : String(value);
  const occurrences = <>
    <div className="damage-total"><AlertTriangle size={25} /><strong>{fmtQuantity(summary.damaged)}</strong><span>unidades pendentes · ocorrências no filtro</span></div>
    <div className="table-wrap"><table><thead><tr><th>Fornecedor / origem</th><th>Identificação</th><th>Quantidade</th><th>Pendente</th></tr></thead>
      <tbody>{summary.damages.map((row) => <tr key={row.id}><td>{row.cells[6] || "Não identificado"}</td><td>{dateText(row.cells[1])}</td><td>{fmtQuantity(row.cells[9])}</td><td>{fmtQuantity(num(row.cells[9]) - num(row.cells[15]))}</td></tr>)}</tbody>
    </table></div>{!summary.damages.length && <p className="empty">Nenhuma ocorrência neste filtro.</p>}
  </>;
  return <article className="panel damage-panel">
    <div className="panel-heading"><h3>Danificados e pendências</h3><p>{snapshot.available ? "Apurações por fornecedor / origem · unidades" : "Ocorrências no período selecionado"}</p></div>
    {snapshot.available ? <>
      {snapshot.rows.length > 0 && snapshot.columns.length > 0 ? <div className="table-wrap damage-matrix"><table>
        <caption>Histórico da aba Danif. · cada data representa uma apuração independente</caption>
        <thead><tr><th scope="col">Danificados</th>{snapshot.columns.map((column) => <th scope="col" key={column.index}>{dateText(column.label)}</th>)}</tr></thead>
        <tbody>{snapshot.rows.map((row) => <tr key={row.id}><th scope="row">{row.cells[0]}</th>{snapshot.columns.map((column) => <td key={column.index}>{valueText(row.cells[column.index])}</td>)}</tr>)}</tbody>
        <tfoot><tr><th scope="row">TOTAL</th>{snapshot.totals.map((total, i) => <td key={snapshot.columns[i].index}>{valueText(total.value)}{total.partial && <span title="Total parcial: há valores não informados nesta apuração"> *</span>}</td>)}</tr></tfoot>
      </table></div> : <p className="empty">Nenhuma apuração encontrada para o fornecedor ou período selecionado.</p>}
      <p className="footnote damage-note">As datas não são somadas entre si. Campos vazios aparecem como —; * indica total parcial. Filtros de fornecedor e período se aplicam às apurações; espécie e pátio não constam neste resumo.</p>
      <details className="damage-occurrences"><summary>Consultar ocorrências detalhadas de danificados</summary>{occurrences}</details>
    </> : occurrences}
  </article>;
}
