# Frontend Handoff & Checklist de Integração (Backend -> Frontend)

Este documento registra as entregas da **Backend AI** (rotas, contratos em `/shared` e comportamentos transacionais) prontas para consumo pela **Frontend AI**.

---

## Status de Entregas

- [x] **Setup Inicial & Contratos Base (`/shared`)**
- [x] **Módulo 1: Simulados (Preparação, Execução, Pós-Prova e Exportação IA)**
- [x] **Módulo 2: Caderno de Erros (Listagem, Cadastro Manual Restrito e Revisão)**
- [x] **Módulo 3: Temas, Revisão e Conexões Bidirecionais** *(entregue primeiro conforme ordem acordada para o backend)*
- [x] **Módulo 4: Lousas Universal (`/api/v1/lousas`) e Integração em Temas/Reflexões, Caderno de Erros e Cascata de Simulados**

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
| `LOUSA_NOT_FOUND` | `404` | Lousa ou arquivo no Storage (`lousas-private`) não encontrado |
| `LOUSA_TOO_LARGE` | `413` | Tamanho somado (`scene + preview`) excede `LOUSA_MAX_TOTAL_SIZE_BYTES` (`3 MiB` / `3145728` bytes) |
| `LOUSA_INVALID_PAYLOAD` | `400` | Multipart ausente/malformado, JSON da cena sem `elements`, MIME inválido ou magic bytes divergentes |
| `LOUSA_ALREADY_IN_USE` | `409` | Tentativa de vincular uma lousa já associada a outra reflexão ou item do caderno de erros |
| `LOUSA_IN_USE` | `409` | Tentativa de excluir diretamente (`DELETE /api/v1/lousas/:id`) uma lousa que ainda está vinculada |

> **Atenção Frontend (`errorMessages.ts`):** Os 5 códigos `LOUSA_*` foram adicionados a `ERROR_CODES` (`ErrorCode`). É necessário mapear essas chaves em `frontend/src/lib/errorMessages.ts` e incluir `lousaId: null, lousa: null` nos mocks de `ReflexaoDto` e `CadernoErroDto` nos testes do Frontend (`DrawersStickyCollapse.test.tsx`, `ListUpdatingTransitions.test.tsx`, `reflexoes.test.ts`).

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
- [`temas.types.ts`](./shared/types/temas.types.ts): `TemaSortBy`, `TEMA_SORT_OPTIONS`, `TemaSummaryDto`, `TemaDto`, `TemaListItemDto`, `ReflexaoDto` (`conteudo: string | null`, `lousaId: string | null`, `lousa: LousaSummaryDto | null`), `TemaDetalheDto`.
- [`simulados.types.ts`](./shared/types/simulados.types.ts): `SIMULADO_SORT_OPTIONS`, `SimuladoSortBy`, `SIMULADO_PDF_MAX_SIZE_BYTES` (`20 MiB`), `SIMULADO_PDF_SIGNED_URL_TTL_SECONDS` (`3600`), `SimuladoPensamentoDto`, `SimuladoQuestaoDto`, `SimuladoDto`, `SimuladoListItemDto`, `SimuladoDetalheDto`, `SimuladoPdfSignedUrlDto`, `SimuladoExportIaDto`.
- [`caderno-erros.types.ts`](./shared/types/caderno-erros.types.ts): `CADERNO_ERRO_SORT_OPTIONS`, `CadernoErroSortBy`, `CadernoErroSimuladoMetaDto`, `CadernoErroDto` (`lousaId: string | null`, `lousa: LousaSummaryDto | null`).
- [`lousas.types.ts`](./shared/types/lousas.types.ts): `LOUSA_MAX_TOTAL_SIZE_BYTES` (`3 MiB` / `3145728`), `LOUSA_SIGNED_URL_TTL_SECONDS` (`3600`), `LOUSA_PREVIEW_MIME_TYPES` (`['image/webp', 'image/png']`), `LousaPreviewMimeType`, `LousaSummaryDto`, `LousaDto`, `LousaSignedUrlsDto`.

