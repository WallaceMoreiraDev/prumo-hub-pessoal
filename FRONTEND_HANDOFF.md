# Frontend Handoff & Checklist de Integração (Backend -> Frontend)

Este documento registra as entregas da **Backend AI** (rotas, contratos em `/shared` e comportamentos transacionais) prontas para consumo pela **Frontend AI**.

---

## Status de Entregas

- [x] **Setup Inicial & Contratos Base (`/shared`)**
- [ ] **Módulo 1: Simulados (Preparação, Execução, Pós-Prova e Exportação IA)**
- [x] **Módulo 2: Caderno de Erros (Listagem, Cadastro Manual Restrito e Revisão)**
- [x] **Módulo 3: Temas, Revisão e Conexões Bidirecionais** *(entregue primeiro conforme ordem acordada para o backend)*

---

## Setup Inicial & Contratos Base (`/shared` + Hono / Cloudflare Workers)

### 1. Arquitetura Base, Envelopes HTTP e Autenticação

O Backend BFF roda em **Hono** sobre **Cloudflare Workers (`wrangler`)** com validação estrita por requisição (`c.env`, middlewares Zod e cliente Supabase escopado por JWT do usuário sob RLS).

Todas as rotas da API (`/api/v1/*`) respondem no formato padronizado definido em [`/shared/types/api.types.ts`](./shared/types/api.types.ts):

- **Sucesso (`ApiSuccessResponse<T>`):**
  ```json
  {
    "success": true,
    "data": {},
    "meta": {
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 42,
        "totalPages": 3
      }
    }
  }
  ```
  *(O campo `meta` é omitido em respostas sem paginação).*

- **Erro (`ApiErrorResponse`):**
  ```json
  {
    "success": false,
    "code": "VALIDATION_ERROR",
    "details": [
      {
        "path": "titulo",
        "message": "O título do simulado não pode estar vazio."
      }
    ]
  }
  ```
  *(O campo `details` é retornado em `VALIDATION_ERROR` e `INVALID_JSON` com lista `{ path, message }`).*

- **Autenticação por Requisição:** Rotas protegidas exigem o header `Authorization: Bearer <supabase_access_token>`. O backend instancia o cliente Supabase por requisição aplicando `Authorization: Bearer <token>` e `apikey` para garantir isolamento estrito por `auth.uid() = user_id` (RLS).
- **CORS Estrito:** Validado por requisição contra `CORS_ORIGIN` (`c.env`), permitindo métodos `GET, POST, PUT, PATCH, DELETE, OPTIONS` e headers `Content-Type, Authorization`.
- **Datas:** Todos os timestamps transitam em **UTC (ISO 8601)** (`string`). A conversão para o fuso local e o cálculo de dias sem revisão (`00:00:00` local) ocorrem na camada de visualização.

---

### 2. Catálogo de Códigos de Erro (`ErrorCode`)

Definidos em `ERROR_CODES` no arquivo [`/shared/types/api.types.ts`](./shared/types/api.types.ts) para tradução centralizada em `errorMessages.ts` no Frontend:

