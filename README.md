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
- **Ambiente de Prova em Foco:** Leitura do PDF integrada ao cronômetro ativo e a um painel fixo compacto onde o estudante seleciona a questão e registra, em tempo real, quantos pensamentos e caminhos de raciocínio quiser ao longo da prova.
- **Pós-Prova e Correção Inteligente:**
  - Exportação com 1 clique de todas as questões e pensamentos registrados na prova, formatados para correção rápida com IA.
  - Classificação por questão (`Acertei`, `Parcial` ou `Errei`) e vínculo com um ou mais **Temas** (existentes ou criados na hora).
  - **Integração Automática:** Marcar `Acertei` atualiza imediatamente a revisão dos temas da questão; marcar `Parcial` ou `Errei` abre um campo único de pós-revisão na gaveta da questão e a envia automaticamente para o **Caderno de Erros** (sem contar como revisão concluída do tema até que o erro seja efetivamente revisado).

### 2. Módulo de Caderno de Erros
- **Centralização de Falhas:** Reúne automaticamente as questões erradas ou parciais vindas dos **Simulados**, além de permitir o registro manual de **Questões de Plataformas Externas** (código/referência + link, como Codeforces ou bancos de questões do ENEM) e **Questões Genéricas/Completas** (com enunciado completo e link opcional).
- **Fluxo Honestidade de Revisão (`Pendentes` vs. `Já Revisados`):**
  - Cadastrar um erro não altera artificialmente a data de revisão do tema.
  - Somente quando o estudante revisa o erro e marca **`Finalizado Sozinho`** ou **`Com Ajuda`** é que o sistema atualiza a data de última revisão dos temas vinculados.
  - Erros revisados **`Com Ajuda`** mantêm um destaque visual mínimo e todos os itens revisados podem ser devolvidos para pendentes ou marcados novamente como **`Finalizado Sozinho`** em revisões futuras.

### 3. Módulo de Temas e Revisão (Com Conexões Bidirecionais)
- **Radar de Revisão por Tema:** Lista todos os temas estudados exibindo há quanto tempo cada um não é revisado (com destaque simples caso a última prática tenha sido feita *Com Ajuda*), além de permitir o registro rápido de práticas avulsas do dia a dia.
- **Reflexões e Conexões entre Temas:** Permite registrar aprendizados próprios de um tema ou criar conexões entre dois ou mais temas (`Tema A ↔ Tema B`). Toda conexão é bidirecional: dentro da gaveta expansível de qualquer tema, o estudante visualiza separadamente as **Reflexões Próprias do Tema** e as **Pontes/Conexões com Outros Temas**.

---

## Arquitetura e Tecnologias

O sistema é multi-usuário (permitindo que cada estudante tenha sua própria conta isolada e utilize a plataforma para seu objetivo específico — OBI, Programação Competitiva, ENEM ou Vestibulares) e segue padrões estritos de engenharia documentados no `GEMINI.md` e no [STYLEGUIDE.md](./STYLEGUIDE.md):

- **Estrutura:** Monorepo TypeScript estrito (`/frontend`, `/backend`, `/shared`, `/supabase`).
- **Frontend:** React, TypeScript, Vite, Tailwind CSS, shadcn/ui, Lucide Icons, TanStack Query, React Hook Form + Zod.
- **Backend (BFF):** Hono em Cloudflare Workers (Arquitetura em Camadas: Routes, Controllers, Services, Repositories) com validação universal via Zod e DTOs compartilhados.
- **Banco de Dados, Autenticação e Arquivos:** Supabase (PostgreSQL + Auth + Storage para PDFs de simulados) com isolamento total por usuário via Row Level Security (RLS) e operações transacionais atômicas.
