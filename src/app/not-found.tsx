import { LinkButton } from "@/components/ui";

export default function NotFound() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center px-4 py-16 text-center">
      <p className="text-brand-600 text-sm font-semibold">404</p>
      <h1 className="mt-2 text-2xl font-bold">Página não encontrada</h1>
      <p className="mt-2 text-sm text-slate-600">
        O endereço não existe ou você não tem acesso a ele.
      </p>
      <LinkButton href="/app" className="mt-6">
        Voltar para o início
      </LinkButton>
    </main>
  );
}
