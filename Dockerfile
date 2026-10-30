# Orçaí — imagem de produção (Next.js standalone não usado: o Prisma + SQLite
# precisam do node_modules completo). Escrito, mas não testado no notebook (sem Docker).
FROM node:22-slim AS build
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
RUN npm ci
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app ./
EXPOSE 3000
# Cria/atualiza o schema no volume e sobe o servidor.
CMD ["sh", "-c", "npx prisma db push && npx next start -p 3000"]
