"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";
import type { ActionResult } from "@/lib/errors";
import { buttonClass, type ButtonVariant } from "./ui";

export function SubmitButton({
  children,
  variant = "primary",
  className = "",
}: {
  children: ReactNode;
  variant?: ButtonVariant;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={buttonClass(variant, className)}
    >
      {pending ? "Aguarde…" : children}
    </button>
  );
}

/** Formulário de server action que mostra o erro (ou sucesso) devolvido pelo servidor. */
export function ActionForm({
  action,
  children,
  className = "",
}: {
  action: (
    state: ActionResult | null,
    formData: FormData,
  ) => Promise<ActionResult>;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, null);
  return (
    <form action={formAction} className={className}>
      {children}
      {state && !state.ok && (
        <p
          role="alert"
          className="mt-3 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-800"
        >
          {state.error}
        </p>
      )}
      {state?.ok && state.message && (
        <p
          role="status"
          className="mt-3 rounded-lg bg-emerald-50 px-3 py-2 text-sm text-emerald-800"
        >
          {state.message}
        </p>
      )}
    </form>
  );
}
