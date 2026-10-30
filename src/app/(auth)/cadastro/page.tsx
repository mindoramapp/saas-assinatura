import type { Metadata } from "next";
import { AuthForm } from "../auth-form";

export const metadata: Metadata = { title: "Criar conta" };

export default function SignUpPage() {
  return (
    <>
      <h1 className="mb-1 text-xl font-bold">Crie sua conta grátis</h1>
      <p className="mb-6 text-sm text-slate-600">
        Sem cartão. Seus 5 primeiros orçamentos do mês são por nossa conta.
      </p>
      <AuthForm mode="signup" />
    </>
  );
}
