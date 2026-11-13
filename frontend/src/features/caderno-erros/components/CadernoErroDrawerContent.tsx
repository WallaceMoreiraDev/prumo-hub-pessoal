import type { CadernoErroDto } from '@shared/types/caderno-erros.types';
import {
  Calendar,
  CheckCircle2,
  ChevronUp,
  Clock,
  ExternalLink,
  FileText,
  LifeBuoy,
  MessageSquareText,
  Pencil,
  PenTool,
  Timer,
} from 'lucide-react';
import { CollapsibleStickySection } from '@/components/layout/CollapsibleStickySection';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { LousaPreviewCard } from '@/features/lousas/components/LousaPreviewCard';
import {
  QUESTAO_RESULTADO_LABELS,
  formatTempoDecorrido,
  isSafeHttpUrl,
} from '@/features/caderno-erros/utils/cadernoErros';
import { formatLocalDateTime } from '@/lib/date';

export interface CadernoErroDrawerContentProps {
  erro: CadernoErroDto;
  onEdit: (erro: CadernoErroDto) => void;
  onCollapse?: () => void;
}

function getResultadoBadgeVariant(
  resultado: NonNullable<CadernoErroDto['simuladoMeta']>['resultado']
): 'success' | 'warning' | 'destructive' | 'secondary' {
  switch (resultado) {
    case 'ACERTEI':
      return 'success';
    case 'PARCIAL':
      return 'warning';
    case 'ERREI':
      return 'destructive';
    default:
      return 'secondary';
  }
}

