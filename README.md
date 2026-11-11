# Prumo Hub Pessoal — Plataforma de Estudo de Alto Rendimento

Uma plataforma web focada na gestão inteligente de **Simulados**, **Caderno de Erros** e **Revisão Conectada de Temas**, desenhada para estudantes que se preparam para objetivos de alta exigência (como Olimpíadas Científicas — OBI, OBM —, ENEM, Vestibulares e Concursos).

---

## O Problema

Estudantes que se preparam para provas competitivas e exames de alto nível enfrentam três gargalos técnicos que aplicativos genéricos de tarefas ou anotações (como Notion, Trello ou agendas comuns) não conseguem resolver sem criar burocracia:

1. **Perda do Raciocínio de Prova nos Simulados:** Ao realizar simulados em PDF, o estudante anota rascunhos em papéis soltos. Quando termina a prova e vai corrigir (especialmente com auxílio de IA em provas sem juiz corretor aberto), ele não tem o registro estruturado de *como pensou em cada questão durante o tempo de prova* nem do motivo exato que o fez travar.
2. **Erros Espalhados e Sem Ciclo de Revisão:** Questões erradas em simulados, problemas resolvidos em plataformas externas (como Codeforces ou bancos de questões de vestibular) e questões avulsas ficam espalhadas em lugares diferentes, sem um mecanismo unificado que separe o que ainda está pendente de revisão daquilo que já foi dominado sozinho.
3. **Esquecimento de Temas e Conhecimento Isolado em "Gavetas":** Sem um rastreador automático acoplado à prática real, o estudante passa semanas sem revisar determinados temas sem perceber. Além disso, falta um espaço limpo para registrar reflexões próprias sobre cada tema e construir pontes (conexões bidirecionais) entre temas diferentes que se relacionam nas provas.

---

## A Solução

O **Prumo Hub Pessoal** elimina campos burocráticos desnecessários e integra todo o ciclo de estudo ativo em **três módulos acoplados**, onde as ações realizadas em uma ponta atualizam automaticamente o restante do sistema:

### 1. Módulo de Simulados (Com Registro de Linha de Pensamento)
- **Preparação Pré-Prova:** Definição do título do simulado, tempo de duração do cronômetro, upload do PDF da prova e cadastro prévio da lista de questões (número e título, sem spoiler do tema).
- **Ambiente de Prova em Foco:** Leitura do PDF integrada ao cronômetro ativo (resiliente via timestamp persistido) e a um painel fixo compacto onde o estudante seleciona a questão e registra, em tempo real, quantos pensamentos e caminhos de raciocínio quiser ao longo da prova.
- **Pós-Prova e Correção Inteligente:**
  - Exportação com 1 clique de todas as questões e pensamentos registrados na prova, formatados em Markdown para correção rápida com IA.
  - Classificação por questão (`Acertei`, `Parcial` ou `Errei`) e vínculo com um ou mais **Temas** (existentes ou criados na hora).
  - **Integração Automática:** Marcar `Acertei` atualiza imediatamente a revisão dos temas da questão; marcar `Parcial` ou `Errei` abre um campo único de pós-revisão na gaveta da questão e a envia automaticamente para o **Caderno de Erros** (sem contar como revisão concluída do tema até que o erro seja efetivamente revisado).

### 2. Módulo de Caderno de Erros
- **Centralização de Falhas:** Reúne automaticamente as questões erradas ou parciais vindas dos **Simulados**, além de permitir o registro manual de **Questões de Plataformas Externas** (código/referência + link, como Codeforces ou bancos de questões do ENEM) e **Questões Genéricas/Completas** (com enunciado completo e link opcional).
- **Fluxo Honestidade de Revisão (`Pendentes` vs. `Já Revisados`):**
  - Cadastrar um erro não altera artificialmente a data de revisão do tema.
  - Somente quando o estudante revisa o erro e marca **`Finalizado Sozinho`** ou **`Com Ajuda`** é que o sistema atualiza a data de última revisão dos temas vinculados.
  - Erros revisados **`Com Ajuda`** mantêm um destaque visual mínimo (`border-l-2` âmbar) e todos os itens revisados podem ser devolvidos para pendentes ou marcados novamente como **`Finalizado Sozinho`** em revisões futuras.

### 3. Módulo de Temas e Revisão (Com Conexões Bidirecionais)
- **Radar de Revisão por Tema:** Lista todos os temas estudados exibindo há quanto tempo cada um não é revisado (calculado por data civil local à `00:00:00`, com destaque mínimo caso a última prática tenha sido feita *Com Ajuda*), além de permitir o registro rápido de práticas avulsas do dia a dia.
- **Reflexões e Conexões entre Temas:** Permite registrar aprendizados próprios de um tema ou criar conexões entre dois ou mais temas (`Tema A ↔ Tema B`). Toda conexão é bidirecional: dentro da gaveta expansível de qualquer tema, o estudante visualiza separadamente as **Reflexões Próprias do Tema** e as **Pontes/Conexões com Outros Temas**.

---

