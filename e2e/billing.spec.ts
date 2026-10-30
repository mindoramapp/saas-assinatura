import { expect, test } from "@playwright/test";
import { signOut, signUp, signUpWithOrg, uniqueEmail } from "./helpers";

test("assinatura completa: checkout → convite → upgrade → downgrade → cancelamento", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const slug = await signUpWithOrg(
    page,
    "Dona Marta",
    uniqueEmail("marta"),
    "Marcenaria da Marta",
  );

  // 1. Checkout simulado do Pro: o plano muda via webhook assinado.
  await page.goto(`/app/${slug}/plano`);
  await page.getByRole("button", { name: "Assinar Pro" }).click();
  await expect(page).toHaveURL(
    new RegExp(`/checkout-simulado/${slug}\\?plano=PRO`),
  );
  await page.getByRole("button", { name: /Pagar R\$\s49,00/ }).click();
  await expect(page.getByText("Pagamento confirmado!")).toBeVisible();
  await expect(page.getByText("Plano atual")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "Fazer upgrade para Business" }),
  ).toBeVisible();

  // 2. Com o Pro, dá para convidar. O e-mail cai na caixa de saída de dev.
  const guestEmail = uniqueEmail("joao");
  await page.goto(`/app/${slug}/equipe`);
  await page.getByLabel("E-mail").fill(guestEmail);
  await page.getByLabel("Papel").selectOption("member");
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(
    page.getByText(`Convite enviado para ${guestEmail}`),
  ).toBeVisible();

  await page.goto("/dev/emails");
  const email = page.getByRole("listitem").filter({ hasText: guestEmail });
  const inviteHref = await email
    .getByRole("link", { name: "Aceitar convite" })
    .getAttribute("href");
  expect(inviteHref).toBeTruthy();
  const invitePath = new URL(inviteHref!).pathname;

  // 3. O convidado cria a conta pelo link e entra como membro.
  await page.goto("/app");
  await signOut(page);
  await page.goto(invitePath);
  await expect(
    page.getByRole("heading", { name: "Convite para Marcenaria da Marta" }),
  ).toBeVisible();
  await page.getByRole("link", { name: "Criar conta e aceitar" }).click();
  await page.getByLabel("Seu nome").fill("João");
  await page.getByLabel("E-mail").fill(guestEmail);
  await page.getByLabel("Senha").fill("senha-segura-123");
  await page.getByRole("button", { name: "Criar conta grátis" }).click();
  await page
    .getByRole("button", { name: "Aceitar e entrar na equipe" })
    .click();
  await expect(
    page.getByText("Orçamentos de Marcenaria da Marta."),
  ).toBeVisible();
  await expect(
    page.getByRole("complementary").getByText("Membro"),
  ).toBeVisible();

  // Membro não vê a auditoria nem os botões de cobrança.
  await expect(page.getByRole("link", { name: "Auditoria" })).toHaveCount(0);
  await page.goto(`/app/${slug}/plano`);
  await expect(
    page.getByText("Só o dono da empresa pode mudar o plano."),
  ).toBeVisible();
  await expect(page.getByRole("button", { name: /upgrade/i })).toHaveCount(0);
});

test("dono faz upgrade, downgrade e cancela; o plano volta ao Grátis no fim do período", async ({
  page,
}) => {
  test.setTimeout(120_000);
  const slug = await signUpWithOrg(
    page,
    "Seu Zé",
    uniqueEmail("ze"),
    "Oficina do Zé",
  );
  await page.goto(`/app/${slug}/plano`);
  await page.getByRole("button", { name: "Assinar Pro" }).click();
  await page.getByRole("button", { name: /Pagar/ }).click();
  await expect(page.getByText("Pagamento confirmado!")).toBeVisible();

  await page
    .getByRole("button", { name: "Fazer upgrade para Business" })
    .click();
  await expect(
    page.getByText("Upgrade feito! Agora você está no Business."),
  ).toBeVisible();

  await page.getByRole("button", { name: "Mudar para Pro" }).click();
  await expect(page.getByText("Plano alterado para Pro.")).toBeVisible();

  await page.getByRole("button", { name: "Cancelar assinatura" }).click();
  await expect(page.getByText(/Cancela em/)).toBeVisible();

  await page.getByRole("button", { name: "Simular fim do período" }).click();
  await expect(page.getByText("Período encerrado")).toBeVisible();
  await page.reload();
  await expect(page.getByRole("button", { name: "Assinar Pro" })).toBeVisible();
});

test("quem não é da empresa não abre o checkout dela", async ({ page }) => {
  await signUp(page, "Curioso", uniqueEmail("curioso"));
  await expect(page.getByLabel("Nome da empresa")).toBeVisible();
  await page.goto("/checkout-simulado/marcenaria-da-marta?plano=PRO");
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
});