#### Schemas Zod (`/shared/schemas/`)
- [`common.schema.ts`](./shared/schemas/common.schema.ts): `UuidSchema`, `UuidParamSchema`, `PaginationQuerySchema` (`page` `1..10000`, `limit` `1..100`, `search` max `120`), `HttpUrlSchema` (`trim()` antes de validar URL `http`/`https`, max `2048`).
- [`temas.schema.ts`](./shared/schemas/temas.schema.ts): `TemaNomeSchema` (trim, não vazio, max `80`, proibido `#`), `CreateTemaSchema`, `UpdateTemaSchema`, `TemasQuerySchema` (`page`, `limit`, `search`, `sortBy`, `reviewMode`), `RegistrarPraticaSchema`, `CreateReflexaoSchema` (permite `conteudo` nulo/vazio quando `lousaId` presente, rejeita `conteudo: null` + `lousaId: null` e impede `temaPrincipalId` em `temaConectadoIds`), `UpdateReflexaoSchema` (suporta `lousaId?: string | null` e `conteudo?: string | null`).
- [`simulados.schema.ts`](./shared/schemas/simulados.schema.ts): `CreateSimuladoSchema` (`duracaoConfiguradaSegundos` inteiro `1..86400`), `UpdateSimuladoSchema`, `SimuladosQuerySchema` (`page`, `limit`, `search`, `status`, `sortBy`), `SimuladoQuestaoParamsSchema`, `SimuladoPensamentoParamsSchema`, `CreateSimuladoQuestaoSchema`, `UpdateSimuladoQuestaoSchema`, `CreateSimuladoPensamentoSchema`, `UpdateSimuladoPensamentoSchema`, `FinalizarSimuladoSchema`, `ClassificarQuestaoSimuladoSchema` (`temaIds` padrão `[]`, rejeita `observacaoPosRevisao` preenchida quando `resultado === 'ACERTEI'` e normaliza para `null`).
- [`caderno-erros.schema.ts`](./shared/schemas/caderno-erros.schema.ts): `CreateManualErrorSchema` (`z.discriminatedUnion('origem', ...)` aceitando **exclusivamente** `EXTERNAL_LINK` — normalizando `titulo: ""` para `undefined` — e `GENERIC_FULL`, ambos com `lousaId?: string | null`), `UpdateCadernoErroSchema` (`lousaId?: string | null` suportado nas 3 origens), `CadernoErrosQuerySchema` (`page`, `limit`, `search`, `status`, `temaId`, `origem`, `sortBy`), `RevisarCadernoErroSchema`.
- [`lousas.schema.ts`](./shared/schemas/lousas.schema.ts): `LousaPreviewMimeSchema`, `LousaParamSchema`, `LousaSceneSchema` (`elements` array obrigatório + `type?: 'excalidraw'`), `LousaParamInput`, `LousaScenePayload`.

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

> **Performance e Lousas:** `GET /api/v1/temas` **não** gera URLs assinadas de lousas para evitar gargalo de listagem. Já `GET /api/v1/temas/:id`, `GET /api/v1/reflexoes/:id`, `POST /api/v1/reflexoes` e `PATCH /api/v1/reflexoes/:id` hidratam `lousa.previewSignedUrl` em lote (`createSignedUrls`, TTL 3600s).

