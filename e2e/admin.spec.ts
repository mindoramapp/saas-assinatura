import { expect, test } from "@playwright/test";
import { signUp, uniqueEmail } from "./helpers";

test("painel de métricas: admin da plataforma vê; os demais não", async ({
  page,
}) => {
  await signUp(page, "Dona Comum", uniqueEmail("comum"));
  await expect(page.getByLabel("Nome da empresa")).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await page.goto("/app");
  await page.getByRole("button", { name: "Sair" }).click();
  await page.waitForURL("/");

  // admin@orcai.dev está em PLATFORM_ADMIN_EMAILS no playwright.config.ts.
  await signUp(page, "Admin", "admin@orcai.dev");
  await expect(page.getByLabel("Nome da empresa")).toBeVisible();
  await page.goto("/admin");
  await expect(
    page.getByRole("heading", { name: "Métricas do negócio" }),
  ).toBeVisible();
  for (const kpi of ["MRR", "Churn (30 dias)", "Usuários ativos", "Ativação"]) {
    await expect(page.getByText(kpi, { exact: true })).toBeVisible();
  }
});
