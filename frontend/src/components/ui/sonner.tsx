import { Toaster as SonnerToaster, type ToasterProps } from 'sonner';
import { useTheme } from '@/components/theme/ThemeProvider';

export function Toaster(props: ToasterProps) {
  const { theme } = useTheme();

  return (
    <SonnerToaster
      theme={theme}
      position="bottom-right"
      toastOptions={{
        classNames: {
          toast:
            'rounded-xl border border-border bg-card text-foreground shadow-lg font-sans',
          title: 'text-sm font-medium',
          description: 'text-xs text-muted-foreground',
          actionButton:
            'bg-primary text-primary-foreground rounded-lg text-xs font-medium',
          cancelButton:
            'bg-secondary text-secondary-foreground rounded-lg text-xs font-medium',
        },
      }}
      {...props}
    />
  );
}
