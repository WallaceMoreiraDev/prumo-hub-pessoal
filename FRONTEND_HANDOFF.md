# Frontend Handoff & Checklist de Integração (Backend -> Frontend)

Este documento registra as entregas da **Backend AI** (rotas, contratos em `/shared` e comportamentos transacionais) prontas para consumo pela **Frontend AI**.

---

## Status de Entregas

- [x] **Setup Inicial & Contratos Base (`/shared`)**
- [ ] **Módulo 1: Simulados (Preparação, Execução, Pós-Prova e Exportação IA)**
- [ ] **Módulo 2: Caderno de Erros (Listagem, Cadastro Manual Restrito e Revisão)**
- [ ] **Módulo 3: Temas, Revisão e Conexões Bidirecionais**

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
- [`temas.types.ts`](./shared/types/temas.types.ts): `TemaSummaryDto`, `TemaDto`, `ReflexaoDto`, `TemaDetalheDto`.
- [`simulados.types.ts`](./shared/types/simulados.types.ts): `SimuladoPensamentoDto`, `SimuladoQuestaoDto`, `SimuladoDto`, `SimuladoDetalheDto`, `SimuladoPdfSignedUrlDto`, `SimuladoExportIaDto`.
- [`caderno-erros.types.ts`](./shared/types/caderno-erros.types.ts): `CadernoErroSimuladoMetaDto`, `CadernoErroDto`.

#### Schemas Zod (`/shared/schemas/`)
- [`common.schema.ts`](./shared/schemas/common.schema.ts): `UuidSchema`, `UuidParamSchema`, `PaginationQuerySchema` (`page` `1..10000`, `limit` `1..100`, `search` max `120`), `HttpUrlSchema` (`trim()` antes de validar URL `http`/`https`, max `2048`).
- [`temas.schema.ts`](./shared/schemas/temas.schema.ts): `TemaNomeSchema` (trim, não vazio, max `80`, proibido `#`), `CreateTemaSchema`, `UpdateTemaSchema`, `TemasQuerySchema`, `RegistrarPraticaSchema`, `CreateReflexaoSchema` (impede `temaPrincipalId` em `temaConectadoIds`), `UpdateReflexaoSchema`.
- [`simulados.schema.ts`](./shared/schemas/simulados.schema.ts): `CreateSimuladoSchema` (`duracaoConfiguradaSegundos` inteiro `1..86400`), `UpdateSimuladoSchema`, `SimuladosQuerySchema`, `CreateSimuladoQuestaoSchema`, `UpdateSimuladoQuestaoSchema`, `CreateSimuladoPensamentoSchema`, `UpdateSimuladoPensamentoSchema`, `FinalizarSimuladoSchema`, `ClassificarQuestaoSimuladoSchema` (`temaIds` padrão `[]`, rejeita `observacaoPosRevisao` preenchida quando `resultado === 'ACERTEI'` e normaliza para `null`).
- [`caderno-erros.schema.ts`](./shared/schemas/caderno-erros.schema.ts): `CreateManualErrorSchema` (`z.discriminatedUnion('origem', ...)` aceitando **exclusivamente** `EXTERNAL_LINK` — normalizando `titulo: ""` para `undefined` — e `GENERIC_FULL`), `UpdateCadernoErroSchema`, `CadernoErrosQuerySchema`, `RevisarCadernoErroSchema`.
