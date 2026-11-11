import { QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes } from 'react-router-dom';
import { AppLayout } from '@/components/layout/AppLayout';
import { EnvConfigErrorScreen } from '@/components/layout/EnvConfigErrorScreen';
import { ThemeProvider } from '@/components/theme/ThemeProvider';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { envValidation } from '@/config/env';
import { AuthProvider } from '@/features/auth/AuthContext';
import { LoginPage } from '@/features/auth/LoginPage';
import { ProtectedRoute } from '@/features/auth/ProtectedRoute';
import { CadernoErrosPage } from '@/features/caderno-erros/CadernoErrosPage';
import { SimuladoDetalhePage } from '@/features/simulados/SimuladoDetalhePage';
import { SimuladoExecucaoPage } from '@/features/simulados/SimuladoExecucaoPage';
import { SimuladosPage } from '@/features/simulados/SimuladosPage';
import { TemasRevisaoPage } from '@/features/temas-revisao/TemasRevisaoPage';
import { queryClient } from '@/lib/queryClient';

export function App() {
  if (!envValidation.success) {
    return (
      <ThemeProvider>
        <EnvConfigErrorScreen issues={envValidation.issues} />
        <Toaster />
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <TooltipProvider delayDuration={250}>
        <QueryClientProvider client={queryClient}>
          <AuthProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />

                <Route element={<ProtectedRoute />}>
                  <Route element={<AppLayout />}>
                    <Route path="/" element={<Navigate to="/temas" replace />} />
                    <Route path="/temas" element={<TemasRevisaoPage />} />
                    <Route
                      path="/caderno-erros"
                      element={<CadernoErrosPage />}
                    />
                    <Route path="/simulados" element={<SimuladosPage />} />
                    <Route
                      path="/simulados/:id"
                      element={<SimuladoDetalhePage />}
                    />
                  </Route>
                  <Route
                    path="/simulados/:id/execucao"
                    element={<SimuladoExecucaoPage />}
                  />
                </Route>

                <Route path="*" element={<Navigate to="/temas" replace />} />
              </Routes>
            </BrowserRouter>
          </AuthProvider>
        </QueryClientProvider>
      </TooltipProvider>
      <Toaster />
    </ThemeProvider>
  );
}
