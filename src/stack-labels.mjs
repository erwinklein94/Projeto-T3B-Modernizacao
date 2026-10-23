// Label only the highest visible segment, using the sum of visible suppliers.
export function stackTotalLabels(series, selected = {}, format = String) {
  return series.map((item, index) => ({
    label: {
      show: true,
      position: "top",
      distance: 6,
      fontWeight: "bold",
      formatter: ({ dataIndex }) => {
        const visible = series.map((s, i) => ({ index: i, value: Number(s.data[dataIndex] || 0) }))
          .filter((s) => selected[series[s.index].name] !== false);
        const highest = visible.filter((s) => s.value > 0).at(-1);
        return highest?.index === index
          ? format(visible.reduce((sum, s) => sum + s.value, 0))
          : "";
      },
    },
  }));
}
