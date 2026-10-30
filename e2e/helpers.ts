import { expect, type Page } from "@playwright/test";

export function uniqueEmail(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1e4)}@teste.dev`;
}

export async function signUp(
  page: Page,
  name: string,
  email: string,
  next?: string,
) {
  await page.goto(
    next ? `/cadastro?next=${encodeURIComponent(next)}` : "/cadastro",
  );
  await page.getByLabel("Seu nome").fill(name);
  await page.getByLabel("E-mail").fill(email);
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
}

/** Cadastra e cria a empresa; devolve o slug. */
export async function signUpWithOrg(
  page: Page,
  name: string,
  email: string,
  orgName: string,
) {
  await signUp(page, name, email);
  await page.getByLabel("Nome da empresa").fill(orgName);
  await page.getByRole("button", { name: "Criar empresa" }).click();
  await expect(page.getByRole("heading", { name: "Orçamentos" })).toBeVisible();
  return new URL(page.url()).pathname.split("/")[2]!;
}

export async function signOut(page: Page) {
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("/");
}