| Código (`ErrorCode`) | Status HTTP Típico | Contexto |
| --- | --- | --- |
| `VALIDATION_ERROR` | `400` | Falha de validação Zod (`details` presente com `{ path, message }`) |
| `INVALID_JSON` | `400` | Corpo JSON malformado na requisição |
| `UNAUTHORIZED` | `401` | Token Bearer ausente, inválido ou expirado |
| `FORBIDDEN` | `403` | Violação de política RLS ou acesso negado |
| `NOT_FOUND` | `404` | Rota ou recurso inexistente |
| `CONFLICT` | `409` | Conflito genérico de unicidade |
| `RATE_LIMIT_EXCEEDED` | `429` | Limite de requisições atingido |
| `INTERNAL_SERVER_ERROR` | `500` | Erro interno inesperado (sem exposição de stack trace) |
| `SIMULADO_NOT_FOUND` | `404` | Simulado não encontrado para o usuário autenticado |
| `SIMULADO_INVALID_STATUS_TRANSITION` | `400` / `409` | Transição de status de simulado inválida |
| `SIMULADO_REQUIRES_QUESTAO` | `400` | Operação exige ao menos uma questão cadastrada no simulado |
| `SIMULADO_QUESTAO_NOT_FOUND` | `404` | Questão do simulado não encontrada |
| `SIMULADO_PENSAMENTO_NOT_FOUND` | `404` | Pensamento registrado no simulado não encontrado |
| `SIMULADO_PDF_NOT_FOUND` | `404` | Arquivo PDF do simulado não encontrado |
| `SIMULADO_PDF_INVALID_TYPE` | `400` | Arquivo enviado não é um PDF válido |
| `SIMULADO_PDF_TOO_LARGE` | `413` / `400` | Arquivo PDF excede o tamanho máximo permitido |
| `TEMA_NOT_FOUND` | `404` | Tema não encontrado para o usuário autenticado |
| `TEMA_ALREADY_EXISTS` | `409` | Já existe um tema com o mesmo nome (case-insensitive) |
| `TEMA_INVALID_NAME` | `400` | Nome de tema vazio ou contendo `#` |
| `TEMAS_REQUIRED` | `400` | Operação exige ao menos um tema selecionado |
| `REFLEXAO_NOT_FOUND` | `404` | Reflexão/conexão não encontrada |
| `REFLEXAO_SELF_CONNECTION` | `400` | Tentativa de conectar um tema com ele mesmo |
| `CADERNO_ERRO_NOT_FOUND` | `404` | Item do Caderno de Erros não encontrado |
| `INVALID_MANUAL_ERROR_ORIGIN` | `400` | Origem inválida no cadastro manual (`SIMULADO` é proibido) |
| `INVALID_REVIEW_MODE` | `400` | Modo de revisão diferente de `SOLO` ou `HELP` |
| `INVALID_RESULTADO` | `400` | Resultado de questão diferente de `ACERTEI`, `PARCIAL` ou `ERREI` |

---

### 3. Endpoints Disponíveis nesta Entrega

- **URL local padrão (`npm run dev` via Wrangler):** `http://localhost:3001`

#### `GET /api/v1/health` (Pública)
Verifica a disponibilidade da API BFF em Cloudflare Workers.
- **Resposta `200` (`HealthCheckDto`):**
  ```json
  {
    "success": true,
    "data": {
      "status": "ok",
      "timestamp": "2026-11-10T01:00:00.000Z",
      "runtime": "cloudflare-workers"
    }
  }
  ```

