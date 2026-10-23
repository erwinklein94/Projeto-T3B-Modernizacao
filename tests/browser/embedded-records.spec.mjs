import { test, expect } from "@playwright/test";
import { fixture, filePayload } from "../workbook-fixture.mjs";

const title = "Controle Dormentes Volume Espécies Jales";

test("Dashboard usa o nome da planilha e mantém registros, filtros e exportação abaixo dos gráficos", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: title, exact: true, level: 1 })).toBeVisible();
  await expect(page.locator("nav").getByRole("button", { name: title, exact: true })).toBeVisible();
  await expect(page.locator("nav").getByRole("button", { name: "Registros", exact: true })).toHaveCount(0);
  await page.getByRole("button", { name: "Inserir dados", exact: true }).click();
  const workbook = fixture();
  const sheet = workbook.getWorksheet("Recebimentos");
  for (let i = 1; i <= 31; i++) {
    const cells = sheet.getRow(5).values.slice(1);
    cells[0] = `R-${String(i).padStart(2, "0")}`;
    sheet.addRow(cells);
  }
  await page.getByLabel(title, { exact: true }).and(page.locator("input[type=file]")).setInputFiles(await filePayload(workbook));
  await expect(page.getByText("Planilha: controle.xlsx", { exact: true })).toBeVisible();
  await page.locator("nav").getByRole("button", { name: title, exact: true }).click();
  const records = page.getByRole("region", { name: "Registros", exact: true });
  await expect(records).toBeVisible();
  expect(await page.evaluate(() => [...document.querySelectorAll("[data-chart-title]")].every((chart) => Boolean(chart.compareDocumentPosition(document.getElementById("registros")) & Node.DOCUMENT_POSITION_FOLLOWING)))).toBe(true);
  await expect(records.locator("tbody tr")).toHaveCount(30);
  await records.getByRole("button", { name: "Próxima", exact: true }).click();
  await expect(records.locator("tbody tr")).toHaveCount(2);
  await expect(records.getByText("Página 2 de 2", { exact: true })).toBeVisible();
  await records.getByLabel("Busca livre", { exact: true }).fill("R-31");
  await expect(records.locator("tbody tr")).toHaveCount(1);
  await expect(records.getByRole("cell", { name: "R-31", exact: true })).toBeVisible();
  await expect(records.getByText("Página 1 de 1", { exact: true })).toBeVisible();
  const download = page.waitForEvent("download");
  await records.getByRole("button", { name: "Exportar Excel", exact: true }).click();
  expect((await download).suggestedFilename()).toBe("Recebimentos.xlsx");
  await records.getByRole("region", { name: "Filtros dos registros", exact: true }).getByRole("button", { name: "Limpar", exact: true }).click();
  await records.getByRole("tab", { name: "Movimentacoes", exact: true }).click();
  await expect(records.locator("tbody tr")).toHaveCount(1);
  await expect(records.getByRole("columnheader", { name: "Entrada (un.)", exact: true })).toBeVisible();
  await records.getByRole("tab", { name: "Recebimentos", exact: true }).click();
  await page.getByRole("region", { name: "Filtros do dashboard", exact: true }).getByLabel("Data inicial", { exact: true }).fill("2026-06-21");
  await expect(page.locator(".kpi").filter({ hasText: "Entradas" }).locator("strong")).toHaveText("0");
  await expect(records.locator("tbody tr")).toHaveCount(30);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});

test("Topo mostra somente entradas e saídas sem refugo, preservando os registros originais", async ({ page }) => {
  const workbook = fixture();
  const sheet = workbook.getWorksheet("Movimentacoes");
  const damaged = sheet.getRow(5).values.slice(1);
  Object.assign(damaged, { 1: "Segregação danificado - saída disponível", 6: 5.5, 7: 0, 15: "Danificado segregado" });
  sheet.addRow(damaged);
  const rejected = [...damaged];
  Object.assign(rejected, { 1: "Consumo", 6: 0, 7: 3.5, 15: "Refugo" });
  sheet.addRow(rejected);
  await page.goto("./");
  await page.getByRole("button", { name: "Inserir dados", exact: true }).click();
  await page.getByLabel(title, { exact: true }).and(page.locator("input[type=file]")).setInputFiles(await filePayload(workbook));
  await expect(page.getByText("Planilha: controle.xlsx", { exact: true })).toBeVisible();
  await page.locator("nav").getByRole("button", { name: title, exact: true }).click();
  const cards = page.locator(".operation-kpis .kpi");
  await expect(cards).toHaveCount(2);
  await expect(cards.filter({ hasText: "Entradas" }).locator("strong")).toHaveText("11");
  await expect(cards.filter({ hasText: "Saídas" }).locator("strong")).toHaveText("2");
  await expect(cards.filter({ hasText: "Recebidos" })).toHaveCount(0);
  await expect(cards.filter({ hasText: "Saldo do período" })).toHaveCount(0);
  const records = page.getByRole("region", { name: "Registros", exact: true });
  await records.getByRole("tab", { name: "Movimentacoes", exact: true }).click();
  await expect(records.locator("tbody tr")).toHaveCount(3);
  await expect(records.getByRole("cell", { name: "Refugo", exact: true })).toBeVisible();
  const filters = page.getByRole("region", { name: "Filtros do dashboard", exact: true });
  await filters.getByLabel("Data inicial", { exact: true }).fill("2026-06-21");
  await expect(cards.filter({ hasText: "Entradas" }).locator("strong")).toHaveText("0");
  await expect(records.locator("tbody tr")).toHaveCount(3);
  await page.setViewportSize({ width: 390, height: 844 });
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
});
