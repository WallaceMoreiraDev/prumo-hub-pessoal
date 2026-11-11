import { useMemo } from 'react';
import { UuidSchema } from '@shared/schemas/common.schema';
import { AlertCircle, ArrowLeft, RefreshCw } from 'lucide-react';
import { Link, Navigate, useParams } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { SimuladoPosProvaView } from '@/features/simulados/components/SimuladoPosProvaView';
import { SimuladoPreparacaoView } from '@/features/simulados/components/SimuladoPreparacaoView';
import { useSimuladoDetailQuery } from '@/features/simulados/hooks/useSimulados';
import { getErrorMessage } from '@/lib/errorMessages';

function SimuladoDetalheSkeleton() {
  return (
    <div className="space-y-6" aria-busy="true">
      <div className="flex items-center justify-between">
        <Skeleton className="h-8 w-40 rounded-lg" />
        <Skeleton className="h-6 w-28 rounded-lg" />
      </div>
      <div className="space-y-3 rounded-2xl border border-border bg-card p-5">
        <Skeleton className="h-7 w-72 max-w-full" />
        <Skeleton className="h-4 w-96 max-w-full" />
      </div>
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Skeleton className="h-56 rounded-2xl" />
        <Skeleton className="h-56 rounded-2xl" />
      </div>
    </div>
  );
}

export function SimuladoDetalhePage() {
  const { id } = useParams<{ id: string }>();
  const parsedId = useMemo(() => UuidSchema.safeParse(id ?? ''), [id]);
  const validId = parsedId.success ? parsedId.data : '';

  const detailQuery = useSimuladoDetailQuery(validId, Boolean(validId));

  if (!parsedId.success) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link to="/simulados">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>Voltar para Simulados</span>
          </Link>
        </Button>

        <div className="rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5">
          <div className="flex items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <p className="min-w-0 leading-relaxed">
              O identificador do simulado informado na URL é inválido.
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (detailQuery.isPending) {
    return <SimuladoDetalheSkeleton />;
  }

  if (detailQuery.isError || !detailQuery.data) {
    return (
      <div className="space-y-4">
        <Button variant="ghost" size="sm" asChild className="-ml-2 gap-1.5">
          <Link to="/simulados">
            <ArrowLeft className="h-4 w-4" strokeWidth={1.75} />
            <span>Voltar para Simulados</span>
          </Link>
        </Button>

        <div className="flex flex-col gap-3 rounded-2xl border border-rose-500/25 bg-rose-500/10 p-5 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-start gap-2.5 text-sm text-rose-600 dark:text-rose-400">
            <AlertCircle
              className="mt-0.5 h-4 w-4 shrink-0"
              strokeWidth={1.75}
            />
            <p className="min-w-0 break-words leading-relaxed">
              {getErrorMessage(detailQuery.error)}
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => void detailQuery.refetch()}
            className="shrink-0 gap-2"
          >
            <RefreshCw className="h-3.5 w-3.5" strokeWidth={1.75} />
            <span>Tentar novamente</span>
          </Button>
        </div>
      </div>
    );
  }

  const detalhe = detailQuery.data;

  if (detalhe.status === 'EM_ANDAMENTO') {
    return <Navigate to={`/simulados/${detalhe.id}/execucao`} replace />;
  }

  if (detalhe.status === 'PREPARACAO') {
    return <SimuladoPreparacaoView simulado={detalhe} />;
  }

  return <SimuladoPosProvaView simulado={detalhe} />;
}
