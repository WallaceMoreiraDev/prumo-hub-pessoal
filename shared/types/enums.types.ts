import type { Database } from './database.types';

export type ReviewMode = Database['public']['Enums']['review_mode_enum'];
export type SimuladoStatus = Database['public']['Enums']['simulado_status_enum'];
export type QuestaoResultado = Database['public']['Enums']['questao_resultado_enum'];
export type ErroOrigem = Database['public']['Enums']['erro_origem_enum'];
export type ErroStatus = Database['public']['Enums']['erro_status_enum'];

export type ManualErrorOrigin = Exclude<ErroOrigem, 'SIMULADO'>;

export const REVIEW_MODES = ['SOLO', 'HELP'] as const satisfies readonly ReviewMode[];

export const SIMULADO_STATUSES = [
  'PREPARACAO',
  'EM_ANDAMENTO',
  'FINALIZADO',
] as const satisfies readonly SimuladoStatus[];

export const QUESTAO_RESULTADOS = [
  'ACERTEI',
  'PARCIAL',
  'ERREI',
] as const satisfies readonly QuestaoResultado[];

export const ERRO_ORIGENS = [
  'SIMULADO',
  'EXTERNAL_LINK',
  'GENERIC_FULL',
] as const satisfies readonly ErroOrigem[];

export const MANUAL_ERROR_ORIGINS = [
  'EXTERNAL_LINK',
  'GENERIC_FULL',
] as const satisfies readonly ManualErrorOrigin[];

export const ERRO_STATUSES = [
  'PENDENTE',
  'REVISADO',
] as const satisfies readonly ErroStatus[];
