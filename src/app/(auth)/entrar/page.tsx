import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Entrar" };

export default function SignInPage() {
  return (
    <>
      <h1 className="mb-6 text-xl font-bold">Entrar no Orçaí</h1>
      <AuthForm mode="signin" />
    </>
  );
}