#### `GET /api/v1/reflexoes/:id`
Busca uma reflexão/conexão por ID (incluindo `lousa` com `previewSignedUrl` assinada).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<ReflexaoDto>`
- **Erros:** `404 REFLEXAO_NOT_FOUND`.

#### `POST /api/v1/reflexoes`
Cria uma reflexão própria (`temaConectadoIds: []`) ou uma conexão bidirecional (`temaConectadoIds: [...]`), aceitando texto (`conteudo`), lousa (`lousaId`), ou ambos.

- **Body (`CreateReflexaoSchema`):**
  ```json
  {
    "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440001",
    "temaConectadoIds": ["550e8400-e29b-41d4-a716-446655440002"],
    "conteudo": "Relação entre Dijkstra e BFS.",
    "lousaId": "770e8400-e29b-41d4-a716-446655440099"
  }
  ```
  - `temaConectadoIds` *(opcional, default `[]`, max `30` — deduplicado pelo backend)*
  - `conteudo`: string opcional/nullable (`1..5000` chars após trim; strings em branco são normalizadas para `null`)
  - `lousaId`: UUID opcional/nullable; pelo menos um entre `conteudo` e `lousaId` deve estar preenchido.
- **Validações:**
  - Rejeita `temaPrincipalId` incluído em `temaConectadoIds` (`400 VALIDATION_ERROR` no schema Zod / `400 REFLEXAO_SELF_CONNECTION` no serviço).
  - Rejeita `conteudo: null` simultâneo com `lousaId: null` (`400 VALIDATION_ERROR`).
  - Pré-valida existência de `temaPrincipalId`, `temaConectadoIds` (`404 TEMA_NOT_FOUND`) e disponibilidade exclusiva de `lousaId` (`404 LOUSA_NOT_FOUND` ou `409 LOUSA_ALREADY_IN_USE`).
  - Executa rollback compensatório removendo a reflexão criada caso falhe a gravação dos vínculos em `reflexao_temas_conectados`.
- **Resposta `201`:** `ApiSuccessResponse<ReflexaoDto>`

#### `PATCH /api/v1/reflexoes/:id`
Atualiza parcialmente conteúdo, `lousaId` (incluindo vincular, trocar ou remover passando `null`), tema principal e/ou temas conectados da reflexão.

- **Params:** `id` (`UUID`)
- **Body (`UpdateReflexaoSchema`):** ao menos 1 dos campos:
  ```json
  {
    "temaPrincipalId": "550e8400-e29b-41d4-a716-446655440001",
    "temaConectadoIds": ["550e8400-e29b-41d4-a716-446655440003"],
    "conteudo": "Texto atualizado da reflexão.",
    "lousaId": null
  }
  ```
- **Comportamento:**
  - Faz *merge* entre o estado atual salvo no banco e os campos enviados na requisição (envio explícito de `conteudo: ""` converte para `null`; omitir `conteudo` preserva o valor atual).
  - Garante que o estado resultante mantenha ao menos `conteudo` ou `lousaId` preenchido (`400 VALIDATION_ERROR`).
  - Se trocar ou desvincular `lousaId`, o trigger de banco remove a lousa órfã e o backend remove os objetos antigos do Storage em *best-effort*.
  - Se o estado resultante colocar `temaPrincipalId` dentro de `temaConectadoIds`, retorna `400 REFLEXAO_SELF_CONNECTION`.
  - Pré-valida todos os `temaIds` resultantes (`404 TEMA_NOT_FOUND`) e `lousaId` alterado (`404 LOUSA_NOT_FOUND` / `409 LOUSA_ALREADY_IN_USE`).
- **Resposta `200`:** `ApiSuccessResponse<ReflexaoDto>`
- **Erros:** `404 REFLEXAO_NOT_FOUND`, `404 TEMA_NOT_FOUND`, `404 LOUSA_NOT_FOUND`, `409 LOUSA_ALREADY_IN_USE`, `400 REFLEXAO_SELF_CONNECTION`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/reflexoes/:id`
Exclui uma reflexão/conexão (removendo por cascata vínculos em `reflexao_temas_conectados`, a lousa órfã via trigger e os arquivos da lousa no Storage em *best-effort*).

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
    *(Para `GENERIC_FULL`, `linkExterno` é opcional e `""` é normalizado para `null`. Ambos os formulários aceitam `lousaId?: string | null` opcional).*
- **Resposta `201`:** `ApiSuccessResponse<CadernoErroDto>` (`simuladoMeta: null`, com `lousa` hidratada quando vinculada)
- **Erros:** `400 VALIDATION_ERROR`, `400 INVALID_MANUAL_ERROR_ORIGIN` (no domínio caso `origem === 'SIMULADO'`), `404 TEMA_NOT_FOUND`, `404 LOUSA_NOT_FOUND`, `409 LOUSA_ALREADY_IN_USE`.

#### `PATCH /api/v1/caderno-erros/:id`
Atualiza um registro do Caderno de Erros respeitando restrições estritas por `origem`:

- **Params:** `id` (`UUID`)
- **Body (`UpdateCadernoErroSchema` — ao menos 1 campo):** `codigoReferencia`, `titulo`, `enunciadoCompleto`, `linkExterno`, `observacaoErro`, `temaIds`, `lousaId`.
- **Regras por Origem do Registro:**
  - **`SIMULADO`:** aceita `observacaoErro`, `temaIds` (`>= 1` tema) e **`lousaId`** (`string | null`). Tentativa de enviar `codigoReferencia`, `titulo`, `enunciadoCompleto` ou `linkExterno` retorna `400 VALIDATION_ERROR` com `details` indicando os campos bloqueados.
  - **`EXTERNAL_LINK`:** aceita `codigoReferencia`, `linkExterno`, `titulo` (mantém atual se omitido; não pode ficar vazio), `observacaoErro`, `temaIds` e `lousaId`. Rejeita `enunciadoCompleto` não nulo e garante estado resultante válido (`codigoReferencia` e `linkExterno` presentes) via `400 VALIDATION_ERROR`.
  - **`GENERIC_FULL`:** aceita `titulo`, `enunciadoCompleto`, `linkExterno`, `observacaoErro`, `temaIds` e `lousaId`. Garante que `titulo` e `enunciadoCompleto` permaneçam não vazios e rejeita `codigoReferencia` não nulo via `400 VALIDATION_ERROR`.
