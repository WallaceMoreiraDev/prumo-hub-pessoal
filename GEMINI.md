# Manual de Padrões de Engenharia de Software e Diretrizes de Código

> **DOCUMENTO MANDATÓRIO:** Este manual define as regras absolutas de arquitetura, regras de negócio, qualidade e segurança para o desenvolvimento do **Prumo Hub Pessoal** (`React + Node.js + Supabase`). A prioridade máxima é a construção de um sistema robusto, seguro, sem falhas silenciosas, sem estados dessincronizados e sem código espaguete. **O não cumprimento destas diretrizes (bem como do [STYLEGUIDE.md](./STYLEGUIDE.md)) resultará em código inaceitável e bloqueio imediato.**
>
> **NOME OFICIAL DA APLICAÇÃO:** O nome oficial do aplicativo e produto é **Prumo Hub Pessoal** (ou abreviado como **Prumo**). Todo manifesto, título de página, metatags e comunicações visuais devem seguir rigorosamente esta nomenclatura.

---

## 1. Princípios Fundamentais (Core Principles)

1. **Falhe Rápido (Fail-Fast):** Erros devem estourar imediatamente na validação de payload ou na compilação. Falhas silenciosas são inaceitáveis.
2. **Única Fonte da Verdade (SSOT em Monorepo):** É proibida a duplicação de regras de negócio, enums e tipos. Os Schemas do Zod, Enums e Tipagens TypeScript compartilhadas devem ser obrigatoriamente centralizados na pasta `/shared` na raiz do projeto, permitindo importação simultânea pelo `/frontend` e pelo `/backend`.
3. **Legibilidade sobre Esperteza:** O código é lido muito mais vezes do que escrito. Prefira clareza, nomes descritivos e funções coesas em vez de abstrações prematuras ou malabarismos de tipos (*type gymnastics*).
4. **Tratamento de Datas, Fuso Horário e Cálculo de Revisão (UTC Always):**
   - Todas as datas e carimbos de tempo DEVEM ser armazenados no banco e transitados na API em **UTC (ISO 8601)**.
   - A conversão para o fuso horário local do usuário (ex.: `America/Sao_Paulo`) ocorre na camada de visualização.
   - **Regra Crítica para "Há X dias sem revisar":** O cálculo de quantos dias se passaram desde a última revisão de um tema JAMAIS deve dividir milissegundos brutos por 24 horas (o que gera erros próximos à meia-noite). Deve-se comparar as **datas de calendário locais normalizadas no início do dia (`00:00:00` no fuso do usuário)**.
5. **Atomicidade e Idempotência em Operações Críticas:** Mutações que afetam múltiplas entidades (como revisar uma questão de simulado e enviá-la ao Caderno de Erros, ou marcar um erro como revisado e atualizar múltiplos Temas) devem ser executadas de forma **atômica (tudo ou nada)** e idempotente.

---

## 2. Arquitetura Geral, Segurança Multi-Usuário e Persistência (Node.js + Supabase)

* **Padrão Backend-for-Frontend (BFF):** O Frontend em React **NÃO DEVE** fazer requisições diretas de manipulação de dados de negócio para o Supabase. Toda comunicação de domínio passa EXCLUSIVAMENTE através da API Node.js.
* **Isolamento Multi-Usuário e RLS (Row Level Security) — CRÍTICO:**
  * Cada estudante possui sua própria conta isolada (`user_id`), podendo utilizar a plataforma para o seu objetivo específico (OBI, Programação Competitiva, ENEM, Vestibulares, etc.).
  * O Frontend envia o JWT de sessão via cabeçalho HTTP `Authorization: Bearer <token>`.
  * O Node.js **DEVE** instanciar o cliente do Supabase *por requisição* aplicando este token, garantindo que as políticas de RLS filtrem estritamente por `auth.uid() = user_id`.
  * O uso da `service_role_key` (Admin SDK) é **ESTRITAMENTE PROIBIDO** em rotas de clientes comuns, pois burla o RLS.
* **Database Migrations & Transações Atômicas (RPCs):**
  * Nenhuma alteração estrutural de banco de dados (tabelas, colunas, RLS, functions, buckets) deve ser feita manualmente no painel web. O uso exclusivo de **Supabase Migrations CLI** (`/supabase/migrations`) é obrigatório.
  * Toda operação de domínio que altere mais de uma tabela simultaneamente DEVE ser encapsulada em uma **Postgres RPC (Stored Procedure)** transacional para garantir ACID.
