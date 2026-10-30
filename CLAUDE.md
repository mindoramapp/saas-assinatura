# Projeto 5 — SaaS full-stack de assinatura com cobrança, funções de usuário e analytics

**Trilha:** 🌐 Trilha de Desenvolvimento Web · **Catálogo:** `../Projetos_Portfolio_Claude_Code.md` · **Agenda:** `../AGENDA.md`

## Regras de trabalho (valem para esta pasta)

- Responder em português (pt-BR). Ler também `~/CONTEXTO_CLAUDE.md` (regras de privacidade de IP, sudo via `sudo -A` + zenity, etc.).
- Ritmo: **um projeto por dia**. O catálogo estima semanas; aqui o alvo do dia é um **MVP funcional, testado e versionado**, com o restante listado em "Próximos passos" no README.
- Fluxo: planejar → aprovação do usuário → implementar em fases, commits pequenos (Conventional Commits), testes ao fim de cada fase.
- Segredos só em `.env` (com `.env.example`). Chaves de API são digitadas numa janela `zenity` que grava direto no `.env`; nunca pedir para colar no chat.
- Ao terminar a sessão, atualizar a seção **Estado e diário** abaixo e a linha do projeto em `../AGENDA.md`.

## Divulgação ao fim do dia (padrão da série)

Instagram/Facebook do usuário: **@ideia_enegocios**.

**Objetivo da divulgação: atrair clientes** que querem um site novo ou melhorar o site/sistema que já têm (público: donos de negócio, não programadores). Textos e vídeo falam do **benefício para o negócio do cliente** (vender mais, atender melhor, segurança, velocidade, economia), com linguagem simples, e terminam com chamada para o direct. Modelo aprovado pelo usuário em 15/10/2026: P01 (`video/reel.config.json` e `video/LEGENDA_INSTAGRAM.txt`): abertura com benefício ("Um site que se adapta a cada cliente"), legendas das cenas de código traduzidas em benefício ("Testado a cada mudança: seu site não quebra"), encerramento de venda (aprovado): "Quer um site assim?" + lista de serviços com check ("Criação de sites", "Reforma do seu site atual", "Mais clientes pela internet") + botão pulsando "Me chama no direct" + @ideia_enegocios, com 4,5 s de duração.

Ao concluir o MVP do dia, sem o usuário precisar pedir:

1. **Texto do post:** já existe em `POST_REDES_SOCIAIS.md` (nesta pasta). Revisar contra o que realmente ficou pronto (não anunciar função que não existe) e copiar o texto para `video/LEGENDA_INSTAGRAM.txt`.
2. **Reel de 30 s** (formato 9:16), **foco no produto, para encantar o público comum** (regra do usuário, 21/10/2026): no máximo **10 s de código** no total (uma cena curta, com legenda de benefício; o gerador recusa mais que isso) e o resto mostrando o produto sendo usado. Criar `video/reel.config.json` (modelo: `../P03_ecommerce-micro-frontends/video/reel.config.json`) com uma cena `app` (o Playwright usa o app de verdade no celular: toques, digitação, legenda por passo) e, se fizer sentido, uma cena `site` (rolagem), e renderizar com `../_video/gerar-reel.mjs` (ver `../_video/README.md`): rascunho, conferir quadros (folha de contato), depois o final. Abertura com "Dia 5 de 22"; encerramento com o @.
3. Pôr `video/.build/` e `video/*.mp4` no `.gitignore` do projeto; o `reel.config.json` e a legenda vão para o git.
4. Avisar o usuário onde estão `video/reel.mp4`, `video/capa.jpg` e `video/LEGENDA_INSTAGRAM.txt`.

## Restrições do notebook (verificadas em 14/10/2026)

- Linux Mint 22.3, i5-4210U, **8 GB de RAM** (≈3 GB livres com VS Code e Chrome abertos), 170 GB livres.
- Instalados: Node 22, npm 10, Python 3.12, git 2.43, gh 2.45 (logado).
- **Não instalados:** Docker, pnpm, PostgreSQL. Instalar Docker/Postgres exige sudo e, no modo automático, pode ser bloqueado: pedir ao usuário o modo manual. Preferir alternativas leves (SQLite/PGlite local, serviços gerenciados gratuitos) quando o prompt pedir Docker Compose, e documentar a troca.
- Evitar deixar servidores de desenvolvimento rodando ao fim do dia (pressão de RAM).

**Nível:** Avançado · **Tempo:** 4–6 semanas

**Objetivo:** Boilerplate de SaaS real: multi-organização, planos pagos, convites de equipe, controle de acesso por papéis e dashboard de métricas (MRR, churn, ativação).

**Stack:** Next.js + TypeScript, Auth.js ou Better Auth, Prisma + Postgres, Stripe Billing (checkout, portal, webhooks), PostHog ou analytics próprio, Resend para e-mails.

**Funcionalidades:**

- Organizações (workspaces) com convites por e-mail
- RBAC: owner, admin, member, viewer — checado no servidor
- Planos Free/Pro/Business com limites de uso (feature gating)
- Webhooks Stripe idempotentes (subscription created/updated/deleted)
- Dashboard admin: MRR, churn, usuários ativos
- Audit log de ações sensíveis

**Observações:**

- Escolha um produto concreto (ex.: gerador de relatórios) para não ficar só boilerplate
- Webhooks: verifique assinatura e trate eventos fora de ordem
- Testes E2E do fluxo de upgrade/downgrade com Stripe CLI
- Ponto forte para vagas full-stack em startups