- **Lousa e Sincronização:** `lousaId` alterado é validado (`404 LOUSA_NOT_FOUND` / `409 LOUSA_ALREADY_IN_USE`), e troca/remoção dispara limpeza dos arquivos antigos no Storage; `temaIds` é pré-validado (`404 TEMA_NOT_FOUND`) e sincronizado por diff seguro em `caderno_erro_temas`. Listagens (`GET /caderno-erros`), detalhe, `revisar` e `devolver` retornam `lousa.previewSignedUrl` hidratada em 1 lote.
- **Resposta `200`:** `ApiSuccessResponse<CadernoErroDto>`
- **Erros:** `404 CADERNO_ERRO_NOT_FOUND`, `404 TEMA_NOT_FOUND`, `404 LOUSA_NOT_FOUND`, `409 LOUSA_ALREADY_IN_USE`, `400 VALIDATION_ERROR`.

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

---

## Módulo 1: Simulados (Preparação, Execução, Pós-Prova e Exportação IA)

Todas as rotas abaixo exigem autenticação via `Authorization: Bearer <token>` (isolamento multi-usuário estrito por RLS, inclusive no bucket privado `simulado-pdfs`).

### 1. Regras de Negócio & Dicas de UI

- **Máquina de Estados Estrita (`PREPARACAO` → `EM_ANDAMENTO` → `FINALIZADO`):**
  - Em **`PREPARACAO`**: edição completa (`titulo`, `duracaoConfiguradaSegundos`), upload/substituição/remoção de PDF e CRUD inline de questões; exige ao menos `1` questão para iniciar (`400 SIMULADO_REQUIRES_QUESTAO`).
  - Em **`EM_ANDAMENTO`**: bloqueia edição de metadados do simulado (`PATCH /simulados/:id`), alterações de PDF e alterações de questões (`409 SIMULADO_INVALID_STATUS_TRANSITION`); libera criação, edição e exclusão de pensamentos em tempo real.
  - Em **`FINALIZADO`**: permite editar apenas `titulo` em `PATCH /simulados/:id` (alterar `duracaoConfiguradaSegundos` retorna `409`), editar/excluir pensamentos pós-prova, classificar questões e gerar exportação Markdown para IA.
- **Blindagem da Execução de Prova (`GEMINI.md` 6):**
  - **Cronômetro Resiliente:** `startedAt` (UTC ISO 8601) + `duracaoConfiguradaSegundos` vêm persistidos do backend; o Frontend deve calcular o restante via timestamp real (`startedAt + duracaoConfiguradaSegundos - now`) para resistir a `F5` ou fechamento da aba.
  - **PDF Isolado (`React.memo`):** `GET /simulados/:id` já retorna `pdfSignedUrl` (TTL `3600s` = `SIMULADO_PDF_SIGNED_URL_TTL_SECONDS`). Para provas longas (> 1h), renove a URL usando `GET /api/v1/simulados/:id/pdf-url` sem desmontar o visualizador.
- **Upload de PDF (`POST /api/v1/simulados/:id/pdf`):**
  - Envie `multipart/form-data` com campo `file` (`File`), sem definir `Content-Type` manualmente no `fetch` (deixe o browser gerar o `boundary`).
  - Tamanho máximo **`20 MiB`** (`SIMULADO_PDF_MAX_SIZE_BYTES`); validação server-side de MIME + magic bytes `%PDF-`.
- **Acoplamento Pós-Prova (`classificar` — `GEMINI.md` 3.1 e 3.2):**
  - **`ACERTEI`:** exige `observacaoPosRevisao` vazia/`null`; atualiza `lastReviewedAt = now` e `lastReviewMode = 'SOLO'` em todos os `temaIds` vinculados (quando `temaIds.length > 0`), **remove** eventual registro prévio daquela questão no Caderno de Erros e limpa os arquivos no Storage de eventual lousa vinculada ao erro removido.
  - **`PARCIAL` ou `ERREI`:** permite `observacaoPosRevisao`; faz upsert atômico em `caderno_erros` (`origem: 'SIMULADO'`, `status: 'PENDENTE'`) e **NÃO** altera `lastReviewedAt`/`lastReviewMode` dos temas vinculados.
