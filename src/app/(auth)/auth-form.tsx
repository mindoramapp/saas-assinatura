"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useState, type FormEvent } from "react";
import { Field, buttonClass } from "@/components/ui";
import { authClient } from "@/lib/auth-client";

/** Só aceita destinos internos (evita redirecionamento aberto). */
function safeNext(value: string | null): string {
  return value && value.startsWith("/") && !value.startsWith("//")
    ? value
    : "/app";
}

export function AuthForm({ mode }: { mode: "signin" | "signup" }) {
  const router = useRouter();
  const params = useSearchParams();
  const next = safeNext(params.get("next"));
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const email = String(form.get("email"));
    const password = String(form.get("password"));
    setPending(true);
    setError(null);
    const result =
      mode === "signup"
        ? await authClient.signUp.email({
            email,
            password,
            name: String(form.get("name")),
          })
        : await authClient.signIn.email({ email, password });
    if (result.error) {
      setPending(false);
      setError(
        mode === "signin"
          ? "E-mail ou senha incorretos."
          : result.error.status === 422
            ? "Já existe uma conta com esse e-mail."
            : (result.error.message ?? "Não foi possível criar a conta."),
      );
      return;
    }
    router.push(next);
    router.refresh();
  }

  const other = mode === "signin" ? "/cadastro" : "/entrar";
  const query = params.get("next") ? `?next=${encodeURIComponent(next)}` : "";

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      {mode === "signup" && (
        <Field label="Seu nome" name="name" required autoComplete="name" />
      )}
      <Field
        label="E-mail"
        name="email"
        type="email"
        required
        autoComplete="email"
      />
      <Field
        label="Senha"
        name="password"
        type="password"
        required
        minLength={8}
        autoComplete={mode === "signup" ? "new-password" : "current-password"}
        hint={mode === "signup" ? "Pelo menos 8 caracteres." : undefined}
      />
      {error && (
        <p
          role="alert"
          className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={pending}
        className={buttonClass("primary", "w-full")}
      >
        {pending
          ? "Aguarde…"
          : mode === "signin"
            ? "Entrar"
            : "Criar conta grátis"}
      </button>
      <p className="text-center text-sm text-slate-600">
        {mode === "signin" ? "Ainda não tem conta? " : "Já tem conta? "}
        <Link
          href={`${other}${query}`}
          className="text-brand-600 font-semibold hover:underline"
        >
          {mode === "signin" ? "Criar conta" : "Entrar"}
        </Link>
      </p>
    </form>
  );
}
