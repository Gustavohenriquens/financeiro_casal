# Publicar na Vercel (Turso + domínio na Hostinger)

## Onde ficam os dados

| O quê | Onde | Observação |
|---|---|---|
| Contas, senhas (hash bcrypt), lançamentos, dívidas… | **Turso** (banco SQLite na nuvem) | Tabela `users` guarda só o **hash** da senha. |
| Sessão de login | Cookie `httpOnly` + `Secure` no navegador | O JavaScript do site não consegue ler. |
| Segredos (`JWT_SECRET`, token do banco) | **Variáveis de ambiente da Vercel** | Nunca no código nem no Git. |
| Domínio | **Hostinger** (só o DNS) | Aponta para a Vercel; não precisa de hospedagem lá. |

> O disco da Vercel é temporário. Por isso o app **não** grava nada em arquivo em produção.

## 1. Criar o banco no Turso

1. Crie a conta em https://turso.tech e um banco novo (escolha a região mais próxima; ex.: *São Paulo* se disponível, senão *Virginia*).
2. Pegue a **URL** (`libsql://…turso.io`) e crie um **token** (Database → *Generate token*, com permissão de leitura e escrita).

Pela CLI, se preferir:

```bash
turso db create financas
turso db show financas --url
turso db tokens create financas
```

## 2. Gerar o segredo da sessão

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

## 3. Subir o projeto para o GitHub e importar na Vercel

1. Crie um repositório (privado) e envie o código. `.env`, `server/data` e `*.db` já estão no `.gitignore`.
2. Na Vercel: **Add New → Project →** escolha o repositório. Deixe o *Framework Preset* como **Other**. O `vercel.json` já define build, saída e rotas.
3. Em **Settings → Environment Variables** (marque Production e Preview) cadastre:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | URL do Turso (`libsql://…`) |
| `DATABASE_AUTH_TOKEN` | token do Turso |
| `JWT_SECRET` | o segredo do passo 2 |

4. **Deploy.** O build roda `npm run vercel-build`: gera o front-end e **cria as tabelas** no Turso (migração idempotente).

Depois do primeiro deploy, abra o endereço `*.vercel.app` e crie sua conta em **Criar área do casal**.
A segunda pessoa entra com o código de convite (Configurações → Nosso casal).

## 4. Domínio da Hostinger

1. Na Vercel: **Project → Settings → Domains → Add** e digite o domínio (ex.: `financas.seudominio.com.br`).
2. A Vercel mostra os registros exatos a criar. Use **os valores que ela mostrar**; normalmente:
   - subdomínio (`financas`): registro **CNAME** → `cname.vercel-dns.com`
   - domínio raiz (`seudominio.com.br`): registro **A** → `76.76.21.21`
3. Na Hostinger: **Domínios → seu domínio → DNS / Servidores de nomes → Gerenciar registros DNS**. Remova registros A/CNAME conflitantes do mesmo nome e crie os novos.
4. Aguarde a propagação (minutos a horas). A Vercel emite o **HTTPS** automaticamente.

## 5. Dia a dia

- **Atualizar o site:** `git push` → a Vercel publica sozinha (e roda a migração).
- **Mudar a estrutura do banco:** edite `server/src/db/schema.js` com `CREATE TABLE IF NOT EXISTS` / `ALTER TABLE` e faça deploy.
- **Backup:** no Turso, use `turso db shell financas .dump > backup.sql` de tempos em tempos (ou o *point-in-time recovery* do plano).
- **Trocar a senha de alguém / convidar:** Configurações dentro do app.

## Rodar localmente (sem Turso)

Sem nenhuma variável definida, o app usa um arquivo SQLite em `server/data/` e gera o segredo sozinho:

```bash
npm install
npm run dev      # http://localhost:5173
```

Para testar contra o Turso de verdade localmente, crie `.env.local` baseado em `.env.example` e rode `node --env-file=.env.local …`.

## Segurança — o que já está feito e o que vale reforçar

- Senhas com bcrypt; sessão em cookie `httpOnly`, `Secure`, `SameSite=Lax`; cabeçalhos de segurança (helmet).
- Todos os dados são filtrados pelo casal logado (um casal nunca enxerga o outro).
- **Recomendado:** limite de tentativas de login (rate limit) — em serverless precisa de armazenamento externo (ex.: Upstash Redis) ou ativar a proteção de bots/WAF da Vercel.
- Use senhas fortes e não reaproveite a do e-mail.