- **Invalidação Obrigatória no TanStack Query:**
  - Mutações em simulados/questões/pensamentos/PDF devem invalidar `['simulados']` e `['simulados', simuladoId]`.
  - Mutações em `POST /simulados/:id/questoes/:questaoId/classificar` **devem invalidar** `['simulados']`, `['simulados', simuladoId]`, **`['caderno-erros']`** e **`['temas']`**.
  - Mutações em `DELETE /simulados/:id` também devem invalidar **`['caderno-erros']`** (a exclusão remove em cascata erros originados do simulado e limpa suas eventuais lousas no Storage; o mesmo vale para `DELETE /simulados/:id/questoes/:questaoId`).

---

### 2. Endpoints — Recurso Principal (`/api/v1/simulados`)

#### `GET /api/v1/simulados`
Lista paginada para o **1º nível** (cartões/linhas de simulados) com métricas agregadas calculadas em batch sem queries N+1 e **sem** gerar `pdfSignedUrl`.

- **Query Params (`SimuladosQuerySchema`):**
  - `page` *(number, default `1`, `1..10000`)*
  - `limit` *(number, default `20`, `1..100`)*
  - `status` *(`'PREPARACAO' | 'EM_ANDAMENTO' | 'FINALIZADO'`, opcional)*
  - `search` *(string, opcional, max `120`)* — filtro case-insensitive (`ILIKE`) em `titulo`.
  - `sortBy` *(`'recent' | 'oldest'`, default `'recent'`)* — `createdAt DESC, id ASC` (`'recent'`) ou `createdAt ASC, id ASC` (`'oldest'`).
- **Resposta `200` (`ApiSuccessResponse<SimuladoListItemDto[]>` com `meta.pagination`):**
  ```json
  {
    "success": true,
    "data": [
      {
        "id": "660e8400-e29b-41d4-a716-446655440030",
        "userId": "550e8400-e29b-41d4-a716-446655440000",
        "titulo": "OBI 2024 Fase 2 - Turno B",
        "duracaoConfiguradaSegundos": 14400,
        "tempoGastoSegundos": 12310,
        "pdfStoragePath": "550e8400.../simulados/660e8400.../prova.pdf",
        "hasPdf": true,
        "status": "FINALIZADO",
        "startedAt": "2026-11-10T14:00:00.000Z",
        "finishedAt": "2026-11-10T17:25:10.000Z",
        "createdAt": "2026-11-10T13:30:00.000Z",
        "updatedAt": "2026-11-10T17:25:10.000Z",
        "totalQuestoes": 3,
        "totalQuestoesClassificadas": 3,
        "totalAcertos": 1,
        "totalParciais": 1,
        "totalErros": 1,
        "totalPensamentos": 5
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

#### `GET /api/v1/simulados/:id`
Retorna detalhes completos (`SimuladoDetalheDto`) com questões ordenadas (`ordem ASC, createdAt ASC, id ASC`), temas ordenados por `nome`, pensamentos em ordem cronológica e `pdfSignedUrl` (ou `null` com aviso em log caso o arquivo falte no Storage, sem bloquear a prova).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`.

#### `POST /api/v1/simulados`
Cria um novo simulado em `status: 'PREPARACAO'`.

- **Body (`CreateSimuladoSchema`):**
  ```json
  {
    "titulo": "Codeforces Round 980 Div. 2",
    "duracaoConfiguradaSegundos": 7200
  }
  ```
- **Resposta `201`:** `ApiSuccessResponse<SimuladoDetalheDto>` (`pdfSignedUrl: null`, `questoes: []`)
- **Erros:** `400 VALIDATION_ERROR`.

#### `PATCH /api/v1/simulados/:id`
Atualiza metadados do simulado conforme seu status:
- `PREPARACAO`: aceita `titulo` e/ou `duracaoConfiguradaSegundos`.
- `EM_ANDAMENTO`: bloqueado (`409 SIMULADO_INVALID_STATUS_TRANSITION`).
- `FINALIZADO`: aceita apenas `titulo`; enviar `duracaoConfiguradaSegundos` retorna `409 SIMULADO_INVALID_STATUS_TRANSITION`.

- **Params:** `id` (`UUID`)
- **Body (`UpdateSimuladoSchema` — ao menos 1 campo):** `{ "titulo"?, "duracaoConfiguradaSegundos"? }`
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/simulados/:id`
Exclui o simulado no banco (cascateando questões, vínculos de temas, pensamentos e eventuais itens no Caderno de Erros) e remove o PDF associado no Storage (best-effort).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **Erros:** `404 SIMULADO_NOT_FOUND`.

---

### 3. Endpoints — Execução (`iniciar` e `finalizar`)

#### `POST /api/v1/simulados/:id/iniciar`
Transiciona `PREPARACAO` → `EM_ANDAMENTO`, define `startedAt = now()` e `tempoGastoSegundos = 0`. Exige ao menos `1` questão cadastrada.

- **Params:** `id` (`UUID`)
- **Body:** nenhum
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 SIMULADO_REQUIRES_QUESTAO`.

