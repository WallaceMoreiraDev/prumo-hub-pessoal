# Guia de Estilos e Padrões de UI/UX (Styleguide) — Prumo Hub Pessoal

Este documento define as diretrizes estéticas, visuais e de interação rigorosas do **Prumo Hub Pessoal**. Qualquer tela, componente ou funcionalidade adicionada ao frontend **DEVE** obedecer estritamente a este padrão visual.

---

## 1. Filosofia Visual: Sobriedade, Foco e Zero Poluição

O **Prumo Hub Pessoal** é um ambiente de estudo profundo, realização de simulados longos (de 2 a 5 horas) e revisão estruturada de erros e temas. Por isso:
1. **Zero Poluição Visual ("Sem Carnaval de Cores"):** É estritamente proibido misturar múltiplas cores vibrantes na mesma linha ou criar telas abarrotadas de estatísticas artificiais. A interface deve ser limpa, respirável e guiada por contraste neutro com um único ponto focal de cor primária.
2. **Proibição Absoluta de Emojis Nativos:** É terminantemente **PROIBIDO** utilizar emojis de sistema operacional (`✔`, `✘`, `⚠️`, `🤝`, `🧠`, `💡`, `🚀`, `📅`, etc.) em qualquer texto, botão, título, badge ou toast. Todo recurso visual deve utilizar exclusivamente ícones vetoriais padronizados da biblioteca **`Lucide React`** (`strokeWidth={1.75}` ou `2`, tamanhos `w-4 h-4` em botões/linhas e `w-5 h-5` em cabeçalhos).
3. **Nomenclatura Limpa de Temas (Sem `#`):** Os temas de estudo devem ser exibidos sempre com seu nome limpo (ex.: `Dijkstra`, `BFS`, `Eletrodinâmica`, `Geometria Espacial`). É **proibido** prefixar o nome dos temas com o caractere `#` em qualquer lugar da interface.

---

## 2. Tipografia

A plataforma combina leitura confortável de textos/enunciados com precisão técnica para cronômetros e códigos:
- **Fonte Principal (`font-sans`):** `Outfit` (ou `Inter`, importada via Google Fonts no `index.html`), aplicada globalmente para títulos, textos de interface, reflexões e enunciados.
  - Títulos principais e cabeçalhos: `font-bold` ou `font-semibold` com `tracking-tight`.
  - Textos de leitura e observações: `font-normal` ou `font-medium` com altura de linha confortável (`leading-relaxed`).
- **Fonte Monoespaçada (`font-mono`):** `JetBrains Mono`, utilizada **exclusivamente** para:
  - O cronômetro do simulado (`02:45:10`).
  - Carimbos de tempo nos pensamentos da prova (`[00:14]`).
  - Códigos/referências curtas de questões externas (ex.: `222A`, `Q138`).

---

## 3. Paleta de Cores (Light & Dark Mode Nativos)

Toda a plataforma suporta Light e Dark Mode através das variáveis semânticas do Tailwind CSS / `shadcn/ui`.

### A. Cor Primária e Base Neutra
- **Cor Primária (Primary):** Vermelho Prumo **`#DC2828`** (`hsl(0 72% 51%)`). Utilizada em botões de ação principal, indicadores ativos de navegação e foco.
- **Proibição de Roxo:** É proibido utilizar tons de roxo/violeta na interface.
- **Superfícies e Textos (Paleta `Slate`):**
  - **Light Mode:** Fundos claros e suaves (`Slate 50/100`) com texto de alto contraste (`Slate 900`) e textos secundários em `Slate 500/600`.
  - **Dark Mode:** Fundos profundos e confortáveis para longas sessões de estudo (`Slate 950/900`), evitando o preto absoluto (`#000000`) que causa fadiga visual na leitura de PDFs e enunciados.
- **Uso Obrigatório de Variáveis Semânticas:** Nunca utilize cores fixas hardcoded em containers gerais. Utilize sempre `bg-background`, `bg-card`, `text-foreground`, `text-muted-foreground`, `border-border` e `bg-primary`.

### B. Cores Semânticas Restritas de Status (Sóbrias e Discretas)
Apenas 3 estados funcionais possuem cor semântica dedicada (sempre aplicada com baixa opacidade de fundo `10%–15%` e borda sutil `25%–30%`, nunca com blocos chapados gritantes):
1. **Sucesso / Domínio (`Acertei` no Simulado | `Finalizado Sozinho` no Caderno e Temas):**
   - Tom Esmeralda discreto (`bg-emerald-500/10 text-emerald-500 border-emerald-500/25`).
2. **Atenção / Apoio (`Parcial` no Simulado | `Com Ajuda` no Caderno e Temas):**
   - Tom Âmbar discreto (`bg-amber-500/10 text-amber-500 border-amber-500/25`).
