import { BookX } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function CadernoErrosPage() {
  return (
    <div className="space-y-6">
      <header className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="space-y-1">
          <div className="flex items-center gap-2.5">
            <BookX className="h-5 w-5 text-primary" strokeWidth={1.75} />
            <h1 className="text-2xl font-bold tracking-tight">
              Caderno de Erros
            </h1>
          </div>
          <p className="text-sm leading-relaxed text-muted-foreground">
            Centralização de questões pendentes, revisões honestas e registro
            manual de fontes externas ou genéricas.
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
            Esta tela receberá as listagens em 2 níveis de erros pendentes e
            revisados, cadastro manual restrito e ações de revisão vinculadas
            aos temas.
          </CardDescription>
        </CardHeader>
      </Card>
    </div>
  );
}
