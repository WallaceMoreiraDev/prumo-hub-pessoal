import { Timer } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function SimuladosPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <Timer className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-bold tracking-tight">Simulados</h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Preparação de provas em PDF, execução com cronômetro resiliente e
            classificação pós-prova integrada ao Caderno de Erros.
          </p>
        </div>

        <Badge variant="secondary" className="w-fit">
          Em preparação
        </Badge>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>Módulo em implementação nesta fatia vertical</CardTitle>
          <CardDescription>
            Esta tela receberá a lista de simulados, preparação de questões,
            ambiente de execução isolado com PDF e fluxo de revisão pós-prova.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