#### `POST /api/v1/simulados/:id/finalizar`
Transiciona `EM_ANDAMENTO` → `FINALIZADO`, grava `finishedAt` (com proteção contra clock skew garantindo `finishedAt >= startedAt`) e `tempoGastoSegundos`.

- **Params:** `id` (`UUID`)
- **Body (`FinalizarSimuladoSchema`):** `{ "tempoGastoSegundos": 6840 }` (`0..864000`)
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

---

### 4. Endpoints — PDF Privado (`simulado-pdfs`)

#### `POST /api/v1/simulados/:id/pdf`
Faz upload/substituição do PDF da prova em `status === 'PREPARACAO'` via `multipart/form-data` com campo `file`. Armazena sob `${userId}/simulados/${simuladoId}/${uuid}.pdf`, valida limite (`20 MiB`), MIME e magic bytes `%PDF-`, faz rollback no Storage em caso de falha de persistência no banco e remove o PDF anterior em substituição.

- **Params:** `id` (`UUID`)
- **Body:** `multipart/form-data` (`file`: `File` `.pdf`, `<= 20 MiB`)
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>` (já com `hasPdf: true` e `pdfSignedUrl` preenchida)
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR` (campo `file` ausente/inválido), `400 SIMULADO_PDF_INVALID_TYPE`, `413 SIMULADO_PDF_TOO_LARGE`.

#### `GET /api/v1/simulados/:id/pdf-url`
Gera uma nova URL assinada (`SimuladoPdfSignedUrlDto`) válida por `3600` segundos. Disponível em qualquer status desde que o simulado possua PDF.

- **Params:** `id` (`UUID`)
- **Resposta `200`:**
  ```json
  {
    "success": true,
    "data": {
      "signedUrl": "https://<project>.supabase.co/storage/v1/object/sign/simulado-pdfs/...",
      "expiresInSeconds": 3600
    }
  }
  ```
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_PDF_NOT_FOUND`.

#### `DELETE /api/v1/simulados/:id/pdf`
Remove o PDF vinculado ao simulado (permitido apenas em `status === 'PREPARACAO'`), limpando `pdfStoragePath` e removendo o objeto do Storage.

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<SimuladoDetalheDto>` (`hasPdf: false`, `pdfSignedUrl: null`)
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `404 SIMULADO_PDF_NOT_FOUND`.

---

### 5. Endpoints — Questões e Classificação Pós-Prova

#### `POST /api/v1/simulados/:id/questoes`
Adiciona uma questão na fase de preparação (`status === 'PREPARACAO'`). Se `ordem` for omitida, atribui `(maxOrdemAtual ?? 0) + 1`.

- **Params:** `id` (`UUID`)
- **Body (`CreateSimuladoQuestaoSchema`):** `{ "numeroQuestao": "Q1", "tituloQuestao": "Árvore Geradora Mínima", "ordem"?: 1 }`
- **Resposta `201`:** `ApiSuccessResponse<SimuladoQuestaoDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

#### `PATCH /api/v1/simulados/:id/questoes/:questaoId`
Edita uma questão pertencente ao simulado em `status === 'PREPARACAO'`.

- **Params:** `id` (`UUID`), `questaoId` (`UUID`) (`SimuladoQuestaoParamsSchema`)
- **Body (`UpdateSimuladoQuestaoSchema`):** `{ "numeroQuestao"?, "tituloQuestao"?, "ordem"? }`
- **Resposta `200`:** `ApiSuccessResponse<SimuladoQuestaoDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_QUESTAO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/simulados/:id/questoes/:questaoId`
Remove uma questão do simulado em `status === 'PREPARACAO'`.

- **Params:** `id` (`UUID`), `questaoId` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<questaoId>" } }`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_QUESTAO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`.

#### `POST /api/v1/simulados/:id/questoes/:questaoId/classificar`
Classifica a questão após o encerramento (`status === 'FINALIZADO'`) invocando a RPC transacional **`rpc_classificar_questao_simulado`**.

- **Params:** `id` (`UUID`), `questaoId` (`UUID`)
- **Body (`ClassificarQuestaoSimuladoSchema`):**
  ```json
  {
    "resultado": "PARCIAL",
    "temaIds": ["550e8400-e29b-41d4-a716-446655440001"],
    "observacaoPosRevisao": "Faltou tratar componentes desconexos."
  }
  ```
  - Quando `resultado === 'ACERTEI'`, enviar `observacaoPosRevisao: null` ou omitir o campo (texto não vazio retorna `400 VALIDATION_ERROR`).
- **Resposta `200`:** `ApiSuccessResponse<SimuladoQuestaoDto>` (hidratado com `temas` e `pensamentos`)
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_QUESTAO_NOT_FOUND`, `404 TEMA_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

---

### 6. Endpoints — Pensamentos e Exportação para IA

#### `POST /api/v1/simulados/:id/pensamentos`
Registra um pensamento durante a prova (`status === 'EM_ANDAMENTO'`) vinculado a uma questão pertencente ao simulado.

- **Params:** `id` (`UUID`)
- **Body (`CreateSimuladoPensamentoSchema`):** `{ "simuladoQuestaoId": "<uuid>", "descricao": "Tentei usar busca binária na resposta.", "tempoDecorridoSegundos": 845 }` *(campo `tempoDecorridoSegundos` opcional/nullable)*
- **Resposta `201`:** `ApiSuccessResponse<SimuladoPensamentoDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_QUESTAO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