## Projeto técnico: "Orçaí" (decisões aprovadas em 30/10/2026)

**Visão:** SaaS de orçamentos e propostas comerciais para pequenos negócios. Cada empresa (organização) cria orçamentos, manda o link para o cliente aprovar e assina um plano: Grátis (5 orçamentos/mês, 1 pessoa), Pro (R$ 49, ilimitado, 5 pessoas, cor da marca) e Business (R$ 129, equipe ilimitada, exportar auditoria).

**Comandos:** `npm run dev` · `npm test` (Vitest; recria `test.db`) · `npm run test:e2e` (Playwright, porta 3100, Chrome do sistema) · `npm run lint` · `npm run typecheck` · `npm run format` · `npm run db:push` · `npm run db:seed` (dados de demonstração e 12 meses de métricas).

**Decisões de arquitetura:**

- Next.js 16.4 (App Router, `cacheComponents` ligado: leituras de sessão ficam atrás de `<Suspense>`), TypeScript estrito com `noUncheckedIndexedAccess`.
- Better Auth (e-mail e senha) só para identidade e sessão. Organizações, papéis e convites são próprios (`src/lib/rbac.ts`), checados no servidor em toda action/rota.
- Prisma 7 + SQLite (adapter better-sqlite3) no dev e nos testes; schema portável para Postgres (sem enums nativos). Docker Compose com Postgres escrito, não testado (sem Docker no notebook).
- Cobrança: `BILLING_MODE=fake` (regra do catálogo: só ferramentas gratuitas). Checkout e portal simulados emitem eventos no formato do Stripe, **assinados com o SDK oficial** e enviados por HTTP ao webhook, que verifica a assinatura com `constructEvent`. Idempotência por `ProcessedEvent`; eventos fora de ordem são descartados comparando `event.created` com `Subscription.lastEventAt`.
- O plano da organização (`Organization.plan`) só muda pelo webhook, nunca direto pela UI.
- E-mails: Resend se houver `RESEND_API_KEY`; senão, caixa de saída em `/dev/emails`.
- Analytics próprio (`AnalyticsEvent`) e painel `/admin` (MRR, churn, usuários ativos, ativação) para os e-mails de `PLATFORM_ADMIN_EMAILS`.
- No lugar do Stripe CLI, os E2E disparam o mesmo fluxo de webhooks assinados localmente.

**Convenções:** Conventional Commits; textos da interface em pt-BR; lógica de domínio em `src/lib/*` (testável sem Next), páginas finas em `src/app`; toda ação sensível grava `AuditLog` via `src/lib/audit.ts`.

**Armadilhas:** o Prisma recusa `db push --force-reset` quando roda via agente: os testes apagam o `test.db` e fazem `db push`. O `tslib@2.9.1` sumiu do registro do npm: `overrides.tslib=2.8.1` no package.json.

## Prompt original (do catálogo)

```text
Você é um engenheiro de software sênior. Vamos construir o projeto "SaaS full-stack de assinatura com cobrança, funções de usuário e analytics" (Trilha Desenvolvimento Web) como peça de portfólio com qualidade de produção.

OBJETIVO
Boilerplate de SaaS real: multi-organização, planos pagos, convites de equipe, controle de acesso por papéis e dashboard de métricas (MRR, churn, ativação).

STACK SUGERIDA (pode propor ajustes justificando)
Next.js + TypeScript, Auth.js ou Better Auth, Prisma + Postgres, Stripe Billing (checkout, portal, webhooks), PostHog ou analytics próprio, Resend para e-mails.

FUNCIONALIDADES OBRIGATÓRIAS
1. Organizações (workspaces) com convites por e-mail
2. RBAC: owner, admin, member, viewer — checado no servidor
3. Planos Free/Pro/Business com limites de uso (feature gating)
4. Webhooks Stripe idempotentes (subscription created/updated/deleted)
5. Dashboard admin: MRR, churn, usuários ativos
6. Audit log de ações sensíveis

CUIDADOS E REQUISITOS NÃO FUNCIONAIS
- Escolha um produto concreto (ex.: gerador de relatórios) para não ficar só boilerplate
- Webhooks: verifique assinatura e trate eventos fora de ordem
- Testes E2E do fluxo de upgrade/downgrade com Stripe CLI
- Ponto forte para vagas full-stack em startups
- Tipagem estrita, lint e formatação configurados
- Testes automatizados (unitários + integração; E2E nos fluxos críticos)
- Docker Compose para subir tudo localmente com um comando
- Segredos apenas em .env (com .env.example)
- CI no GitHub Actions rodando lint, testes e build

COMO TRABALHAR
1. ANTES de codar, entre em modo de planejamento: arquitetura, estrutura de pastas, modelo de dados e plano em fases (MVP primeiro). Aguarde minha aprovação.
2. Crie um CLAUDE.md com visão, comandos, convenções e decisões de arquitetura.
3. Implemente fase por fase, commits pequenos (Conventional Commits), rodando testes ao fim de cada fase.
4. Ao final, gere README.md: problema, demo, diagrama Mermaid, como rodar, trade-offs, limitações e próximos passos.
5. Se algo for ambíguo, pergunte em vez de supor.

Comece apresentando o plano da Fase 1.
```

## Estado e diário

- **Status:** não iniciado.
