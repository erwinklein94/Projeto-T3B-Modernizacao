import { norm } from "./domain.mjs";

// Nomes populares conforme a imagem de referência fornecida para o dashboard.
// Quantidades e percentuais são sempre calculados da planilha importada.
const reference = [
  ["Qualea albiflora", "Cambará"],
  ["Qualea paraensis", "Cambará-rosa"],
  ["Ocotea neesiana", "Canela"],
  ["Dialium guianense", "Guariúba"],
  ["Hymenaea courbaril", "Jatobá"],
  ["Enterolobium schomburgkii", "Tamboril"],
  ["Hymenolobium petraeum", "Angelim-pedra"],
  ["Dipteryx odorata", "Cumaru"],
  ["Astronium lecointei", "Muiracatiara"],
  ["Hymenaea parvifolia", "Peroba-branca"],
  ["Clarisia racemosa", "Baraú"],
  ["Goupia glabra", "Gupiúba"],
  ["Astronium fraxinifolium", "Gonçalo-alves"],
  ["Apuleia molaris", "Garapa"],
  ["Caryocar villosum", "Piquiá"],
  ["Dipteryx spp.", "Cumaru-ferro"],
  ["Diplotropis purpurea", "Sucupira-roxa"],
  ["Caryocar microcarpum", "Piquiarana-do-igapó"],
  ["Bowdichia racemosa Hoehne", "Sucupira-preta"],
  ["Caryocar glabrum", "Piquiarana"],
  ["Astronium graveolens", "Guaritá"],
  ["Hymenolobium excelsum", "Angelim-ferro"],
  ["Aspidosperma polyneuron Müll.Arg", "Peroba-rosa"],
  ["Peltogyne lecointei", "Roxinho"],
  ["Bowdichia nitida", "Sucupira-marreta"],
  ["Ocotea spixiana", "Canelão"],
  ["Diplotropis racemosa (Hoehne) Amshoff", "Sucupira-amarela"],
  ["Astronium gracile Engl.", "Sucupira-branca"],
  ["Hymenolobium nitidum", "Angelim-da-mata"],
  ["Hymenolobium heterocarpum Ducke", "Faveira"],
  ["Qualea dinizii", "Mandioqueira-escamosa"],
  ["Nectandra cissiflora", "Canela-fedida"],
  ["Bowdichia brasiliensis", "Sucupira-várzea"],
  ["Martiodendron elatum", "Tamarindo"],
];

export function speciesNames(records = [], taxonomy = []) {
  const names = new Map(reference.map(([scientific, popular]) => [norm(scientific), popular]));
  for (const { kind, cells } of records) {
    if (kind === "madeiras" && cells[0] && cells[1]) names.set(norm(cells[0]), String(cells[1]).trim());
  }
  for (const { cells } of taxonomy) {
    if (cells[0] && cells[1]) names.set(norm(cells[0]), String(cells[1]).trim());
  }
  return names;
}