* **Armazenamento de PDFs de Simulados (`Supabase Storage`):**
  * Os arquivos PDF das provas devem ser armazenados em bucket privado com políticas de acesso restritas ao `user_id` proprietário do simulado, trafegando via URLs assinadas (*signed URLs*).
* **Convenção de Nomenclatura do Banco:** Tabelas e colunas devem obrigatoriamente usar `snake_case`. O backend é responsável por mapear esses valores para `camelCase` (via DTOs) antes de enviá-los ao frontend.
* **Sincronização Obrigatória do Schema (Pré-requisito Mandatório):** Antes de iniciar qualquer codificação ou manutenção no Backend que toque no banco de dados, é OBRIGATÓRIO rodar o comando `npm run db:types` na pasta `/backend` para atualizar `shared/types/database.types.ts`. É expressamente proibido supor colunas ou relacionamentos sem antes sincronizar e consultar este arquivo gerado.

---

## 3. Regras de Domínio e Contratos Transacionais Inegociáveis

As três frentes do sistema (**Simulados**, **Caderno de Erros** e **Temas e Revisão**) possuem regras de acoplamento estritas que nunca podem ser violadas:

### 3.1. Gatilhos Exclusivos da "Última Revisão" de um Tema
A data de última revisão (`last_reviewed_at`) e o modo da última revisão (`last_review_mode`: `'SOLO' | 'HELP'`) de um **Tema** **SÓ** podem ser atualizados em **3 momentos exatos**:
1. **No Pós-Simulado:** Quando uma questão vinculada àquele(s) tema(s) é marcada como **`ACERTEI`** (define `last_reviewed_at = now` e `last_review_mode = 'SOLO'`).
2. **No Caderno de Erros:** Quando um item vinculado àquele(s) tema(s) recebe a ação **`FINALIZADO_SOZINHO`** (`last_review_mode = 'SOLO'`) ou **`COM_AJUDA`** (`last_review_mode = 'HELP'`).
   - **Proibição Expressa:** O ato de *cadastrar* um erro no Caderno de Erros (manualmente ou vindo de um Simulado) **JAMAIS** atualiza a data de revisão dos temas vinculados.
3. **Na Página de Temas e Revisão:** Quando o usuário registra diretamente uma prática avulsa via **`Registrar Prática / Revisão`** (`SOLO` ou `HELP`).

### 3.2. Fluxo Fechado Pós-Simulado (`ACERTEI` vs. `PARCIAL` / `ERREI`)
Na visualização de um simulado finalizado:
- Cada questão permite vincular **um ou mais Temas** (escolhendo existentes ou criando novos inline) e recebe um dos 3 estados: `ACERTEI`, `PARCIAL` ou `ERREI`.
- Se marcada como **`PARCIAL`** ou **`ERREI`**:
  1. **Não** conta como revisão dos temas vinculados naquele momento.
  2. Habilita na gaveta (2º nível) da questão **um único campo geral de Pós-Revisão** (para anotar o que resolvia a questão).
  3. Dispara atomicamente a criação/atualização do registro correspondente no **Caderno de Erros** com origem exclusiva `SIMULADO` e status `PENDENTE`, carregando o vínculo do simulado, número/título da questão, pensamentos registrados durante a prova e a observação pós-revisão.

### 3.3. Restrição de Tipos no Cadastro Manual do Caderno de Erros
- No schema Zod de criação manual de erro (`CreateManualErrorSchema` em `/shared/schemas`), o campo de origem deve aceitar **exclusivamente**:
  1. **`EXTERNAL_LINK`** (Questão Externa / Plataforma — ex.: Codeforces, ENEM, Bancos de Questões): exige obrigatoriamente **Código/Referência da questão** (ex.: `222A`, `ENEM 2023 Q138`) + **Link da questão** + **Temas** (um ou mais).
  2. **`GENERIC_FULL`** (Questão Genérica / Completa): exige obrigatoriamente **Título da questão** + **Descrição/Enunciado completo da questão** + **Link opcional** + **Temas** (um ou mais).
- É **terminantemente proibido** permitir que o usuário selecione a origem `SIMULADO` no formulário de cadastro manual do Caderno de Erros.

