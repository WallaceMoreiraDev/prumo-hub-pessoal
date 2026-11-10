import { useEffect } from 'react';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  CreateTemaSchema,
  UpdateTemaSchema,
  type CreateTemaInput,
} from '@shared/schemas/temas.schema';
import type { TemaListItemDto } from '@shared/types/temas.types';
import { Loader2 } from 'lucide-react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  useCreateTemaMutation,
  useUpdateTemaMutation,
} from '@/features/temas-revisao/hooks/useTemas';

export interface TemaFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tema?: TemaListItemDto | null;
}

export function TemaFormDialog({
  open,
  onOpenChange,
  tema = null,
}: TemaFormDialogProps) {
  const isEditing = Boolean(tema);
  const createMutation = useCreateTemaMutation();
  const updateMutation = useUpdateTemaMutation();
  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  const form = useForm<CreateTemaInput>({
    resolver: zodResolver(isEditing ? UpdateTemaSchema : CreateTemaSchema),
    defaultValues: {
      nome: tema?.nome ?? '',
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        nome: tema?.nome ?? '',
      });
    }
  }, [open, tema, form]);

  async function handleSubmit(values: CreateTemaInput): Promise<void> {
    try {
      if (tema) {
        await updateMutation.mutateAsync({
          id: tema.id,
          input: values,
        });
      } else {
        await createMutation.mutateAsync(values);
      }
      onOpenChange(false);
    } catch {
      // Erro tratado via toast no hook.
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar Tema' : 'Novo Tema'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Atualize o nome do tema mantendo seu histórico de revisões e conexões.'
              : 'Cadastre um tema de estudo para acompanhar revisões e construir conexões.'}
          </DialogDescription>
        </DialogHeader>

        <form
          onSubmit={form.handleSubmit(handleSubmit)}
          noValidate
          className="space-y-4"
        >
          <div className="space-y-2">
            <Label htmlFor="tema-nome">Nome do tema</Label>
            <Input
              id="tema-nome"
              autoFocus
              placeholder="Ex.: Dijkstra, Eletrodinâmica, Geometria Espacial"
              disabled={isSubmitting}
              {...form.register('nome')}
            />
            {form.formState.errors.nome ? (
              <p className="text-xs text-rose-600 dark:text-rose-400">
                {form.formState.errors.nome.message}
              </p>
            ) : (
              <p className="text-xs text-muted-foreground">
                Utilize o nome limpo sem o caractere &quot;#&quot;.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              disabled={isSubmitting}
              onClick={() => onOpenChange(false)}
            >
              Cancelar
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? (
                <>
                  <Loader2
                    className="h-4 w-4 animate-spin"
                    strokeWidth={1.75}
                  />
                  <span>Salvando...</span>
                </>
              ) : (
                <span>{isEditing ? 'Salvar alterações' : 'Criar tema'}</span>
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
