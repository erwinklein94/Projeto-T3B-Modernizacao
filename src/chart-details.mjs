// Uses only the aggregated data already visible to the dashboard's current role.
export function chartDetails(option) {
  const series = option.series || [];
  const pie = series[0]?.type === "pie";
  const labels = pie
    ? series[0].data.map((v) => v.name)
    : (option.xAxis?.type === "category" ? option.xAxis : option.yAxis)?.data || [];
  if (series.some((s) => s.stack)) {
    const rows = labels.flatMap((label, i) => series
      .map((s) => ({ label: `${label} · ${s.name}`, values: [Number(s.data[i] || 0)] }))
      .filter((r) => r.values[0] !== 0));
    return { columns: ["Recebidos"], rows, totals: [rows.reduce((sum, r) => sum + r.values[0], 0)] };
  }
  const columns = series.map((s) => s.name || "Recebidos");
  const rows = labels.map((label, i) => ({
    label,
    values: series.map((s) => {
      const v = s.data[i];
      return typeof v === "number" ? v : Number(v?.value || 0);
    }),
  }));
  const totals = columns.map((_, i) => rows.reduce((sum, r) => sum + r.values[i], 0));
  return { columns, rows, totals };
}