### 3.4. Conexões Bidirecionais entre Temas (`Tema A ↔ Tema B`)
- Ao criar uma **Nova Reflexão**, o usuário seleciona um **Tema Principal (obrigatório)** e, opcionalmente, **um ou mais Temas Conectados**.
- Se não houver temas conectados, a reflexão pertence apenas ao Tema Principal (exibida na seção *Reflexões Próprias do Tema*).
- Se houver temas conectados, a relação é **bidirecional sem duplicação de registro**: ao abrir a gaveta do Tema Principal ou de qualquer um dos Temas Conectados, a mesma conexão deve aparecer na seção *Conexões com Outros Temas* de ambos os lados.

### 3.5. CRUD Padronizado Obrigatório em Todas as Entidades
Nenhuma entidade pode ter apenas criação e listagem. É obrigatório implementar o ciclo completo (**Criar, Visualizar, Editar e Excluir**) para:
1. Simulados;
2. Questões registradas no Simulado (incluindo edição/exclusão inline na preparação);
3. Pensamentos registrados durante a prova;
4. Registros do Caderno de Erros (incluindo a ação de `Devolver para Pendentes` e remarcar `Finalizado Sozinho` na aba de revisados);
5. Temas;
6. Reflexões e Conexões.

---

## 4. Contratos de API, Tratamento de Erros e Observabilidade

* **Padronização de Respostas HTTP:** Todas as respostas da API devem seguir um envelope padronizado:
  * Sucesso: `{ "success": true, "data": { ... }, "meta": { "pagination": ... } }`
* **Exception Propagation e Códigos de Erro (CRÍTICO):**
  * A API **NUNCA** deve retornar mensagens soltas em texto para exibição direta.
  * O backend deve retornar **Códigos de Erro Tipados** (ex.: `SIMULADO_NOT_FOUND`, `INVALID_MANUAL_ERROR_ORIGIN`, `VALIDATION_ERROR`).
  * O Frontend deve possuir um dicionário centralizado (`errorMessages.ts`) que traduz os códigos em mensagens claras em Português.
* **Manejo de Erros no Backend e Zod:**
  * Erros de validação do Zod devem retornar `{ "success": false, "code": "VALIDATION_ERROR", "details": [{ "path": "...", "message": "..." }] }`.
  * Exceções de regra de negócio nos Services devem lançar `throw new AppError("CODE", statusCode)` capturadas por um **Middleware Global de Erros**.
* **Observabilidade e Segurança:**
  * Utilize um *logger* estruturado (Pino ou Winston) em vez de `console.log` solto.
  * Jamais exponha tokens, senhas ou chaves nos logs.
  * Configure `Helmet`, `CORS` estrito e `Rate Limiting` na API Node.js.

---

## 5. Padrões de Backend (Node.js + `/shared` SSOT)

* **Arquitetura em Camadas (Layered Architecture):**
  * **Routes:** Acoplam Middlewares de Autenticação e Validação Zod aos Controllers. Zero regra de negócio.
  * **Controllers:** Orquestram `req`/`res`, extraem dados validados, invocam o Service e retornam o DTO no envelope padrão.
  * **Services:** Concentram 100% da regra de negócio e validações de domínio. Não conhecem objetos HTTP (`req`/`res`).
  * **Repositories:** Única camada autorizada a realizar chamadas ao Supabase (`tables`, `rpc`, `storage`).
* **Validação Universal e Variáveis de Ambiente:**
  * Todo `body`, `query` e `params` deve ser validado via middleware Zod antes de chegar ao Controller.
  * O arquivo `.env` deve ser validado no boot da aplicação via Zod (`env.ts`), interrompendo a inicialização caso falte qualquer variável obrigatória.
* **Estrutura da Pasta `/shared` (SSOT):**
  * `/shared/schemas/`: Schemas Zod de validação de payloads e parâmetros.
  * `/shared/types/database.types.ts`: Tipos gerados automaticamente do Supabase.
  * `/shared/types/api.types.ts`: Envelopes `ApiResponse<T>` e `ApiErrorResponse`.
  * `/shared/types/*.types.ts`: DTOs em `camelCase` e Enums compartilhados.
  * É estritamente proibido redefinir interfaces manualmente no `/frontend` ou `/backend` que dupliquem contratos de `/shared`.

