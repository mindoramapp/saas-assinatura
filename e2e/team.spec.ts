import { expect, test } from "@playwright/test";
import { signOut, signUpWithOrg, uniqueEmail } from "./helpers";

test("plano Grátis não deixa convidar (limite de 1 pessoa)", async ({
  page,
}) => {
  const slug = await signUpWithOrg(
    page,
    "Dona Free",
    uniqueEmail("free"),
    "Doceria Free",
  );
  await page.goto(`/app/${slug}/equipe`);
  await page.getByLabel("E-mail").fill(uniqueEmail("x"));
  await page.getByRole("button", { name: "Enviar convite" }).click();
  await expect(page.getByText("O plano Grátis permite 1 pessoa")).toBeVisible();
});

test("quem não é membro não vê a organização dos outros", async ({ page }) => {
  const slug = await signUpWithOrg(
    page,
    "Dono A",
    uniqueEmail("a"),
    "Empresa A",
  );
  await signOut(page);
  await signUpWithOrg(page, "Dono B", uniqueEmail("b"), "Empresa B");
  // Com streaming o status HTTP já saiu (200); o que importa é não mostrar nada da org.
  await page.goto(`/app/${slug}`);
  await expect(
    page.getByRole("heading", { name: "Página não encontrada" }),
  ).toBeVisible();
  await expect(page.getByText("Empresa A")).toHaveCount(0);
});
