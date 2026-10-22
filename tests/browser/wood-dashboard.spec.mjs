import { test, expect } from "@playwright/test";
import { filePayload, woodFixture, weeklyFixture } from "../workbook-fixture.mjs";
import { sourceById } from "../../src/sources.mjs";
import { WOOD_METRICS } from "../../src/wood-domain.mjs";

const nav = (page, name) => page.getByRole("button", { name, exact: true });
const metric = (page, label) => page.locator(".kpi").filter({ has: page.getByText(label, { exact: true }) }).locator("strong");
async function upload(page, source, workbook, name) {
  await nav(page, "Inserir dados").click();
  await page.getByLabel(sourceById[source].title, { exact: true }).and(page.locator("input[type=file]")).setInputFiles(await filePayload(workbook, name));
  await expect(page.getByText(`Planilha: ${name}`, { exact: true })).toBeVisible();
}

test("Dashboard de madeiras compara as quatro propriedades com filtros e mantém ausências e ressalvas", async ({ page, context }) => {
  const errors = [], external = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("request", (request) => { if (!request.url().startsWith("http://127.0.0.1:") && !request.url().startsWith("blob:")) external.push(request.url()); });
  await page.goto("./");
  await nav(page, sourceById.wood.title).click();
  await expect(page.getByText("Nenhuma planilha importada", { exact: true })).toBeVisible();
  await expect(page.locator(".wood-charts .chart-card")).toHaveCount(4);
  await upload(page, "weekly", weeklyFixture(), "semanal.xlsx");
  await upload(page, "wood", woodFixture(), "madeiras.xlsx");
  await expect(page.locator(".import-card")).toHaveCount(4);
  await nav(page, sourceById.wood.title).click();
  await expect(metric(page, "Registros no comparativo")).toHaveText("4");
  await expect(metric(page, "Com as quatro propriedades")).toHaveText("3");
  await expect(metric(page, "Com ressalva de umidade")).toHaveText("2");
  await expect(page.locator(".wood-table tbody tr")).toHaveCount(4);
  await expect(page.locator(".wood-table").getByRole("cell", { name: "123,45", exact: true })).toBeVisible();

  await nav(page, "Ampliar Resistência à flexão (MOR)").click();
  const dialog = page.getByRole("dialog");
  await expect(dialog.locator("tbody tr")).toHaveCount(4);
  await expect(dialog.locator("tbody")).toContainText("Sem dado");
  await expect(dialog.locator(".chart-detail-metrics")).toHaveCount(0);
  await expect(dialog.getByRole("columnheader", { name: /%/ })).toHaveCount(0);
  await expect(dialog.locator("tbody")).toContainText("123,45");
  await nav(page, "Fechar detalhes do gráfico").click();

  await page.getByLabel("Espécie — Densidade básica", { exact: true }).selectOption("Espécie exemplo A");
  await nav(page, "Ampliar Densidade básica").click();
  await expect(dialog.locator("tbody tr")).toHaveCount(1);
  await expect(dialog.locator("tbody")).toContainText("650");
  await nav(page, "Fechar detalhes do gráfico").click();
  await page.getByLabel("Umidade — Módulo de elasticidade (MOE) — flexão", { exact: true }).selectOption("flagged");
  await nav(page, "Ampliar Módulo de elasticidade (MOE) — flexão").click();
  await expect(dialog.locator("tbody tr")).toHaveCount(2);
  await expect(dialog.locator("tbody")).toContainText("Corymbia exemplo");
  await expect(dialog.locator("tbody")).not.toContainText("Madeira A");
  await nav(page, "Fechar detalhes do gráfico").click();

  await page.getByLabel("Grupo de madeiras", { exact: true }).selectOption("other");
  await expect(metric(page, "Registros no comparativo")).toHaveText("2");
  await expect(page.locator(".wood-charts").getByText("Nenhuma espécie corresponde aos filtros deste gráfico.")).toHaveCount(1);
  await page.getByLabel("Buscar madeiras", { exact: true }).fill("observacao de origem");
  await expect(metric(page, "Registros no comparativo")).toHaveText("1");
  await nav(page, "Limpar filtros do comparativo").click();
  await page.getByText("Selecionar espécies (4 de 4)", { exact: true }).click();
  await nav(page, "Desmarcar todas").click();
  await expect(metric(page, "Registros no comparativo")).toHaveText("0");
  await page.getByLabel(/Madeira A.*Espécie exemplo A/).check();
  await expect(metric(page, "Registros no comparativo")).toHaveText("1");
  await nav(page, "Selecionar todas").click();
  await page.getByText("Fontes e notas da planilha", { exact: true }).click();
  await expect(page.getByText("Dados sintéticos para testes", { exact: true })).toBeVisible();
  await page.reload();
  await nav(page, sourceById.wood.title).click();
  await expect(metric(page, "Registros no comparativo")).toHaveText("4");
  await nav(page, "Ativar tema escuro").click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
  for (const property of WOOD_METRICS) await expect(page.getByRole("heading", { name: property.title, exact: true })).toBeVisible();
  const other = await context.newPage();
  await other.goto("./");
  await nav(other, sourceById.wood.title).click();
  const smaller = woodFixture();
  for (const n of [3, 4, 5]) smaller.getWorksheet("Propriedades da Madeira").getRow(n).values = [];
  await upload(page, "wood", smaller, "madeiras-atualizada.xlsx");
  await expect(metric(other, "Registros no comparativo")).toHaveText("1");
  await page.getByRole("button", { name: `Limpar dados de ${sourceById.wood.title}`, exact: true }).click();
  await nav(page, "Confirmar limpeza").click();
  await expect(metric(other, "Registros no comparativo")).toHaveText("0");
  await nav(page, sourceById.weekly.title).click();
  await expect(metric(page, "Recebidos no período")).toHaveText("15,75");
  expect(errors).toEqual([]);
  expect(external).toEqual([]);
});