export function CadernoErroDrawerContent({
  erro,
  onEdit,
  onCollapse,
}: CadernoErroDrawerContentProps) {
  const safeLink = isSafeHttpUrl(erro.linkExterno) ? erro.linkExterno : null;

  return (
    <div className="animate-accordion-down space-y-4 rounded-b-2xl border-t border-border bg-muted/30 p-4 sm:p-5">
      <section
        aria-label="Metadados e temas vinculados"
        className="space-y-3 rounded-xl border border-border bg-card p-4"
      >
        <div className="flex flex-col gap-2 text-xs text-muted-foreground sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <span className="inline-flex items-center gap-1.5">
            <Calendar className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
            <span>Registrado em {formatLocalDateTime(erro.createdAt)}</span>
          </span>

          {erro.lastReviewedAt ? (
            <span className="inline-flex flex-wrap items-center gap-1.5">
              {erro.lastReviewMode === 'SOLO' ? (
                <CheckCircle2
                  className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400"
                  strokeWidth={1.75}
                />
              ) : (
                <LifeBuoy
                  className="h-3.5 w-3.5 shrink-0 text-amber-600 dark:text-amber-400"
                  strokeWidth={1.75}
                />
              )}
              <span>
                Última revisão em {formatLocalDateTime(erro.lastReviewedAt)} (
                {erro.lastReviewMode === 'SOLO' ? 'Sozinho' : 'Com Ajuda'})
              </span>
            </span>
          ) : null}
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-start">
          <span className="shrink-0 pt-0.5 text-xs font-medium text-muted-foreground">
            Temas vinculados:
          </span>
          {erro.temas.length > 0 ? (
            <div className="flex min-w-0 flex-1 flex-wrap gap-1.5">
              {erro.temas.map((tema) => (
                <Badge
                  key={tema.id}
                  variant="secondary"
                  className="max-w-full font-normal"
                >
                  <span className="truncate">{tema.nome}</span>
                </Badge>
              ))}
            </div>
          ) : (
            <span className="text-xs italic text-muted-foreground">
              Nenhum tema vinculado.
            </span>
          )}
        </div>
      </section>

      {erro.origem === 'SIMULADO' ? (
        <section
          aria-label="Detalhes do simulado e pensamentos da prova"
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          {erro.simuladoMeta ? (
            <>
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div className="min-w-0 space-y-1.5">
                  <div className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                    <Timer className="h-3.5 w-3.5 shrink-0" strokeWidth={1.75} />
                    <span className="min-w-0 break-words">
                      Simulado: {erro.simuladoMeta.simuladoTitulo || 'Sem título'}
                    </span>
                  </div>

                  <div className="flex min-w-0 flex-wrap items-center gap-2">
                    <span className="shrink-0 rounded-md border border-border bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground">
                      {erro.simuladoMeta.numeroQuestao}
                    </span>
                    <h3 className="min-w-0 break-words text-sm font-semibold text-foreground">
                      {erro.simuladoMeta.tituloQuestao}
                    </h3>
                  </div>
                </div>

                {erro.simuladoMeta.resultado ? (
                  <Badge
                    variant={getResultadoBadgeVariant(
                      erro.simuladoMeta.resultado
                    )}
                    className="w-fit shrink-0 whitespace-nowrap"
                  >
                    {QUESTAO_RESULTADO_LABELS[erro.simuladoMeta.resultado]}
                  </Badge>
                ) : null}
              </div>

              <div className="border-t border-border/60 pt-3">
                <CollapsibleStickySection
                  variant="standalone"
                  headingAs="h4"
                  ariaLabel="Pensamentos durante a prova"
                  title={`Pensamentos durante a prova (${erro.simuladoMeta.pensamentos.length})`}
                  icon={
                    <Clock
                      className="h-3.5 w-3.5 text-primary"
                      strokeWidth={1.75}
                    />
                  }
                  defaultOpen={true}
                >
                  {erro.simuladoMeta.pensamentos.length === 0 ? (
                    <p className="text-xs italic leading-relaxed text-muted-foreground">
                      Nenhum pensamento registrado durante a prova para esta
                      questão.
                    </p>
                  ) : (
                    <ul className="space-y-2">
                      {erro.simuladoMeta.pensamentos.map((pensamento) => {
                        const formattedTempo = formatTempoDecorrido(
                          pensamento.tempoDecorridoSegundos
                        );
                        return (
                          <li
                            key={pensamento.id}
                            className="flex flex-col gap-1.5 rounded-xl border border-border/70 bg-muted/30 p-3 sm:flex-row sm:items-start sm:gap-3"
                          >
                            <span className="shrink-0 whitespace-nowrap font-mono text-xs font-medium text-muted-foreground">
                              {formattedTempo
                                ? `[${formattedTempo}]`
                                : formatLocalDateTime(pensamento.createdAt)}
                            </span>
                            <MarkdownMathRenderer
                              content={pensamento.descricao}
                              className="min-w-0 flex-1"
                            />
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </CollapsibleStickySection>
              </div>
            </>
          ) : (
            <p className="text-xs italic text-muted-foreground">
              Origem: Simulado (detalhes da questão indisponíveis).
            </p>
          )}
        </section>
      ) : null}

      {erro.origem === 'EXTERNAL_LINK' ? (
        <section
          aria-label="Referência externa da questão"
          className="space-y-3 rounded-xl border border-border bg-card p-4"
        >
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-xs font-medium text-muted-foreground">
              Código / Referência:
            </span>
            <span className="rounded-md border border-border bg-muted/70 px-2 py-0.5 font-mono text-xs font-medium text-foreground">
              {erro.codigoReferencia ?? '—'}
            </span>
          </div>

          <div className="space-y-1">
            <span className="block text-xs font-medium text-muted-foreground">
              Link da questão:
            </span>
            {safeLink ? (
              <a
                href={safeLink}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex max-w-full items-start gap-1.5 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
              >
                <ExternalLink
                  className="mt-0.5 h-4 w-4 shrink-0"
                  strokeWidth={1.75}
                />
                <span className="break-all">{safeLink}</span>
              </a>
            ) : erro.linkExterno ? (
              <p className="break-all text-sm text-muted-foreground">
                {erro.linkExterno}
              </p>
            ) : (
              <p className="text-xs italic text-muted-foreground">
                Link externo não informado.
              </p>
            )}
          </div>
        </section>
      ) : null}

      {erro.origem === 'GENERIC_FULL' ? (
        <CollapsibleStickySection
          variant="card"
          ariaLabel="Enunciado completo da questão"
          title="Enunciado completo"
          icon={
            <FileText
              className="h-4 w-4 text-primary"
              strokeWidth={1.75}
            />
          }
          defaultOpen={true}
          bodyClassName="space-y-3"
        >
          {erro.enunciadoCompleto ? (
            <MarkdownMathRenderer content={erro.enunciadoCompleto} />
          ) : (
            <p className="text-xs italic leading-relaxed text-muted-foreground">
              Enunciado não informado.
            </p>
          )}

          {erro.linkExterno ? (
            <div className="space-y-1 border-t border-border/60 pt-3">
              <span className="block text-xs font-medium text-muted-foreground">
                Link de referência:
              </span>
              {safeLink ? (
                <a
                  href={safeLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex max-w-full items-start gap-1.5 break-all text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  <ExternalLink
                    className="mt-0.5 h-4 w-4 shrink-0"
                    strokeWidth={1.75}
                  />
                  <span className="break-all">{safeLink}</span>
                </a>
              ) : (
                <p className="break-all text-sm text-muted-foreground">
                  {erro.linkExterno}
                </p>
              )}
            </div>
          ) : null}
        </CollapsibleStickySection>
      ) : null}

      <CollapsibleStickySection
        variant="card"
        ariaLabel="Observação pós-revisão"
        title="Observação pós-revisão / diagnóstico"
        icon={
          <MessageSquareText
            className="h-4 w-4 text-primary"
            strokeWidth={1.75}
          />
        }
        defaultOpen={true}
        actions={
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => onEdit(erro)}
            className="shrink-0 gap-1.5"
          >
            <Pencil className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Editar observação / temas</span>
          </Button>
        }
      >
        {erro.observacaoErro ? (
          <MarkdownMathRenderer content={erro.observacaoErro} />
        ) : (
          <p className="text-xs italic leading-relaxed text-muted-foreground">
            Nenhuma observação pós-revisão registrada até o momento.
          </p>
        )}
      </CollapsibleStickySection>

      {erro.lousa ? (
        <CollapsibleStickySection
          variant="card"
          ariaLabel="Lousa vinculada"
          title="Lousa vinculada"
          icon={
            <PenTool className="h-4 w-4 text-primary" strokeWidth={1.75} />
          }
          defaultOpen={true}
        >
          <LousaPreviewCard
            lousa={erro.lousa}
            title="Lousa do registro"
          />
        </CollapsibleStickySection>
      ) : null}

      {onCollapse ? (
        <div className="flex justify-end border-t border-border/60 pt-3">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={onCollapse}
            className="gap-1.5 text-xs text-muted-foreground hover:text-foreground"
          >
            <ChevronUp className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Recolher detalhes</span>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