3. **Erro (`Errei` no Simulado):**
   - Tom Vermelho/Rosa discreto (`bg-rose-500/10 text-rose-500 border-rose-500/25`).

*(Badges de origem como `Simulado`, `Questão Externa` ou `Questão Genérica` e badges de `Temas` devem utilizar tons neutros de `Slate` / `Secondary` para não competir visualmente com os botões de revisão).*

---

## 4. Padrão Estrutural de Listagens em 2 Níveis (Linha Fechada + Gaveta Expansível)

Para impedir que as páginas fiquem confusas ou com dados amontoados, todas as listagens principais do sistema (**Visualizar Simulado**, **Caderno de Erros** e **Temas e Revisão**) devem seguir obrigatoriamente a arquitetura de **Acordeão / Gaveta em 2 Níveis**:

### 1º Nível — A Linha Fechada (Sempre Visível e Enxuta)
- Deve conter **exclusivamente o essencial** para leitura rápida em 1 segundo:
  - Ícone de expansão (`ChevronRight` / `ChevronDown` do Lucide com rotação suave).
  - Título principal do item (ou código + título).
  - Etiqueta neutra de classificação (tipo/origem e temas vinculados).
  - Botões de ação rápida da linha (ex.: `Acertei / Parcial / Errei` ou `Finalizado Sozinho / Com Ajuda`).
- **Proibições no 1º Nível:** É proibido exibir links externos soltos, concatenar "Nome do Simulado + Número da Questão + Título do Erro" tudo misturado na mesma frase, ou exibir textos de pensamentos/observações fora da gaveta.

### 2º Nível — A Gaveta Expansível (Abre para Baixo ao Clicar)
- Ao clicar na linha fechada, um painel inferior se expande suavemente (`animate-accordion-down`) com fundo levemente diferenciado (`bg-muted/30`) e espaçamento amplo (`p-5`), exibindo os detalhes completos:
  - **Em Visualizar Simulado:** Lista cronológica dos pensamentos registrados durante a prova + o campo único geral de Pós-Revisão (visível apenas se o status for `Parcial` ou `Errei`).
  - **No Caderno de Erros:** Metadados de origem (qual simulado/questão ou link clicável da plataforma externa), enunciado completo (quando for questão genérica/completa), pensamentos da prova (se veio de simulado) e o campo de observação pós-revisão.
  - **Em Temas e Revisão:** Divisão clara em duas colunas/seções separadas: **Reflexões Próprias do Tema** de um lado e **Conexões com Outros Temas (`Tema A ↔ Tema B`)** do outro, além do resumo/atalho para os erros daquele tema.

---

## 5. Padrão do "Destaque Mínimo" para Revisões `Com Ajuda`

Quando um erro no **Caderno de Erros** (aba *Já Revisados*) ou um tema na página de **Temas e Revisão** teve sua última revisão marcada como **`Com Ajuda`**:
- Ele **não** deve ficar pintado de forma chamativa.
- Deve receber apenas um **destaque mínimo e padronizado**: uma borda lateral esquerda discreta em tom âmbar (`border-l-2 border-l-amber-500/80`) e um pequeno indicador textual/ícone sutil informando que a última revisão ocorreu com apoio.
- Assim que for marcado novamente como **`Finalizado Sozinho`**, a borda lateral âmbar é removida.

---

## 6. Profundidade (Glassmorphism), Bordas e Micro-interações

Seguindo o DNA visual da família Prumo:
1. **Superfícies e Profundidade (`Glass` Calibrado):**
   - Headers, barras superiores e o **Painel Fixo de Registro de Pensamento** (sobreposto ao PDF durante a prova) utilizam efeito translúcido refinado (`backdrop-blur-md bg-background/85 border-border/60`).
   - Cards e linhas de listagem utilizam `rounded-2xl` (ou `rounded-xl` para itens compactos) com bordas sutis e transição suave no hover (`hover:border-slate-700` no Dark Mode / `hover:border-slate-300` no Light Mode).
2. **Padronização de CRUD e Modais:**
   - Toda entidade criada pelo usuário possui ações padronizadas de **Editar** (ícone `Pencil`) e **Excluir** (ícone `Trash2`).
   - É **terminantemente proibido** usar `window.alert`, `window.confirm` ou `window.prompt`. Toda criação complexa, edição ou confirmação de exclusão deve usar `Dialog` / `AlertDialog` do `shadcn/ui`, e todo feedback de ação deve usar `Toast` (`Sonner`).
3. **Estados de Carregamento (`Skeleton`):**
   - É proibido exibir textos puros como `"Carregando..."`. Toda busca assíncrona deve renderizar componentes `Skeleton` nas dimensões exatas da listagem para evitar *Layout Shift*.