---

## 6. Padrões de Frontend (React + Estabilidade de Prova + UI)

* **Feature-Sliced Design:** Proibida estrutura achatada. Todo código de domínio deve viver dentro de `/frontend/src/features/`:
  * `/features/auth/` (Login, sessão, proteção de rotas)
  * `/features/simulados/` (Lista de Simulados, Novo Simulado, Execução da Prova com PDF, Visualizar Pós-Prova)
  * `/features/caderno-erros/` (Listagem Pendentes/Revisados, Gaveta de Cadastro Manual, Ações de Revisão)
  * `/features/temas-revisao/` (Listagem de Temas, Registro de Prática, Nova Reflexão/Conexão, Gaveta de Detalhes)
* **Gerenciamento de Estado e Data Fetching:**
  * Uso **OBRIGATÓRIO** de **TanStack Query (React Query)** para todas as leituras e mutações de API (com invalidação automática das queries correlatas: ex.: revisar um erro no Caderno invalida a query de `temas-revisao`).
  * O combo `useEffect` + `useState` para buscar dados da API é **expressamente proibido**.
* **Formulários:** Uso obrigatório de **React Hook Form** + **Zod** (`@hookform/resolvers/zod`) consumindo diretamente os schemas de `/shared/schemas`.
* **Blindagem Técnica da Página de Execução do Simulado (CRÍTICO):**
  1. **Cronômetro Resiliente Baseado em Timestamp:** O cronômetro de prova JAMAIS deve depender apenas de um contador decrementado em memória RAM. O tempo restante deve ser calculado a partir de `startedAt` + `durationSeconds` persistidos (no banco e espelhados localmente), garantindo que um `F5` ou fechamento acidental da aba em uma prova de 4 horas recupere o segundo exato sem perda de progresso.
  2. **Isolamento do Visualizador de PDF (`React.memo`):** O componente que renderiza o PDF da prova deve ser estritamente isolado das atualizações de segundo a segundo do cronômetro e da digitação no painel fixo de registro de pensamentos. Digitar ou salvar um pensamento NUNCA pode causar re-render, piscada ou perda de scroll no PDF.
* **Obediência Absoluta ao [STYLEGUIDE.md](./STYLEGUIDE.md):**
  * Cor primária **`#DC2828`** (`hsl(0 72% 51%)`), zero roxo, zero carnaval de cores.
  * **Proibição absoluta de emojis nativos** em qualquer lugar da interface (uso exclusivo de **Lucide React**).
  * **Temas sem `#`** em toda a UI.
  * **Listagens em 2 Níveis (Linha Fechada + Gaveta Expansível):** 1º nível enxuto na linha (sem links soltos ou textos espremidos) e 2º nível abrindo para baixo com os detalhes completos.
  * **Destaque mínimo padronizado** (`border-l-2 border-l-amber-500/80`) para itens cuja última revisão ocorreu `Com Ajuda`.
  * **Proibição de `window.alert`, `window.confirm` e `window.prompt`** (uso obrigatório de `Dialog`, `AlertDialog` e `Sonner` Toasts do `shadcn/ui`).
  * **Proibição de textos `"Carregando..."`** (uso obrigatório de `Skeleton` loaders).

---

## 7. Qualidade de Código, Testes e Git Workflow

* **TypeScript Estrito ("No Any"):** O uso de `any` é terminantemente proibido em todo o repositório.
* **Convenções de Nomenclatura:**
  * `PascalCase`: Componentes React, Interfaces, Types e Enums.
  * `camelCase`: Variáveis, funções, hooks e propriedades de DTOs.
  * `UPPER_SNAKE_CASE`: Constantes globais e variáveis de ambiente.
* **Git Workflow e Conventional Commits:**
  * Proibido realizar commits diretos na `main`, `master` ou `develop`. Todo trabalho ocorre em branches (`feature/...`, `fix/...`, `chore/...`, `docs/...`).
  * Mensagens de commit obrigatoriamente em **Português** no formato `tipo(escopo): descrição concisa` (ex.: `feat(simulados): implementa gaveta de pos-revisao`).
  * **Atomicidade:** Alterações de escopos ou naturezas diferentes devem ser separadas em commits atômicos distintos.

---

