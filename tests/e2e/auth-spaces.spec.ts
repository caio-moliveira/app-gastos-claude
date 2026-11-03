import { randomBytes } from "node:crypto";
import { expect, test } from "@playwright/test";

const password = `E2e!${randomBytes(6).toString("hex")}`;
const email = `e2e-${randomBytes(4).toString("hex")}@claude-tests.cofre.test`;

test.describe.configure({ mode: "serial" });

test("rotas protegidas redirecionam para /login", async ({ page }) => {
  const response = await page.goto("/");
  expect(response?.ok()).toBe(true);
  await expect(page).toHaveURL(/\/login$/);
  await expect(page.getByText("Entrar no Cofre")).toBeVisible();
});

test("cadastro cria o espaço Pessoal; logout e login novamente", async ({ page }) => {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Pessoa E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();

  await expect(page).toHaveURL(/\/s\/[0-9a-f-]{36}$/);
  await expect(page.getByTestId("current-space")).toHaveText("Pessoal");

  // Cria um espaço compartilhado e troca pelo seletor.
  await page.getByRole("button", { name: "Trocar de espaço" }).click();
  await page.getByRole("menuitem", { name: "Novo espaço" }).click();
  await page.getByLabel("Nome").fill("Casa E2E");
  await page.getByRole("button", { name: "Criar espaço" }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Casa E2E");

  await page.getByRole("button", { name: "Trocar de espaço" }).click();
  await page.getByRole("menuitem", { name: /Pessoal/ }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Pessoal");

  // Logout e login.
  await page.getByRole("button", { name: "Menu do usuário" }).click();
  await page.getByRole("menuitem", { name: "Sair" }).click();
  await expect(page).toHaveURL(/\/login$/);

  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Pessoal");
});

test("360 px sem rolagem horizontal", async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 740 });
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-space")).toBeVisible();
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  expect(overflow).toBeLessThanOrEqual(0);
});
