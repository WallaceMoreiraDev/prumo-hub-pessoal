import * as React from 'react';
import { Eye, Pencil } from 'lucide-react';
import { MarkdownMathRenderer } from '@/components/markdown/MarkdownMathRenderer';
import { SmartPasteTextarea } from '@/components/markdown/SmartPasteTextarea';
import type { TextareaProps } from '@/components/ui/textarea';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { cn } from '@/lib/utils';

type EditorTab = 'write' | 'preview';

export interface MarkdownEditorFieldProps
  extends Omit<TextareaProps, 'children'> {
  previewContent: string;
  helperText?: React.ReactNode;
  previewClassName?: string;
  emptyPreviewText?: string;
  defaultTab?: EditorTab;
  containerClassName?: string;
}

export const MarkdownEditorField = React.forwardRef<
  HTMLTextAreaElement,
  MarkdownEditorFieldProps
>(
  (
    {
      previewContent,
      helperText,
      previewClassName,
      emptyPreviewText = 'Nada para visualizar ainda. Escreva ou cole Markdown e fórmulas LaTeX na aba Escrever.',
      defaultTab = 'write',
      containerClassName,
      className,
      ...textareaProps
    },
    ref
  ) => {
    const [activeTab, setActiveTab] = React.useState<EditorTab>(defaultTab);
    const hasPreviewContent = previewContent.trim().length > 0;

    return (
      <div className={cn('min-w-0 space-y-2', containerClassName)}>
        <Tabs
          value={activeTab}
          onValueChange={(value) => {
            if (value === 'write' || value === 'preview') {
              setActiveTab(value);
            }
          }}
        >
          <TabsList className="h-8 rounded-lg p-0.5">
            <TabsTrigger
              value="write"
              className="h-7 gap-1.5 rounded-md px-2.5 py-1 text-xs"
            >
              <Pencil className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>Escrever</span>
            </TabsTrigger>
            <TabsTrigger
              value="preview"
              className="h-7 gap-1.5 rounded-md px-2.5 py-1 text-xs"
            >
              <Eye className="h-3 w-3 shrink-0" strokeWidth={1.75} />
              <span>Visualizar</span>
            </TabsTrigger>
          </TabsList>

          {/* forceMount + hidden preserva o DOM/ref de register() do React Hook Form ao alternar abas */}
          <TabsContent
            value="write"
            forceMount
            className={cn('mt-2', activeTab !== 'write' && 'hidden')}
          >
            <SmartPasteTextarea
              ref={ref}
              className={className}
              {...textareaProps}
            />
          </TabsContent>

          <TabsContent value="preview" className="mt-2">
            <div
              className={cn(
                'min-h-[96px] w-full overflow-x-hidden rounded-xl border border-input bg-card/70 px-3.5 py-2.5',
                previewClassName
              )}
            >
              {hasPreviewContent ? (
                <MarkdownMathRenderer content={previewContent} />
              ) : (
                <p className="text-xs italic leading-relaxed text-muted-foreground">
                  {emptyPreviewText}
                </p>
              )}
            </div>
          </TabsContent>
        </Tabs>

        {helperText === undefined ? (
          <p className="text-[11px] leading-relaxed text-muted-foreground">
            Suporta Markdown e fórmulas LaTeX ($...$, $$...$$, \(...\), \[...\])
          </p>
        ) : helperText ? (
          helperText
        ) : null}
      </div>
    );
  }
);

MarkdownEditorField.displayName = 'MarkdownEditorField';