## Arquitetura e Tecnologias

O sistema é multi-usuário (permitindo que cada estudante tenha sua própria conta isolada e utilize a plataforma para seu objetivo específico — OBI, Programação Competitiva, ENEM ou Vestibulares) e segue padrões estritos de engenharia documentados em [GEMINI.md](./GEMINI.md), [STYLEGUIDE.md](./STYLEGUIDE.md) e [FRONTEND_HANDOFF.md](./FRONTEND_HANDOFF.md):

- **Estrutura:** Monorepo TypeScript estrito (`/frontend`, `/backend`, `/shared`, `/supabase`).
- **Frontend:** React, TypeScript, Vite (com `React.lazy`, `Suspense` + `Skeleton` por rota e `codeSplitting` de vendors), Tailwind CSS, `shadcn/ui`, Lucide Icons, TanStack Query, React Hook Form + Zod.
- **Backend (BFF):** Hono em Cloudflare Workers (Arquitetura em Camadas: Routes, Controllers, Services, Repositories) com validação universal via Zod, `secureHeaders`, CORS estrito e DTOs compartilhados.
- **Banco de Dados, Autenticação e Arquivos:** Supabase (PostgreSQL + Auth + Storage privado `simulado-pdfs`) com isolamento total por usuário via Row Level Security (RLS) e Stored Procedures (RPCs) transacionais atômicas.

### Estrutura de Pastas

```text
prumo-hub-pessoal/
├── backend/                 # API BFF Hono para Cloudflare Workers (Wrangler)
├── frontend/                # SPA React + Vite + Tailwind + shadcn/ui + vercel.json
├── shared/                  # Contratos compartilhados (schemas Zod, enums, DTOs e database.types)
├── supabase/
│   └── migrations/          # Migrations SQL versionadas (tabelas, RLS, bucket e RPCs)
├── FRONTEND_HANDOFF.md      # Contratos de endpoints e erros Backend -> Frontend
├── GEMINI.md                # Manual de engenharia, invariantes de domínio e fluxo Git
└── STYLEGUIDE.md            # Sistema visual, tokens, acentuação e padrões 2-níveis
```

---

## Pré-requisitos