#### `GET /api/v1/auth/me` (Autenticada — `Authorization: Bearer <token>`)
Valida o JWT da sessão no Supabase e retorna os dados básicos do usuário autenticado.
- **Resposta `200` (`AuthUserDto`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "email": "estudante@exemplo.com",
      "role": "authenticated",
      "createdAt": "2026-11-09T20:00:00.000Z",
      "lastSignInAt": "2026-11-10T00:15:00.000Z"
    }
  }
  ```
- **Resposta `401`:** `{ "success": false, "code": "UNAUTHORIZED" }` quando o token estiver ausente, malformado ou inválido.

---

### 4. Catálogo de Tipos, DTOs e Schemas Zod (`/shared`)

Todos os contratos são importáveis de `@shared` (ou caminhos específicos em `/shared/types/*` e `/shared/schemas/*`), sendo `/shared` 100% agnóstico de runtime (apenas TypeScript puro + `zod`).

#### Tipos e DTOs (`/shared/types/`)
- [`database.types.ts`](./shared/types/database.types.ts): Tipagem gerada do Supabase via `npm run db:types` em `/backend`.
- [`api.types.ts`](./shared/types/api.types.ts): `ERROR_CODES`, `ErrorCode`, `PaginationMeta`, `ApiResponseMeta`, `ApiSuccessResponse<T>`, `ApiValidationErrorDetail`, `ApiErrorResponse`, `ApiResponse<T>`.
- [`enums.types.ts`](./shared/types/enums.types.ts):
  - Tipos: `ReviewMode` (`'SOLO' | 'HELP'`), `SimuladoStatus` (`'PREPARACAO' | 'EM_ANDAMENTO' | 'FINALIZADO'`), `QuestaoResultado` (`'ACERTEI' | 'PARCIAL' | 'ERREI'`), `ErroOrigem` (`'SIMULADO' | 'EXTERNAL_LINK' | 'GENERIC_FULL'`), `ManualErrorOrigin` (`'EXTERNAL_LINK' | 'GENERIC_FULL'`), `ErroStatus` (`'PENDENTE' | 'REVISADO'`).
  - Tuplas `as const`: `REVIEW_MODES`, `SIMULADO_STATUSES`, `QUESTAO_RESULTADOS`, `ERRO_ORIGENS`, `MANUAL_ERROR_ORIGINS`, `ERRO_STATUSES`.
- [`auth.types.ts`](./shared/types/auth.types.ts): `AuthUserDto`, `HealthCheckDto` (`status`, `timestamp`, `runtime: 'cloudflare-workers'`).
- [`temas.types.ts`](./shared/types/temas.types.ts): `TemaSortBy`, `TEMA_SORT_OPTIONS`, `TemaSummaryDto`, `TemaDto`, `TemaListItemDto`, `ReflexaoDto`, `TemaDetalheDto`.
- [`simulados.types.ts`](./shared/types/simulados.types.ts): `SimuladoPensamentoDto`, `SimuladoQuestaoDto`, `SimuladoDto`, `SimuladoDetalheDto`, `SimuladoPdfSignedUrlDto`, `SimuladoExportIaDto`.
- [`caderno-erros.types.ts`](./shared/types/caderno-erros.types.ts): `CADERNO_ERRO_SORT_OPTIONS`, `CadernoErroSortBy`, `CadernoErroSimuladoMetaDto`, `CadernoErroDto`.

#### Schemas Zod (`/shared/schemas/`)
- [`common.schema.ts`](./shared/schemas/common.schema.ts): `UuidSchema`, `UuidParamSchema`, `PaginationQuerySchema` (`page` `1..10000`, `limit` `1..100`, `search` max `120`), `HttpUrlSchema` (`trim()` antes de validar URL `http`/`https`, max `2048`).
- [`temas.schema.ts`](./shared/schemas/temas.schema.ts): `TemaNomeSchema` (trim, não vazio, max `80`, proibido `#`), `CreateTemaSchema`, `UpdateTemaSchema`, `TemasQuerySchema` (`page`, `limit`, `search`, `sortBy`, `reviewMode`), `RegistrarPraticaSchema`, `CreateReflexaoSchema` (impede `temaPrincipalId` em `temaConectadoIds`), `UpdateReflexaoSchema`.
- [`simulados.schema.ts`](./shared/schemas/simulados.schema.ts): `CreateSimuladoSchema` (`duracaoConfiguradaSegundos` inteiro `1..86400`), `UpdateSimuladoSchema`, `SimuladosQuerySchema`, `CreateSimuladoQuestaoSchema`, `UpdateSimuladoQuestaoSchema`, `CreateSimuladoPensamentoSchema`, `UpdateSimuladoPensamentoSchema`, `FinalizarSimuladoSchema`, `ClassificarQuestaoSimuladoSchema` (`temaIds` padrão `[]`, rejeita `observacaoPosRevisao` preenchida quando `resultado === 'ACERTEI'` e normaliza para `null`).
- [`caderno-erros.schema.ts`](./shared/schemas/caderno-erros.schema.ts): `CreateManualErrorSchema` (`z.discriminatedUnion('origem', ...)` aceitando **exclusivamente** `EXTERNAL_LINK` — normalizando `titulo: ""` para `undefined` — e `GENERIC_FULL`), `UpdateCadernoErroSchema`, `CadernoErrosQuerySchema` (`page`, `limit`, `search`, `status`, `temaId`, `origem`, `sortBy`), `RevisarCadernoErroSchema`.

---

## Módulo 3: Temas, Revisão e Conexões Bidirecionais

Todas as rotas abaixo exigem autenticação via `Authorization: Bearer <token>` (isolamento multi-usuário estrito por RLS).

### 1. Regras de Negócio & Dicas de UI

- **Cálculo de "Há X dias sem revisar":** `lastReviewedAt` chega em UTC ISO 8601 (`string | null`). Quando `null`, o tema nunca foi revisado. Para calcular os dias sem revisão, o Frontend **deve** normalizar `lastReviewedAt` e a data atual ao início do dia (`00:00:00`) no fuso horário local do usuário (`GEMINI.md` 1.4).
- **Destaque `Com Ajuda` (`HELP`):** Quando `lastReviewMode === 'HELP'`, aplicar exclusivamente o destaque mínimo (`border-l-2 border-l-amber-500/80`) com indicador discreto; quando retornar para `'SOLO'`, remover o destaque (`STYLEGUIDE.md`).
- **Nomenclatura limpa:** Exibir sempre `tema.nome` puro, **nunca** prefixar com `#`.
- **Conexões Bidirecionais sem duplicação:** Uma reflexão com `temasConectados.length === 0` é exibida apenas no Tema Principal em `reflexoesProprias`. Se possuir `1+` temas conectados, aparece automaticamente em `conexoes` tanto no Tema Principal quanto em cada Tema Conectado, sem registros duplicados.
- **Invalidação recomendada no TanStack Query:**
  - Mutação em `/temas` (`POST`, `PATCH`, `DELETE`, `POST /pratica`) ou `/reflexoes` (`POST`, `PATCH`, `DELETE`) deve invalidar a listagem de temas (`['temas']`) e os detalhes (`['temas', temaId]`) de todos os temas afetados (`temaPrincipalId` e `temaConectadoIds`, além de temas anteriores em edições).

---

### 2. Endpoints de Temas (`/api/v1/temas`)

#### `GET /api/v1/temas`
Lista paginada de temas com métricas agregadas para o **1º nível da linha** (Radar de Revisão).

- **Query Params (`TemasQuerySchema`):**
  - `page` *(number, default `1`, `1..10000`)*
  - `limit` *(number, default `20`, `1..100`)*
  - `search` *(string, opcional, max `120`)* — filtro case-insensitive (`ILIKE`) em `nome`
  - `sortBy` *(`'oldest_review' | 'recent_review' | 'name_asc'`, default `'oldest_review'`)*:
    - `'oldest_review'`: `lastReviewedAt ASC NULLS FIRST`, desempate `nome ASC` (nunca revisados aparecem primeiro)
    - `'recent_review'`: `lastReviewedAt DESC NULLS LAST`, desempate `nome ASC`
    - `'name_asc'`: `nome ASC`
  - `reviewMode` *(`'SOLO' | 'HELP'`, opcional)* — filtra por `lastReviewMode`
- **Resposta `200` (`ApiSuccessResponse<TemaListItemDto[]>` com `meta.pagination`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "550e8400-e29b-41d4-a716-446655440001",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "nome": "Dijkstra",
        "lastReviewedAt": "2026-11-08T14:20:00.000Z",
        "lastReviewMode": "SOLO",
        "createdAt": "2026-11-01T10:00:00.000Z",
        "updatedAt": "2026-11-08T14:20:00.000Z",
        "totalReflexoes": 3,
        "totalConexoes": 1,
        "temasConectadosResumo": [
          {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "nome": "BFS",
            "lastReviewedAt": null,
            "lastReviewMode": null
          }
        ]
      }
    ],
    "meta": {
      "pagination": {
        "page": 1,
        "limit": 20,
        "total": 1,
        "totalPages": 1
      }
    }
  }
  ```
  - `totalReflexoes`: total de reflexões distintas vinculadas ao tema (como Tema Principal ou Tema Conectado).
  - `totalConexoes`: total de reflexões com `>= 1` tema conectado vinculadas ao tema.
  - `temasConectadosResumo`: lista deduplicada de temas conectados nas pontes desse tema, ordenada por `nome`.

#### `GET /api/v1/temas/:id`
Retorna os detalhes completos para a **gaveta expansível (2º nível)** do Tema (`TemaDetalheDto`).

- **Params:** `id` (`UUID` do tema)
- **Resposta `200` (`TemaDetalheDto`):**
  ```json
  {
    "success": true,
    "data": {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "userId": "550e8400-e29b-41d4-a716-446655440000",
      "nome": "Dijkstra",
      "lastReviewedAt": "2026-11-08T14:20:00.000Z",
      "lastReviewMode": "SOLO",
      "createdAt": "2026-11-01T10:00:00.000Z",
      "updatedAt": "2026-11-08T14:20:00.000Z",
      "reflexoesProprias": [
        {
          "id": "770e8400-e29b-41d4-a716-446655440010",
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440001",
          "temaPrincipal": {
            "id": "550e8400-e29b-41d4-a716-446655440001",
            "nome": "Dijkstra",
            "lastReviewedAt": "2026-11-08T14:20:00.000Z",
            "lastReviewMode": "SOLO"
          },
          "temasConectados": [],
          "conteudo": "Usar priority queue com pares (dist, vertice) e ignorar estados obsoletos.",
          "createdAt": "2026-11-05T12:00:00.000Z",
          "updatedAt": "2026-11-05T12:00:00.000Z"
        }
      ],
      "conexoes": [
        {
          "id": "770e8400-e29b-41d4-a716-446655440011",
          "userId": "550e8400-e29b-41d4-a716-446655440000",
          "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440002",
          "temaPrincipal": {
            "id": "550e8400-e29b-41d4-a716-446655440002",
            "nome": "BFS",
            "lastReviewedAt": null,
            "lastReviewMode": null
          },
          "temasConectados": [
            {
              "id": "550e8400-e29b-41d4-a716-446655440001",
              "nome": "Dijkstra",
              "lastReviewedAt": "2026-11-08T14:20:00.000Z",
              "lastReviewMode": "SOLO"
            }
          ],
          "conteudo": "BFS resolve peso uniforme (1); pesos 0/1 pedem 0-1 BFS; pesos não-negativos pedem Dijkstra.",
          "createdAt": "2026-11-06T12:00:00.000Z",
          "updatedAt": "2026-11-06T12:00:00.000Z"
        }
      ],
      "totalErrosPendentes": 2,
      "totalErrosRevisados": 4
    }
  }
  ```
- **Erros:** `404 TEMA_NOT_FOUND` (tema inexistente ou de outro usuário).

#### `POST /api/v1/temas`
Cria um novo tema para o usuário autenticado.

- **Body (`CreateTemaSchema`):** `{ "nome": "Programação Dinâmica" }` (trim, `1..80` chars, proibido `#`)
- **Resposta `201`:** `ApiSuccessResponse<TemaListItemDto>` (com `totalReflexoes: 0`, `totalConexoes: 0`, `temasConectadosResumo: []`)
- **Erros:** `400 VALIDATION_ERROR`, `409 TEMA_ALREADY_EXISTS` (unicidade case-insensitive por usuário), `400 TEMA_INVALID_NAME`.

#### `PATCH /api/v1/temas/:id`
Atualiza o nome do tema.

- **Params:** `id` (`UUID`)
- **Body (`UpdateTemaSchema`):** `{ "nome": "Grafos - Dijkstra" }`
- **Resposta `200`:** `ApiSuccessResponse<TemaDto>`
- **Erros:** `404 TEMA_NOT_FOUND`, `409 TEMA_ALREADY_EXISTS`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/temas/:id`
Exclui o tema (e remove por cascata reflexões em que ele for Tema Principal e vínculos em tabelas associativas).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **Erros:** `404 TEMA_NOT_FOUND`.

#### `POST /api/v1/temas/pratica`
Registra prática/revisão avulsa diretamente para um ou mais temas via RPC transacional **`rpc_registrar_pratica_temas`**.

- **Body (`RegistrarPraticaSchema`):**
  ```json
  {
    "temaIds": ["550e8400-e29b-41d4-a716-446655440001"],
    "reviewMode": "SOLO"
  }
  ```
  - `temaIds`: array não vazio (deduplicado automaticamente, `1..50` itens)
  - `reviewMode`: `'SOLO' | 'HELP'`
- **Comportamento:** Atualiza atomicamente `last_reviewed_at = now()` e `last_review_mode` para todos os temas informados. Se qualquer tema não existir para o usuário, toda a operação falha sem atualizar nenhum tema.
- **Resposta `200`:** `ApiSuccessResponse<TemaDto[]>` (ordenados por `nome`)
- **Erros:** `400 VALIDATION_ERROR`, `404 TEMA_NOT_FOUND`.

---

### 3. Endpoints de Reflexões e Conexões (`/api/v1/reflexoes`)

#### `GET /api/v1/reflexoes/:id`
Busca uma reflexão/conexão por ID.

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<ReflexaoDto>`
- **Erros:** `404 REFLEXAO_NOT_FOUND`.

#### `POST /api/v1/reflexoes`
Cria uma reflexão própria (`temaConectadoIds: []`) ou uma conexão bidirecional (`temaConectadoIds: [...]`).

- **Body (`CreateReflexaoSchema`):**
  ```json
  {
    "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440001",
    "temaConectadoIds": ["550e8400-e29b-41d4-a716-446655440002"],
    "conteudo": "Relação entre Dijkstra e BFS."
  }
  ```
  - `temaConectadoIds` *(opcional, default `[]`, max `30` — deduplicado pelo backend)*
  - `conteudo`: string não vazia após trim (`1..5000` chars)
- **Validações:**
  - Rejeita `temaPrincipalId` incluído em `temaConectadoIds` (`400 VALIDATION_ERROR` no schema Zod / `400 REFLEXAO_SELF_CONNECTION` no serviço).
  - Pré-valida existência de `temaPrincipalId` e de todos os `temaConectadoIds` para o usuário (`404 TEMA_NOT_FOUND`).
  - Executa rollback compensatório removendo a reflexão criada caso falhe a gravação dos vínculos em `reflexao_temas_conectados`.
- **Resposta `201`:** `ApiSuccessResponse<ReflexaoDto>`

#### `PATCH /api/v1/reflexoes/:id`
Atualiza parcialmente conteúdo, tema principal e/ou temas conectados da reflexão.

- **Params:** `id` (`UUID`)
- **Body (`UpdateReflexaoSchema`):** ao menos 1 dos campos:
  ```json
  {
    "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440001",
    "temaConectadoIds": ["550e8400-e29b-41d4-a716-446655440003"],
    "conteudo": "Texto atualizado da reflexão."
  }
  ```
- **Comportamento:**
  - Faz *merge* entre o estado atual salvo no banco e os campos enviados na requisição.
  - Se o estado resultante colocar `temaPrincipalId` dentro de `temaConectadoIds` (ex.: atualização apenas de `temaPrincipalId` ou apenas de `temaConectadoIds`), retorna `400 REFLEXAO_SELF_CONNECTION` (`400 VALIDATION_ERROR` se ambos conflitarem no próprio payload).
  - Pré-valida todos os `temaIds` resultantes (`404 TEMA_NOT_FOUND`) e sincroniza `reflexao_temas_conectados` por diff seguro (inserindo novos / removendo retirados) com rollback compensatório.
- **Resposta `200`:** `ApiSuccessResponse<ReflexaoDto>`
- **Erros:** `404 REFLEXAO_NOT_FOUND`, `404 TEMA_NOT_FOUND`, `400 REFLEXAO_SELF_CONNECTION`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/reflexoes/:id`
Exclui uma reflexão/conexão (removendo por cascata os vínculos em `reflexao_temas_conectados`).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **Erros:** `404 REFLEXAO_NOT_FOUND`.

---

## Módulo 2: Caderno de Erros (Listagem, Cadastro Manual Restrito e Revisão)

Todas as rotas abaixo exigem autenticação via `Authorization: Bearer <token>` (isolamento multi-usuário estrito por RLS).

### 1. Regras de Negócio & Dicas de UI

- **Restrição de Origem no Cadastro Manual (`GEMINI.md` 3.3):** O formulário de cadastro manual aceita **exclusivamente** `'EXTERNAL_LINK'` (questão externa com `codigoReferencia` + `linkExterno`) e `'GENERIC_FULL'` (questão avulsa com `titulo` + `enunciadoCompleto`). A origem `'SIMULADO'` é gerada apenas automaticamente pelo fluxo pós-simulado e **nunca** pode ser enviada no cadastro manual (`CreateManualErrorSchema` / `INVALID_MANUAL_ERROR_ORIGIN`).
- **Acoplamento com Última Revisão dos Temas (`GEMINI.md` 3.1):**
  - Cadastrar um erro (`POST /caderno-erros`), editar (`PATCH /caderno-erros/:id`), devolver para pendentes (`POST /caderno-erros/:id/devolver`) ou excluir (`DELETE /caderno-erros/:id`) **JAMAIS** atualiza `lastReviewedAt` ou `lastReviewMode` dos temas vinculados.
  - Somente **`POST /api/v1/caderno-erros/:id/revisar`** (`SOLO` ou `HELP`) atualiza atomicamente o status do erro para `'REVISADO'` e atualiza `lastReviewedAt` + `lastReviewMode` em todos os temas vinculados.
- **Destaque `Com Ajuda` (`HELP`) e Abas (`STYLEGUIDE.md`):**
  - Itens com `status === 'PENDENTE'` vão para a aba *Pendentes*; itens com `status === 'REVISADO'` vão para a aba *Já Revisados*.
  - Na aba *Já Revisados*, itens com `lastReviewMode === 'HELP'` devem receber apenas o destaque mínimo (`border-l-2 border-l-amber-500/80`) e podem ser remarcados como `SOLO` (`POST /revisar`) ou devolvidos (`POST /devolver`).
- **Invalidação Obrigatória no TanStack Query:**
  - Toda mutação em `/caderno-erros` (`POST`, `PATCH`, `DELETE`, `POST /revisar`, `POST /devolver`) **deve invalidar** `['caderno-erros']` **e** `['temas']` (lista e detalhes dos temas afetados), pois alterações afetam `lastReviewedAt`/`lastReviewMode` (via `revisar`) e os contadores `totalErrosPendentes` / `totalErrosRevisados` exibidos na gaveta dos temas.

---

### 2. Endpoints (`/api/v1/caderno-erros`)

#### `GET /api/v1/caderno-erros`
Lista paginada de registros do Caderno de Erros para o **1º e 2º níveis** (linha fechada + gaveta expansível).

- **Query Params (`CadernoErrosQuerySchema`):**
  - `page` *(number, default `1`, `1..10000`)*
  - `limit` *(number, default `20`, `1..100`)*
  - `status` *(`'PENDENTE' | 'REVISADO'`, opcional)*
  - `temaId` *(UUID, opcional)* — filtra registros vinculados ao tema **preservando todos os demais temas** no array `temas` de cada `CadernoErroDto`.
  - `origem` *(`'SIMULADO' | 'EXTERNAL_LINK' | 'GENERIC_FULL'`, opcional)*
  - `search` *(string, opcional, max `120`)* — busca case-insensitive (`ILIKE`) em `titulo`, `codigoReferencia`, `enunciadoCompleto` e `observacaoErro` (com sanitização segura para sintaxe `.or()` do PostgREST).
  - `sortBy` *(`'recent' | 'oldest'`, default `'recent'`)* — ordenação por `createdAt DESC, id ASC` (`'recent'`) ou `createdAt ASC, id ASC` (`'oldest'`).
- **Resposta `200` (`ApiSuccessResponse<CadernoErroDto[]>` com `meta.pagination`):**
  - `temas`: lista deduplicada de `TemaSummaryDto` ordenada alfabeticamente por `nome` (`pt-BR`).
  - `simuladoMeta`: `null` para erros manuais (`EXTERNAL_LINK` / `GENERIC_FULL`), ou objeto hidratado quando `origem === 'SIMULADO'`.

**Exemplo de `CadernoErroDto` — Origem `SIMULADO`:**
```json
{
  "id": "880e8400-e29b-41d4-a716-446655440010",
  "userId": "550e8400-e29b-41d4-a716-446655440000",
  "origem": "SIMULADO",
  "status": "PENDENTE",
  "simuladoQuestaoId": "990e8400-e29b-41d4-a716-446655440020",
  "codigoReferencia": null,
  "titulo": "Caminho Mínimo com Pedágios",
  "enunciadoCompleto": null,
  "linkExterno": null,
  "observacaoErro": "Esqueci de modelar os estados por (vertice, cupons_usados).",
  "lastReviewedAt": null,
  "lastReviewMode": null,
  "temas": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440001",
      "nome": "Dijkstra",
      "lastReviewedAt": "2026-11-08T14:20:00.000Z",
      "lastReviewMode": "SOLO"
    }
  ],
  "simuladoMeta": {
    "simuladoId": "660e8400-e29b-41d4-a716-446655440030",
    "simuladoTitulo": "OBI 2024 Fase 2",
    "simuladoQuestaoId": "990e8400-e29b-41d4-a716-446655440020",
    "numeroQuestao": "Q2",
    "tituloQuestao": "Caminho Mínimo com Pedágios",
    "resultado": "PARCIAL",
    "pensamentos": [
      {
        "id": "770e8400-e29b-41d4-a716-446655440040",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "simuladoQuestaoId": "990e8400-e29b-41d4-a716-446655440020",
        "descricao": "Tentei Dijkstra simples, mas o desconto muda a subestrutura ótima.",
        "tempoDecorridoSegundos": 1840,
        "createdAt": "2026-11-08T13:30:40.000Z",
        "updatedAt": "2026-11-08T13:30:40.000Z"
      }
    ]
  },
  "createdAt": "2026-11-08T14:20:00.000Z",
  "updatedAt": "2026-11-08T14:20:00.000Z"
}
```
*(Em `simuladoMeta.pensamentos`, os pensamentos vêm em ordem cronológica: `createdAt ASC`, desempate `tempoDecorridoSegundos ASC NULLS LAST`, `id ASC`).*

#### `GET /api/v1/caderno-erros/:id`
Retorna os detalhes hidratados de um registro do Caderno de Erros.

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<CadernoErroDto>`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`.

#### `POST /api/v1/caderno-erros`
Cadastra manualmente uma questão externa (`EXTERNAL_LINK`) ou questão genérica completa (`GENERIC_FULL`). Nasce sempre com `status: 'PENDENTE'`, `lastReviewedAt: null`, `lastReviewMode: null`, sem alterar a última revisão dos temas vinculados.

- **Body (`CreateManualErrorSchema` — discriminado por `origem`):**
  - **Opção 1 — `EXTERNAL_LINK`:**
    ```json
    {
      "origem": "EXTERNAL_LINK",
      "codigoReferencia": "CF 1900C",
      "linkExterno": "https://codeforces.com/problemset/problem/1900/C",
      "titulo": "Anji's Binary Tree",
      "temaIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "observacaoErro": "Confundi caso base em folhas sem filhos."
    }
    ```
    *(O campo `titulo` é opcional; quando omitido ou `""`, o backend preenche automaticamente com `codigoReferencia`).*
  - **Opção 2 — `GENERIC_FULL`:**
    ```json
    {
      "origem": "GENERIC_FULL",
      "titulo": "Questão de Eletrodinâmica - Ponte de Wheatstone",
      "enunciadoCompleto": "Determine a resistência equivalente entre A e B sabendo que a ponte está em equilíbrio...",
      "linkExterno": "",
      "temaIds": ["550e8400-e29b-41d4-a716-446655440001"],
      "observacaoErro": "Esqueci que não passa corrente pelo resistor central."
    }
    ```
    *(Para `GENERIC_FULL`, `linkExterno` é opcional e `""` é normalizado para `null`).*
- **Resposta `201`:** `ApiSuccessResponse<CadernoErroDto>` (`simuladoMeta: null`)
- **Erros:** `400 VALIDATION_ERROR`, `400 INVALID_MANUAL_ERROR_ORIGIN` (no domínio caso `origem === 'SIMULADO'`), `404 TEMA_NOT_FOUND`.

#### `PATCH /api/v1/caderno-erros/:id`
Atualiza um registro do Caderno de Erros respeitando restrições estritas por `origem`:

- **Params:** `id` (`UUID`)
- **Body (`UpdateCadernoErroSchema` — ao menos 1 campo):** `codigoReferencia`, `titulo`, `enunciadoCompleto`, `linkExterno`, `observacaoErro`, `temaIds`.
- **Regras por Origem do Registro:**
  - **`SIMULADO`:** aceita **apenas** `observacaoErro` e `temaIds` (`>= 1` tema). Tentativa de enviar `codigoReferencia`, `titulo`, `enunciadoCompleto` ou `linkExterno` retorna `400 VALIDATION_ERROR` com `details` indicando os campos bloqueados.
  - **`EXTERNAL_LINK`:** aceita `codigoReferencia`, `linkExterno`, `titulo` (mantém atual se omitido; não pode ficar vazio), `observacaoErro` e `temaIds`. Rejeita `enunciadoCompleto` não nulo e garante estado resultante válido (`codigoReferencia` e `linkExterno` presentes) via `400 VALIDATION_ERROR`.
  - **`GENERIC_FULL`:** aceita `titulo`, `enunciadoCompleto`, `linkExterno`, `observacaoErro` e `temaIds`. Garante que `titulo` e `enunciadoCompleto` permaneçam não vazios e rejeita `codigoReferencia` não nulo via `400 VALIDATION_ERROR`.
- **Sincronização:** `temaIds` é pré-validado (`404 TEMA_NOT_FOUND`) e sincronizado por diff seguro em `caderno_erro_temas` com rollback compensatório.
- **Resposta `200`:** `ApiSuccessResponse<CadernoErroDto>`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`, `404 TEMA_NOT_FOUND`, `400 VALIDATION_ERROR`.

#### `POST /api/v1/caderno-erros/:id/revisar`
Conclui a revisão de um erro (ou atualiza o modo de revisão de um item já revisado, ex.: `HELP` → `SOLO`) invocando a RPC atômica **`rpc_concluir_revisao_erro`**. Atualiza o erro para `status: 'REVISADO'` e atualiza `lastReviewedAt` + `lastReviewMode` em **todos os temas vinculados**.

- **Params:** `id` (`UUID`)
- **Body (`RevisarCadernoErroSchema`):**
  ```json
  {
    "reviewMode": "SOLO"
  }
  ```
  - `SOLO`: botão **Finalizado Sozinho**
  - `HELP`: botão **Com Ajuda**
- **Resposta `200`:** `ApiSuccessResponse<CadernoErroDto>`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`, `400 VALIDATION_ERROR`.

#### `POST /api/v1/caderno-erros/:id/devolver`
Devolve um erro revisado para a aba de pendentes invocando a RPC atômica **`rpc_devolver_erro_para_pendente`** (`status = 'PENDENTE'`), preservando os metadados históricos (`lastReviewedAt` e `lastReviewMode`).

- **Params:** `id` (`UUID`)
- **Body:** nenhum
- **Resposta `200`:** `ApiSuccessResponse<CadernoErroDto>`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`.

#### `DELETE /api/v1/caderno-erros/:id`
Exclui um registro do Caderno de Erros (e seus vínculos em `caderno_erro_temas` por cascata).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`.