#### `PATCH /api/v1/simulados/:id/pensamentos/:pensamentoId`
Edita um pensamento (permitido em `'EM_ANDAMENTO'` e `'FINALIZADO'`; bloqueado em `'PREPARACAO'`). Se `simuladoQuestaoId` for alterado, a questão destino também precisa pertencer ao mesmo simulado.

- **Params:** `id` (`UUID`), `pensamentoId` (`UUID`) (`SimuladoPensamentoParamsSchema`)
- **Body (`UpdateSimuladoPensamentoSchema`):** `{ "simuladoQuestaoId"?, "descricao"?, "tempoDecorridoSegundos"? }`
- **Resposta `200`:** `ApiSuccessResponse<SimuladoPensamentoDto>`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_PENSAMENTO_NOT_FOUND`, `404 SIMULADO_QUESTAO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`, `400 VALIDATION_ERROR`.

#### `DELETE /api/v1/simulados/:id/pensamentos/:pensamentoId`
Exclui um pensamento do simulado (permitido em `'EM_ANDAMENTO'` e `'FINALIZADO'`; bloqueado em `'PREPARACAO'`).

- **Params:** `id` (`UUID`), `pensamentoId` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<pensamentoId>" } }`
- **Erros:** `404 SIMULADO_NOT_FOUND`, `404 SIMULADO_PENSAMENTO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`.

#### `GET /api/v1/simulados/:id/export-ia`
Gera o resumo completo em Markdown estruturado (`SimuladoExportIaDto`) para análise externa com IA (permitido apenas em `status === 'FINALIZADO'`), sem emojis, com nomes de temas limpos sem `#`, resumo de duração/tempo/resultados, questões ordenadas e timeline cronológica `[MM:SS]` / `[HH:MM:SS]` / `[--:--]`.

- **Params:** `id` (`UUID`)
- **Resposta `200` (`SimuladoExportIaDto`):**
  ```json
  {
    "success": true,
    "data": {
      "simuladoId": "660e8400-e29b-41d4-a716-446655440030",
      "titulo": "OBI 2024 Fase 2",
      "markdown": "# Revisão de Simulado: OBI 2024 Fase 2\n..."
    }
  }
  ```
- **Erros:** `404 SIMULADO_NOT_FOUND`, `409 SIMULADO_INVALID_STATUS_TRANSITION`.

---

## Módulo 4: Lousas Universal (`/api/v1/lousas`)

Todas as rotas abaixo exigem autenticação via `Authorization: Bearer <token>` (isolamento multi-usuário estrito por RLS e bucket privado `lousas-private`).

### 1. Regras de Negócio & Dicas de UI

- **Ciclo de Vida e Exclusividade (1:1):**
  - Uma lousa é criada via `POST /api/v1/lousas` (multipart) e devolve `id` + `previewSignedUrl` + `sceneSignedUrl`. Em seguida, o Frontend envia `lousaId` em `POST /api/v1/reflexoes`, `PATCH /api/v1/reflexoes/:id`, `POST /api/v1/caderno-erros` ou `PATCH /api/v1/caderno-erros/:id`.
  - Uma mesma lousa só pode pertencer a **um único** registro ativo (`reflexoes` ou `caderno_erros`). Tentar reutilizar uma lousa já vinculada retorna `409 LOUSA_ALREADY_IN_USE`.
  - Se o usuário cancelar o modal após fazer upload sem salvar a reflexão/erro, o Frontend pode chamar `DELETE /api/v1/lousas/:id` para limpar os arquivos órfãos.
  - Excluir/trocar/desvincular via `PATCH`/`DELETE` da reflexão, do caderno de erros, de um tema (cascata de reflexões) ou de simulado/questão/`ACERTEI` (cascata de caderno de erros) já limpa registro e objetos no Storage automaticamente.