## 8. Protocolo de Atuação da Inteligência Artificial (Orquestração Multi-IA)

* **Zero Commits Automáticos:** Nenhuma IA deve executar `git commit` ou `git push` automaticamente após escrever código. O fluxo obrigatório é: codificar $\rightarrow$ rodar `tsc --noEmit` e `npm run build` $\rightarrow$ apresentar relatório ao usuário $\rightarrow$ **aguardar autorização explícita**.
* **Protocolo Obrigatório de Git (Ciclo de 3 Passos):** Quando o usuário solicitar versionamento (ex.: "commita aí", "faz o merge"), a IA é proibida de rodar os comandos de imediato. Deve obrigatoriamente:
  1. **Análise:** Inspecionar `git status` e branches, planejando commits atômicos apenas dentro do seu escopo.
  2. **Proposta de Ação:** Listar claramente os comandos e mensagens de commit propostos.
  3. **Espera Obrigatória:** Perguntar *"Posso prosseguir com esses comandos?"* e aguardar o "sim" explícito do usuário.
* **Checklist Antes do Código no Backend (As 4 Perguntas de Ouro):** Antes de implementar qualquer nova rota, verificar se estão claros: 1) Autorização/Escopo do usuário, 2) Validação e limites de tamanho no Zod, 3) Filtros/Paginação, 4) Efeitos colaterais transacionais. Se houver ambiguidade, parar e perguntar antes de codar.
* **Verificação Obrigatória de Compilação (`TSC`) e Build de Produção:**
  * Toda IA executora DEVE rodar `npx tsc --noEmit` e `npm run build` na sua respectiva pasta antes de entregar a tarefa.
  * Caso `tsc` gere acidentalmente arquivos `.js` ou `.d.ts` sujos dentro de pastas `src/`, a IA deve limpá-los imediatamente antes de finalizar.

### Diretrizes Estritas da IA Instrutora / Arquiteta (Antigravity)
* **Proibição Absoluta de Manipulação Direta de Código:** A IA Instrutora/Arquiteta é **ESTRITAMENTE PROIBIDA** de criar, editar ou excluir arquivos de código-fonte (`/frontend`, `/backend`, `/shared`, `/supabase`) sem ordem explícita do usuário. Seu papel é exclusivamente arquitetar soluções, revisar entregas e formular prompts detalhados para as IAs executoras.
* **Cabeçalho Obrigatório em Todos os Prompts Gerados:** Todo prompt elaborado pela IA Instrutora para as IAs executoras DEVE iniciar com:
  > **Nota do Arquiteto (IA Instrutora):** Este prompt foi elaborado por uma IA Instrutora. Como IA especialista executora, você deve discernir criticamente, avaliar com rigor as ferramentas disponíveis, a arquitetura e o contexto, e atuar estritamente dentro do seu escopo delimitado sem realizar commits automáticos.
* **Fechamento Obrigatório em Todos os Prompts Gerados:** Todo prompt elaborado pela IA Instrutora DEVE terminar impreterivelmente com a frase exata:
  `Leia o gemini.md e o STYLEGUIDE.md obrigatoriamente e siga rigorosamente.`

### Isolamento Rígido das IAs Especializadas (Fronteiras de Escopo)
* **Database AI:** Atua exclusivamente em `/supabase/migrations` (e na geração de tipos `db:types`). É proibida de tocar em `/frontend` ou em regras de aplicação do `/backend`.
* **Backend AI:** Atua exclusivamente em `/backend` e `/shared`, além de documentar obrigatoriamente todas as rotas, payloads e contratos prontos no arquivo `FRONTEND_HANDOFF.md` em formato de checklist (`[ ]` / `[x]`). É estritamente proibida de alterar qualquer arquivo em `/frontend`.
* **Frontend AI:** Atua exclusivamente em `/frontend` consumindo os contratos de `/shared` e guiando-se pelo `FRONTEND_HANDOFF.md` e pelo `STYLEGUIDE.md`. É estritamente proibida de alterar `/backend` ou `/supabase`. Caso receba um prompt fora do seu escopo, deve recusar imediatamente e alertar o usuário.
* **Proibição Absoluta de Commits Fora do Escopo:** Mesmo que existam arquivos modificados de outra camada no `git status`, cada IA só pode executar `git add` nos arquivos pertencentes à sua própria frente de atuação.
