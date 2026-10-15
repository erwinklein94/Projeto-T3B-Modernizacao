export const SOURCES = [
  { id: "operations", title: "Controle Dormentes Volume Espécies Jales", page: "dashboard", description: "Recebimentos, movimentações, estoque e registros operacionais." },
  { id: "weekly", title: "Controle Semanal Recebimentos por Fornecedor", page: "weekly", sheet: "Recebimento Semanal", description: "Recebimentos por semana e participação de cada fornecedor.", headers: ["Semana", "Pandolfi", "Granoski", "Três Guri", "Madebel", "TOTAL"] },
  { id: "taxonomy", title: "Catálogo Taxonômico Espécies Jales", page: "taxonomy", sheet: "Espécies", description: "Consulta de espécies, nomes populares, famílias, gêneros e distribuição.", headers: ["Nome científico", "Nome popular", "Família", "Gênero", "Regiões endêmicas / distribuição", "Nome aceito (autor)", "Outros nomes populares", "Observações"] },
];
export const sourceById = Object.fromEntries(SOURCES.map((source) => [source.id, source]));