- **Node.js** 20+ (recomendado 22+ ou 24 LTS) e **npm**
- **Supabase** (projeto ativo no Supabase Cloud e opcionalmente [Supabase CLI](https://supabase.com/docs/guides/cli) para aplicar migrations e gerar tipos)
- **Cloudflare Workers / Wrangler CLI** (autenticado via `npx wrangler login` para rodar localmente com mais fidelidade e publicar o backend)
- **Vercel** (para hospedagem estática SPA do frontend, com suporte ao arquivo [frontend/vercel.json](./frontend/vercel.json))

---

## Configuração e Execução Local

### 1. Banco de Dados e Storage (Supabase)

Aplique a migration inicial presente em [20261109232909_initial_schema.sql](./supabase/migrations/20261109232909_initial_schema.sql) no seu projeto Supabase:

```bash
supabase link --project-ref <SEU_PROJECT_REF>
supabase db push
```

> **Sincronização de tipos:** Sempre que novas migrations forem adicionadas ao banco, execute `npm run db:types` dentro de `backend/` para regenerar `shared/types/database.types.ts`.

### 2. Instalação de Dependências

O repositório separa as dependências por pacote (sem `package.json` na raiz):

```bash
cd backend && npm install
cd ../frontend && npm install
cd ../shared && npm install
```

### 3. Variáveis de Ambiente

Crie os arquivos locais a partir dos templates `.example` (eles já estão protegidos no `.gitignore`):

#### Backend (`backend/.dev.vars`, baseado em [backend/.dev.vars.example](./backend/.dev.vars.example))

```dotenv
SUPABASE_URL=https://<seu-projeto>.supabase.co
SUPABASE_ANON_KEY=<sua-chave-anon-supabase>
CORS_ORIGIN=http://localhost:5173
ENVIRONMENT=development
LOG_LEVEL=debug
```

- `CORS_ORIGIN`: aceita múltiplas origens separadas por vírgula (ex.: `http://localhost:5173,https://prumo.exemplo.com`), sem barra no final e **sem** curinga `*`.
- Nunca utilize `service_role_key` em rotas comuns de usuário; o BFF instancia o cliente Supabase por requisição usando o JWT do usuário para respeitar integralmente o RLS.

#### Frontend (`frontend/.env`, baseado em [frontend/.env.example](./frontend/.env.example))

```dotenv
VITE_SUPABASE_URL=https://<seu-projeto>.supabase.co
VITE_SUPABASE_ANON_KEY=<sua-chave-anon-supabase>
VITE_API_URL=http://localhost:3001/api/v1
```

- Atenção ao sufixo `/api/v1` em `VITE_API_URL` (validado na inicialização via Zod em `frontend/src/config/env.ts`).

### 4. Subindo os Servidores Locais

Em **dois terminais separados**:

```bash
# Terminal 1 — Backend BFF (porta 3001)
cd backend
npm run dev
```

```bash
# Terminal 2 — Frontend SPA (porta 5173)
cd frontend
npm run dev
```

Verifique rapidamente a saúde da API em `http://localhost:3001/api/v1/health` e acesse a interface em `http://localhost:5173`.

---

## Scripts de Qualidade, Testes e Build

Execute os comandos dentro da pasta de cada módulo:

### `shared/`
- `npm run typecheck` — Valida tipos compartilhados e schemas Zod (`tsc --noEmit`).

### `backend/`
- `npm run typecheck` — Checagem estrita de TypeScript (`tsc --noEmit`).
- `npm run build` — Empacotamento e verificação dry-run para Cloudflare Workers (`wrangler deploy --dry-run --outdir dist`).
- `npm run db:types` — Atualiza `shared/types/database.types.ts` a partir do projeto Supabase vinculado.

### `frontend/`
- `npm run typecheck` — Checagem estrita de TypeScript (`tsc --noEmit`).
- `npm test` — Executa a suíte unitária com Vitest (`vitest run`: datas locais, contratos compartilhados, regras de reflexões, caderno de erros e simulados).
- `npm run build` — Valida tipos (`tsc --noEmit`) e gera o bundle de produção em `frontend/dist` com lazy loading de rotas e divisão de chunks de vendors.
- `npm run preview` — Serve localmente o build gerado em `frontend/dist`.

---

## Deploy em Produção

### 1. Backend BFF — Cloudflare Workers

A configuração do Worker está em [backend/wrangler.toml](./backend/wrangler.toml) (nome padrão: `prumo-hub-pessoal-backend`).

1. Autentique-se na Cloudflare pela CLI (caso ainda não esteja logado):
   ```bash
   cd backend
   npx wrangler login
   ```
2. Publique o Worker:
   ```bash
   npm run deploy
   ```
3. Configure as variáveis e segredos de produção diretamente via Wrangler (sem versionar credenciais no repositório):
   ```bash
   npx wrangler secret put SUPABASE_URL
   npx wrangler secret put SUPABASE_ANON_KEY
   npx wrangler secret put CORS_ORIGIN
   npx wrangler secret put ENVIRONMENT
   npx wrangler secret put LOG_LEVEL
   ```
   - Sugestão de valores não-sensíveis: `ENVIRONMENT=production`, `LOG_LEVEL=info`, `CORS_ORIGIN=https://<seu-dominio-frontend>.vercel.app`.
4. Valide o endpoint público de saúde:
   ```bash
   curl https://prumo-hub-pessoal-backend.<seu-subdominio>.workers.dev/api/v1/health
   ```

> **Segurança e Rate Limiting na Edge:** O Worker já aplica cabeçalhos de segurança (`hono/secure-headers`) e CORS restrito. Caso queira ativar WAF e regras gerenciadas de Rate Limiting na Cloudflare em frente à API, associe um domínio próprio ao Worker ou adicione um binding `[[ratelimits]]` conforme o plano da sua conta Cloudflare.

### 2. Frontend SPA — Vercel

O arquivo [frontend/vercel.json](./frontend/vercel.json) já inclui a regra oficial de rewrite (`/(.*) -> /index.html`) para suportar deep links e recarregamento de página (`F5`) no React Router (`BrowserRouter`).

1. Conecte o repositório GitHub na Vercel e configure o projeto como monorepo:
   - **Root Directory:** `frontend`
   - **Include files outside the root directory (`sourceFilesOutsideRootDirectory`):** **Habilitado** *(obrigatório porque `frontend/` importa contratos de `../shared`)*.
   - **Framework Preset:** `Vite`
   - **Build Command:** `npm run build`
   - **Output Directory:** `dist`
2. Cadastre as variáveis de ambiente na Vercel (`Production` e `Preview`):
   - `VITE_SUPABASE_URL` — URL do seu projeto Supabase
   - `VITE_SUPABASE_ANON_KEY` — Chave `anon` pública do Supabase
   - `VITE_API_URL` — URL do Worker publicado **com `/api/v1`** (ex.: `https://prumo-hub-pessoal-backend.<seu-subdominio>.workers.dev/api/v1`)
3. Após o deploy gerar a URL final da Vercel (ou configurar domínio customizado), atualize o segredo `CORS_ORIGIN` no Cloudflare Worker caso a origem final seja diferente da configurada inicialmente.

### 3. Autenticação — Supabase Auth

No painel do Supabase (**Authentication → URL Configuration**):
- Defina **Site URL** com a URL de produção do frontend na Vercel (`https://<seu-dominio-frontend>.vercel.app`).
- Em **Redirect URLs**, adicione a URL de produção (e, se necessário, URLs de preview/desenvolvimento local como `http://localhost:5173/**`).

---

## Fluxo de Branches (Git)

- `main`: código estável pronto para produção.
- `develop`: branch de integração das entregas concluídas.
- `feature/...`, `fix/...`, `chore/...`, `docs/...`: branches curtas de trabalho utilizando Conventional Commits em português.
