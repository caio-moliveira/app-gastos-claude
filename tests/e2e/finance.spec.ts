import { randomBytes } from "node:crypto";
import { expect, test, type Page } from "@playwright/test";

const password = `E2e!${randomBytes(6).toString("hex")}`;
const email = `e2e-fin-${randomBytes(4).toString("hex")}@claude-tests.cofre.test`;

test.describe.configure({ mode: "serial" });

async function signup(page: Page) {
  await page.goto("/cadastro");
  await page.getByLabel("Nome").fill("Financeiro E2E");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Criar conta" }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Pessoal");
}

function accountRow(page: Page, name: string) {
  return page.getByTestId("account-row").filter({ has: page.getByTestId("account-name").getByText(name, { exact: true }) });
}

async function newTransaction(page: Page, opts: { type?: string; amount: string; description: string; category?: string; account?: string; dest?: string }) {
  await page.getByTestId("quick-new-transaction").click();
  const dialog = page.getByRole("dialog");
  if (opts.type) await dialog.getByRole("radio", { name: opts.type }).click();
  await dialog.getByLabel("Valor").fill(opts.amount);
  if (opts.account) await dialog.getByLabel(/^Conta( de origem)?$/).selectOption({ label: opts.account });
  if (opts.dest) await dialog.getByLabel("Conta de destino").selectOption({ label: opts.dest });
  if (opts.category) await dialog.getByLabel("Categoria").selectOption({ label: opts.category });
  await dialog.getByLabel("Descrição").fill(opts.description);
  await dialog.getByRole("button", { name: "Adicionar transação" }).click();
  await expect(dialog).toBeHidden();
}

test("usuário novo tem categorias padrão e a conta Carteira", async ({ page }) => {
  await signup(page);
  await page.getByRole("link", { name: "Categorias" }).click();
  await expect(page.getByTestId("category-row")).toHaveCount(12);
  await page.getByRole("link", { name: "Contas" }).click();
  await expect(accountRow(page, "Carteira")).toBeVisible();
});

test("conta com saldo inicial de R$ 1.000, despesa de R$ 250 → saldo R$ 750; transferência e CRUD", async ({ page }) => {
  await page.goto("/login");
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill(password);
  await page.getByRole("button", { name: "Entrar" }).click();
  await expect(page.getByTestId("current-space")).toHaveText("Pessoal");

  await page.getByRole("link", { name: "Contas" }).click();
  await page.getByRole("button", { name: "Nova conta" }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByLabel("Nome").fill("Banco E2E");
  await dialog.getByLabel("Saldo inicial").fill("100000");
  await dialog.getByRole("button", { name: "Criar conta" }).click();
  await expect(accountRow(page, "Banco E2E").getByTestId("account-balance")).toHaveText("R$ 1.000,00");

  await newTransaction(page, { amount: "25000", description: "Supermercado Bom Preço", category: "Mercado", account: "Banco E2E" });
  await expect(accountRow(page, "Banco E2E").getByTestId("account-balance")).toHaveText("R$ 750,00");

  // Transferência altera os dois saldos e não conta como receita/despesa.
  await newTransaction(page, { type: "Transferência", amount: "5000", description: "Saque", account: "Banco E2E", dest: "Carteira" });
  await expect(accountRow(page, "Banco E2E").getByTestId("account-balance")).toHaveText("R$ 700,00");
  await expect(accountRow(page, "Carteira").getByTestId("account-balance")).toHaveText("R$ 50,00");

  await page.getByRole("link", { name: "Transações" }).click();
  await expect(page.getByTestId("month-expense")).toHaveText("R$ 250,00");
  await expect(page.getByTestId("month-income")).toHaveText("R$ 0,00");
  await expect(page.getByTestId("transaction-row")).toHaveCount(2);

  // Editar reflete na lista e nos totais sem recarregar.
  await page.getByRole("button", { name: "Editar Supermercado Bom Preço" }).click();
  const edit = page.getByRole("dialog");
  await edit.getByLabel("Valor").fill("30000");
  await edit.getByRole("button", { name: "Salvar alterações" }).click();
  await expect(edit).toBeHidden();
  await expect(page.getByTestId("month-expense")).toHaveText("R$ 300,00");

  // Excluir.
  await page.getByRole("button", { name: "Excluir Supermercado Bom Preço" }).click();
  await page.getByRole("dialog").getByRole("button", { name: "Excluir" }).click();
  await expect(page.getByTestId("transaction-row")).toHaveCount(1);
  await expect(page.getByTestId("month-expense")).toHaveText("R$ 0,00");

  // Página além do fim redireciona em vez de quebrar.
  await page.goto(`${new URL(page.url()).pathname}?pagina=99`);
  await expect(page).not.toHaveURL(/pagina=99/);
  await expect(page.getByTestId("transaction-row")).toHaveCount(1);
});
