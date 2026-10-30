import { expect, test } from "@playwright/test";
import { signUpWithOrg, uniqueEmail } from "./helpers";

test("cria orçamento com itens, o cliente aprova pelo link e a empresa vê o aprovado", async ({
  page,
  browser,
}) => {
  test.setTimeout(90_000);
  const slug = await signUpWithOrg(
    page,
    "Ana",
    uniqueEmail("ana"),
    "Ana Reformas",
  );

  await page.getByRole("link", { name: "+ Novo orçamento" }).click();
  await page.getByLabel("Título").fill("Reforma do banheiro");
  await page.getByLabel("Nome do cliente").fill("Carla Souza");
  await page.getByLabel("Descrição do item 1").fill("Revestimento");
  await page.getByLabel("Quantidade do item 1").fill("12");
  await page.getByLabel("Preço do item 1").fill("89,90");
  await page.getByRole("button", { name: "+ Adicionar item" }).click();
  await page.getByLabel("Descrição do item 2").fill("Mão de obra");
  await page.getByLabel("Preço do item 2").fill("1.500,00");
  // 12 × 89,90 + 1.500,00 = 2.578,80
  await expect(page.getByTestId("total")).toHaveText(/2\.578,80/);
  await page.getByRole("button", { name: "Criar orçamento" }).click();

  await expect(
    page.getByRole("heading", { name: "Reforma do banheiro" }),
  ).toBeVisible();
  const publicUrl = await page.getByLabel("Link do orçamento").inputValue();

  // O cliente abre o link sem login, em outro navegador.
  const client = await browser.newContext();
  const clientPage = await client.newPage();
  await clientPage.goto(publicUrl);
  await expect(clientPage.getByText("Ana Reformas")).toBeVisible();
  await expect(clientPage.getByText(/R\$\s2\.578,80/)).toBeVisible();
  await clientPage.getByRole("button", { name: "Aprovar orçamento" }).click();
  await expect(clientPage.getByText(/Orçamento aprovado em/)).toBeVisible();
  await client.close();

  await page.goto(`/app/${slug}`);
  await expect(page.getByText("Aprovado", { exact: true })).toBeVisible();
  await expect(page.getByText("100%")).toBeVisible();

  // Apagar vai para a auditoria (dono vê a auditoria).
  await page.getByRole("link", { name: /Reforma do banheiro/ }).click();
  await page.getByRole("button", { name: "Apagar orçamento" }).click();
  await expect(page.getByText("Nenhum orçamento ainda")).toBeVisible();
  await page.getByRole("link", { name: "Auditoria" }).click();
  await expect(page.getByText("Apagou um orçamento")).toBeVisible();
  await expect(page.getByText("#1 · Carla Souza")).toBeVisible();
});
