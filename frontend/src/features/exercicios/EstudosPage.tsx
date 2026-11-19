import { Clock } from 'lucide-react';
import { EstudosResumoView } from '@/features/exercicios/components/EstudosResumoView';

export function EstudosPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-1">
        <div className="flex items-center gap-2.5">
          <Clock className="h-5 w-5 shrink-0 text-primary" strokeWidth={1.75} />
          <h1 className="text-2xl font-bold tracking-tight">
            Diário de Foco e Estudos
          </h1>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground">
          Acompanhe o tempo de resolução de exercícios avulsos, distribuição de
          foco por tema e gere relatórios consolidados em Markdown para IA.
        </p>
      </header>

      <EstudosResumoView />
    </div>
  );
}
