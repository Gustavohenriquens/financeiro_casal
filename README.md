# Finanças do Casal

Controle financeiro para duas pessoas. Node 22+, Express 5 (API), React + Vite (front), banco **Turso/libSQL** (SQLite na nuvem; arquivo local em desenvolvimento).

## Rodando

```bash
npm install
npm run seed     # opcional: dados de demonstração (ana@demo.com / bruno@demo.com, senha demo12345)
npm run dev      # API em :3001 e app em http://localhost:5173
```

Publicação na Vercel + Turso + domínio na Hostinger: veja **[DEPLOY.md](DEPLOY.md)**.
Variáveis (obrigatórias só em produção): `DATABASE_URL`, `DATABASE_AUTH_TOKEN`, `JWT_SECRET` — ver `.env.example`.

## Estrutura

- `server/src/routes` – HTTP + validação (zod)
- `server/src/services` – regras de negócio (saldo, dashboard, alertas, lançamentos)
- `server/src/db` – schema SQLite (valores em centavos) e seed
- `client/src` – SPA: `pages/`, `components/`, `nav.js`, `styles.css` (tema claro/escuro)

## Modelo de dados

`transactions` é o livro-caixa único (receita/despesa/conta/parcela). "Vencido" é derivado
(pendente e vencimento < hoje). Dívidas e parcelamentos geram suas parcelas como `transactions`,
então pago/restante/% são calculados a partir delas, sem duplicar dados.

## Etapas

1. ✅ Autenticação, banco, API de lançamentos, alertas, dashboard
2. ✅ Contas, Receitas, Despesas (listas + filtros), Dívidas, Parcelamentos
3. ✅ Recorrências, Calendário, Metas
4. ✅ Visão mensal, Relatórios (CSV), Configurações