- **Limites e Formatos Aceitos:**
  - `scene` (`application/json`): JSON UTF-8 válido contendo `elements` (array) e opcionalmente `type: 'excalidraw'` (`LousaSceneSchema`).
  - `preview` (`image/webp` preferencial, ou `image/png`): validado por extensão, MIME declarado **e magic bytes** reais do arquivo.
  - Limite rígido: `scene.size + preview.size <= 3145728` (`LOUSA_MAX_TOTAL_SIZE_BYTES`, `3 MiB`). Acima disso retorna `413 LOUSA_TOO_LARGE`.
- **URLs Assinadas (`TTL = 3600s`):**
  - As URLs retornadas em `previewSignedUrl` / `sceneSignedUrl` expiram em `3600` segundos. Use `GET /api/v1/lousas/:id/urls` para renovar URLs expiradas ou carregar a cena (`sceneSignedUrl`) sob demanda ao abrir o editor.
- **Invalidação recomendada no TanStack Query:**
  - Ao atualizar o conteúdo de uma lousa existente via `PATCH /api/v1/lousas/:id`, invalidar `['lousas', lousaId]`, além da query do item pai (`['temas']` / `['reflexoes', id]` ou `['caderno-erros']`) para refletir o novo `previewSignedUrl` e `updatedAt`.

---

### 2. Endpoints (`/api/v1/lousas`)

#### `POST /api/v1/lousas`
Cria uma nova lousa enviando cena JSON e pré-visualização rasterizada (`multipart/form-data`). Executa rollback dos arquivos no Storage caso falhe qualquer etapa.

- **Content-Type:** `multipart/form-data`
- **Campos obrigatórios (`FormData`):**
  - `scene`: arquivo JSON (`application/json`, UTF-8, array `elements`)
  - `preview`: imagem raster (`image/webp` ou `image/png`, validada por magic bytes)
- **Resposta `201`:** `ApiSuccessResponse<LousaDto>`
- **Erros:** `400 LOUSA_INVALID_PAYLOAD`, `413 LOUSA_TOO_LARGE`.

#### `GET /api/v1/lousas/:id`
Retorna os metadados completos da lousa (`LousaDto`) com `previewSignedUrl` e `sceneSignedUrl` recém-assinadas em lote (`TTL = 3600s`).

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `ApiSuccessResponse<LousaDto>`
- **Erros:** `404 LOUSA_NOT_FOUND`.

#### `GET /api/v1/lousas/:id/urls`
Renova apenas o par de URLs assinadas (`LousaSignedUrlsDto`) com custo mínimo.

- **Params:** `id` (`UUID`)
- **Resposta `200` (`LousaSignedUrlsDto`):**
  ```json
  {
    "success": true,
    "data": {
      "previewSignedUrl": "https://.../storage/v1/object/sign/lousas-private/...",
      "sceneSignedUrl": "https://.../storage/v1/object/sign/lousas-private/...",
      "expiresInSeconds": 3600
    }
  }
  ```
- **Erros:** `404 LOUSA_NOT_FOUND`.

#### `PATCH /api/v1/lousas/:id`
Substitui os arquivos `scene` e `preview` de uma lousa existente (`multipart/form-data`), atualiza os metadados de tamanho/MIME no banco e remove eventual preview antigo se houver troca entre `.webp` e `.png`.

- **Params:** `id` (`UUID`)
- **Content-Type:** `multipart/form-data` com campos `scene` e `preview`
- **Resposta `200`:** `ApiSuccessResponse<LousaDto>`
- **Erros:** `404 LOUSA_NOT_FOUND`, `400 LOUSA_INVALID_PAYLOAD`, `413 LOUSA_TOO_LARGE`.

#### `DELETE /api/v1/lousas/:id`
Exclui uma lousa **órfã** (não vinculada a nenhuma reflexão nem registro do caderno de erros) e remove os arquivos do Storage.

- **Params:** `id` (`UUID`)
- **Resposta `200`:** `{ "success": true, "data": { "id": "<uuid>" } }`
- **Erros:** `404 LOUSA_NOT_FOUND`, `409 LOUSA_IN_USE`.
