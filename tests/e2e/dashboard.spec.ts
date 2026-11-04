import { expect, test } from "@playwright/test";

// Usa os usuários do seed (npm run seed): Ana é editora em Casa; o painel precisa bater com a lista do mesmo mês.
const SEED_PASSWORD = "Cofre!2026";

test("painel de Casa em outubro bate com a lista filtrada pelo mesmo mês e muda ao trocar o mês", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("ana.claude@cofre.test");
  await page.getByLabel("Senha").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-space")).toBeVisible();

  await page.getByRole("button", { name: "Trocar de espaço" }).click();
  await page.getByRole("menuitem", { name: /Casa/ }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Casa");

  const base = new URL(page.url()).pathname;
  await page.goto(`${base}?mes=2026-10`);
  await expect(page.getByTestId("selected-month")).toHaveText("outubro de 2026");
  const income = await page.getByTestId("card-income").innerText();
  const expense = await page.getByTestId("card-expense").innerText();
  const result = await page.getByTestId("card-result").innerText();
  expect(income).toMatch(/^R\$ [\d.]+,\d{2}$/);
  await expect(page.getByTestId("top-expenses").locator("li")).toHaveCount(5);
  await expect(page.locator(".recharts-wrapper").first()).toBeVisible();

  await page.goto(`${base}/transacoes?mes=2026-10`);
  await expect(page.getByTestId("month-income")).toHaveText(income);
  await expect(page.getByTestId("month-expense")).toHaveText(expense);
  await expect(page.getByTestId("month-result")).toHaveText(result);

  await page.goto(`${base}?mes=2026-09`);
  await expect(page.getByTestId("selected-month")).toHaveText("setembro de 2026");
  expect(await page.getByTestId("card-expense").innerText()).not.toBe(expense);
});

test("Pessoal e Casa mostram números diferentes", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill("ana.claude@cofre.test");
  await page.getByLabel("Senha").fill(SEED_PASSWORD);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-space")).toBeVisible();
  const first = await page.getByTestId("card-balance").innerText();
  await page.getByRole("button", { name: "Trocar de espaço" }).click();
  await page.getByRole("menuitem", { name: /^(Casa|Pessoal)/ }).filter({ hasNotText: await page.getByTestId("current-space").innerText() }).first().click();
  await expect(page.getByTestId("card-balance")).not.toHaveText(first);
});
