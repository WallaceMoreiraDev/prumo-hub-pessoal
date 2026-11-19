import { ERROR_CODES, type PaginationMeta } from '@shared/types/api.types';
import type {
  CreateExercicioAvulsoInput,
  EstudosResumoQuery,
  ListExerciciosQuery,
  UpdateExercicioAvulsoInput,
} from '@shared/schemas/exercicios.schema';
import type {
  EstudoExportIaDto,
  EstudoResumoItemDto,
  EstudoResumoTemaDto,
  EstudosResumoPeriodoDto,
  ExercicioAvulsoDetalheDto,
  ExercicioAvulsoSummaryDto,
} from '@shared/types/exercicios.types';
import type { LousaSignedUrlsDto } from '@shared/types/lousas.types';
import type { TemaSummaryDto } from '@shared/types/temas.types';
import type { EdgeLogger } from '../../config/logger';
import type { AppSupabaseClient } from '../../config/supabase';
import { AppError } from '../../errors/AppError';
import { buildPaginationMeta } from '../../utils/response';
import type { LousaRelationRow } from '../lousas/lousas.mapper';
import type { LousaStoragePaths } from '../lousas/lousas.repository';
import { lousasService } from '../lousas/lousas.service';
import {
  compareTemaByNome,
  mapTemaSummaryDto,
  unwrapSingleRelation,
} from '../temas/temas.mapper';
import { temasRepository } from '../temas/temas.repository';
import {
  mapExercicioAvulsoDetalheDto,
  mapExercicioAvulsoSummaryDto,
  type ExercicioWithRelationsRow,
} from './exercicios.mapper';
import {
  exerciciosRepository,
  type ExercicioResumoRow,
  type ReflexaoResumoRow,
} from './exercicios.repository';

export interface ListExerciciosResult {
  items: ExercicioAvulsoSummaryDto[];
  pagination: PaginationMeta;
}

function toLousaStoragePaths(
  lousaRow: Pick<
    LousaRelationRow,
    'id' | 'scene_storage_path' | 'preview_storage_path'
  > | null
): LousaStoragePaths | null {
  if (!lousaRow) {
    return null;
  }
  return {
    id: lousaRow.id,
    sceneStoragePath: lousaRow.scene_storage_path,
    previewStoragePath: lousaRow.preview_storage_path,
  };
}

function formatSecondsToClock(totalSeconds: number): string {
  const safeSeconds = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safeSeconds / 3600);
  const minutes = Math.floor((safeSeconds % 3600) / 60);
  const seconds = safeSeconds % 60;
  return `${String(hours).padStart(2, '0')}:${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export class ExerciciosService {
  private async ensureAllTemasExist(
    supabase: AppSupabaseClient,
    userId: string,
    temaIds: readonly string[]
  ): Promise<void> {
    const uniqueIds = [...new Set(temaIds)];
    if (uniqueIds.length === 0) {
      throw new AppError(ERROR_CODES.TEMAS_REQUIRED, 400);
    }

    const existingCount = await temasRepository.countTemasByIds(
      supabase,
      userId,
      uniqueIds
    );

    if (existingCount !== uniqueIds.length) {
      throw new AppError(ERROR_CODES.TEMA_NOT_FOUND, 404);
    }
  }

  public async create(
    supabase: AppSupabaseClient,
    userId: string,
    input: CreateExercicioAvulsoInput,
    logger?: EdgeLogger
  ): Promise<ExercicioAvulsoSummaryDto> {
    await this.ensureAllTemasExist(supabase, userId, input.temaIds);

    if (input.lousaId) {
      await lousasService.ensureLousaAvailableForLink(
        supabase,
        userId,
        input.lousaId
      );
    }

    const createdRow = await exerciciosRepository.createViaRpc(
      supabase,
      userId,
      input
    );

    const previewUrlMap = await lousasService.hydratePreviewSignedUrls(
      supabase,
      [unwrapSingleRelation(createdRow.lousa)],
      logger
    );

    return mapExercicioAvulsoSummaryDto(createdRow, previewUrlMap);
  }

  public async list(
    supabase: AppSupabaseClient,
    userId: string,
    query: ListExerciciosQuery,
    logger?: EdgeLogger
  ): Promise<ListExerciciosResult> {
    const { rows, total } = await exerciciosRepository.findMany(
      supabase,
      userId,
      query
    );

    const previewUrlMap = await lousasService.hydratePreviewSignedUrls(
      supabase,
      rows.map((row) => unwrapSingleRelation(row.lousa)),
      logger
    );

    return {
      items: rows.map((row) =>
        mapExercicioAvulsoSummaryDto(row, previewUrlMap)
      ),
      pagination: buildPaginationMeta(query.page, query.limit, total),
    };
  }

  public async getById(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    logger?: EdgeLogger
  ): Promise<ExercicioAvulsoDetalheDto> {
    const row = await exerciciosRepository.findById(supabase, id, userId);
    if (!row) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    let lousaSignedUrls: LousaSignedUrlsDto | null = null;
    let previewUrlMap: Map<string, string | null> | undefined;

    if (row.lousa_id) {
      try {
        lousaSignedUrls = await lousasService.getUrls(
          supabase,
          userId,
          row.lousa_id,
          logger
        );
        previewUrlMap = new Map([[row.lousa_id, lousaSignedUrls.previewSignedUrl]]);
      } catch (err) {
        logger?.warn('Falha ao obter signed URLs da lousa do exercício', {
          exercicioId: id,
          lousaId: row.lousa_id,
          error: err instanceof Error ? err.message : String(err),
        });
      }
    }

    return mapExercicioAvulsoDetalheDto(row, previewUrlMap, lousaSignedUrls);
  }

  public async update(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    input: UpdateExercicioAvulsoInput,
    logger?: EdgeLogger
  ): Promise<ExercicioAvulsoSummaryDto> {
    const existingRow = await exerciciosRepository.findById(supabase, id, userId);
    if (!existingRow) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    if (input.temaIds !== undefined) {
      await this.ensureAllTemasExist(supabase, userId, input.temaIds);
    }

    if (
      input.lousaId !== undefined &&
      input.lousaId !== null &&
      input.lousaId !== existingRow.lousa_id
    ) {
      await lousasService.ensureLousaAvailableForLink(
        supabase,
        userId,
        input.lousaId
      );
    }

    const previousLousaPaths = toLousaStoragePaths(
      unwrapSingleRelation(existingRow.lousa)
    );

    const updatedRow = await exerciciosRepository.update(
      supabase,
      id,
      userId,
      input,
      existingRow
    );

    if (
      previousLousaPaths &&
      input.lousaId !== undefined &&
      input.lousaId !== existingRow.lousa_id
    ) {
      await lousasService.removeLousaFilesBestEffort(
        supabase,
        [previousLousaPaths],
        logger
      );
    }

    const previewUrlMap = await lousasService.hydratePreviewSignedUrls(
      supabase,
      [unwrapSingleRelation(updatedRow.lousa)],
      logger
    );

    return mapExercicioAvulsoSummaryDto(updatedRow, previewUrlMap);
  }

  public async delete(
    supabase: AppSupabaseClient,
    userId: string,
    id: string,
    logger?: EdgeLogger
  ): Promise<{ id: string }> {
    const existing = await exerciciosRepository.findById(supabase, id, userId);
    if (!existing) {
      throw new AppError(ERROR_CODES.EXERCICIO_NOT_FOUND, 404);
    }

    const lousaPaths = toLousaStoragePaths(unwrapSingleRelation(existing.lousa));

    const result = await exerciciosRepository.delete(supabase, id, userId);

    if (lousaPaths) {
      await lousasService.removeLousaFilesBestEffort(
        supabase,
        [lousaPaths],
        logger
      );
    }

    return result;
  }

  public async getResumoPeriodo(
    supabase: AppSupabaseClient,
    userId: string,
    query: EstudosResumoQuery
  ): Promise<EstudosResumoPeriodoDto> {
    const periodo = query.periodo || 'dia';
    let dataReferencia: string;
    let dataInicioIso: string;
    let dataFimIso: string;

    if (periodo === 'dia') {
      dataReferencia = query.data || new Date().toISOString().slice(0, 10);
      dataInicioIso = `${dataReferencia}T00:00:00.000Z`;
      dataFimIso = `${dataReferencia}T23:59:59.999Z`;
    } else if (periodo === 'semana') {
      dataReferencia = query.data || new Date().toISOString().slice(0, 10);
      const parts = dataReferencia.split('-').map(Number);
      const year = parts[0] ?? 2026;
      const month = parts[1] ?? 1;
      const day = parts[2] ?? 1;
      const refDate = new Date(Date.UTC(year, month - 1, day));
      const dayOfWeek = refDate.getUTCDay(); // 0 = Domingo, 1 = Segunda
      const diffToMonday = dayOfWeek === 0 ? -6 : 1 - dayOfWeek;
      const monday = new Date(refDate.getTime() + diffToMonday * 86400000);
      const sunday = new Date(monday.getTime() + 6 * 86400000);

      dataInicioIso = `${monday.toISOString().slice(0, 10)}T00:00:00.000Z`;
      dataFimIso = `${sunday.toISOString().slice(0, 10)}T23:59:59.999Z`;
    } else {
      // custom
      if (!query.dataInicio || !query.dataFim) {
        throw new AppError(ERROR_CODES.VALIDATION_ERROR, 400, [
          {
            path: 'dataInicio',
            message: 'Informe dataInicio e dataFim para o período custom.',
          },
        ]);
      }
      dataInicioIso = query.dataInicio;
      dataFimIso = query.dataFim;
      dataReferencia = query.data || query.dataInicio.slice(0, 10);
    }

    const rawData = await exerciciosRepository.findResumoPeriodoData(
      supabase,
      userId,
      dataInicioIso,
      dataFimIso
    );

    let tempoTotalSegundos = 0;
    let totalSolo = 0;
    let totalHelp = 0;
    let totalSemDesfecho = 0;

    const temaAggregationMap = new Map<
      string,
      {
        temaId: string;
        nomeTema: string;
        totalExercicios: number;
        totalReflexoes: number;
        tempoTotalSegundos: number;
        solo: number;
        help: number;
        semDesfecho: number;
      }
    >();

    const itens: EstudoResumoItemDto[] = [];

    for (const ex of rawData.exercicios) {
      tempoTotalSegundos += ex.duracao_segundos;
      if (ex.desfecho === 'SOLO') totalSolo++;
      else if (ex.desfecho === 'HELP') totalHelp++;
      else totalSemDesfecho++;

      const exTemasMap = new Map<string, TemaSummaryDto>();
      for (const tRow of ex.exercicio_temas ?? []) {
        const tema = unwrapSingleRelation(tRow.tema);
        if (tema) {
          exTemasMap.set(tema.id, mapTemaSummaryDto(tema));

          let agg = temaAggregationMap.get(tema.id);
          if (!agg) {
            agg = {
              temaId: tema.id,
              nomeTema: tema.nome,
              totalExercicios: 0,
              totalReflexoes: 0,
              tempoTotalSegundos: 0,
              solo: 0,
              help: 0,
              semDesfecho: 0,
            };
            temaAggregationMap.set(tema.id, agg);
          }
          agg.totalExercicios++;
          agg.tempoTotalSegundos += ex.duracao_segundos;
          if (ex.desfecho === 'SOLO') agg.solo++;
          else if (ex.desfecho === 'HELP') agg.help++;
          else agg.semDesfecho++;
        }
      }

      itens.push({
        tipo: 'EXERCICIO',
        id: ex.id,
        titulo: ex.titulo,
        createdAt: ex.created_at,
        duracaoSegundos: ex.duracao_segundos,
        desfecho: ex.desfecho,
        temas: Array.from(exTemasMap.values()).sort(compareTemaByNome),
        hasLousa: Boolean(ex.lousa_id),
      });
    }

    for (const ref of rawData.reflexoes) {
      const refTemasMap = new Map<string, TemaSummaryDto>();
      const principal = unwrapSingleRelation(ref.tema_principal);
      if (principal) {
        refTemasMap.set(principal.id, mapTemaSummaryDto(principal));
      }
      for (const cRow of ref.reflexao_temas_conectados ?? []) {
        const conectado = unwrapSingleRelation(cRow.tema_conectado);
        if (conectado) {
          refTemasMap.set(conectado.id, mapTemaSummaryDto(conectado));
        }
      }

      for (const tema of refTemasMap.values()) {
        let agg = temaAggregationMap.get(tema.id);
        if (!agg) {
          agg = {
            temaId: tema.id,
            nomeTema: tema.nome,
            totalExercicios: 0,
            totalReflexoes: 0,
            tempoTotalSegundos: 0,
            solo: 0,
            help: 0,
            semDesfecho: 0,
          };
          temaAggregationMap.set(tema.id, agg);
        }
        agg.totalReflexoes++;
      }

      const tituloRef = ref.conteudo
        ? ref.conteudo.length > 80
          ? `${ref.conteudo.slice(0, 80)}...`
          : ref.conteudo
        : 'Reflexão com Lousa';

      itens.push({
        tipo: 'REFLEXAO',
        id: ref.id,
        titulo: tituloRef,
        createdAt: ref.created_at,
        temas: Array.from(refTemasMap.values()).sort(compareTemaByNome),
        hasLousa: Boolean(ref.lousa_id),
      });
    }

    // Ordenação cronológica reversa
    itens.sort(
      (a, b) => Date.parse(b.createdAt) - Date.parse(a.createdAt)
    );

    const temasAbordados: EstudoResumoTemaDto[] = Array.from(
      temaAggregationMap.values()
    )
      .map((agg) => ({
        temaId: agg.temaId,
        nomeTema: agg.nomeTema,
        totalExercicios: agg.totalExercicios,
        totalReflexoes: agg.totalReflexoes,
        tempoTotalSegundos: agg.tempoTotalSegundos,
        desfechos: {
          solo: agg.solo,
          help: agg.help,
          semDesfecho: agg.semDesfecho,
        },
      }))
      .sort((a, b) => {
        if (b.tempoTotalSegundos !== a.tempoTotalSegundos) {
          return b.tempoTotalSegundos - a.tempoTotalSegundos;
        }
        return a.nomeTema.localeCompare(b.nomeTema, 'pt-BR');
      });

    return {
      periodo,
      dataReferencia,
      dataInicioIso,
      dataFimIso,
      tempoTotalSegundos,
      totalExercicios: rawData.exercicios.length,
      totalSolo,
      totalHelp,
      totalSemDesfecho,
      totalReflexoes: rawData.reflexoes.length,
      temasAbordados,
      itens,
    };
  }

  public async exportIa(
    supabase: AppSupabaseClient,
    userId: string,
    query: EstudosResumoQuery
  ): Promise<EstudoExportIaDto> {
    const resumo = await this.getResumoPeriodo(supabase, userId, query);

    // Busca detalhes dos exercícios do período para relatório enriquecido
    const { rows: exerciciosDetalhados } = await exerciciosRepository.findMany(
      supabase,
      userId,
      {
        page: 1,
        limit: 100,
      }
    );

    const exerciciosFiltradosNoPeriodo = exerciciosDetalhados.filter(
      (ex) =>
        ex.created_at >= resumo.dataInicioIso &&
        ex.created_at <= resumo.dataFimIso
    );

    let periodoLabel: string;
    if (resumo.periodo === 'dia') {
      periodoLabel = `Dia ${resumo.dataReferencia}`;
    } else if (resumo.periodo === 'semana') {
      periodoLabel = `Semana de ${resumo.dataInicioIso.slice(0, 10)} a ${resumo.dataFimIso.slice(0, 10)}`;
    } else {
      periodoLabel = `Período de ${resumo.dataInicioIso.slice(0, 10)} a ${resumo.dataFimIso.slice(0, 10)}`;
    }

    const pctSolo =
      resumo.totalExercicios > 0
        ? Math.round((resumo.totalSolo / resumo.totalExercicios) * 100)
        : 0;
    const pctHelp =
      resumo.totalExercicios > 0
        ? Math.round((resumo.totalHelp / resumo.totalExercicios) * 100)
        : 0;
    const pctSem =
      resumo.totalExercicios > 0
        ? Math.round((resumo.totalSemDesfecho / resumo.totalExercicios) * 100)
        : 0;

    const lines: string[] = [
      `# Relatório de Estudos — ${periodoLabel}`,
      '',
      `> Gerado em: ${new Date().toISOString()}`,
      `> Janela temporal (UTC): ${resumo.dataInicioIso} até ${resumo.dataFimIso}`,
      '',
      '## Métricas Gerais de Produtividade',
      '',
      `- **Tempo Total Dedicado:** [${formatSecondsToClock(resumo.tempoTotalSegundos)}] (${Math.round(resumo.tempoTotalSegundos / 60)} min)`,
      `- **Total de Exercícios Concluídos:** ${resumo.totalExercicios}`,
      `- **Proporção Solo vs Ajuda:** ${resumo.totalSolo} Solo (${pctSolo}%) | ${resumo.totalHelp} Com Ajuda (${pctHelp}%) | ${resumo.totalSemDesfecho} Sem desfecho (${pctSem}%)`,
      `- **Total de Reflexões / Conexões Registradas:** ${resumo.totalReflexoes}`,
      '',
      '## Foco por Tema',
      '',
    ];

    if (resumo.temasAbordados.length === 0) {
      lines.push('_Nenhum tema registrado no período selecionado._', '');
    } else {
      lines.push(
        '| Tema | Exercícios | Tempo Dedicado | Solo | Ajuda | Reflexões |',
        '| --- | --- | --- | --- | --- | --- |'
      );
      for (const t of resumo.temasAbordados) {
        lines.push(
          `| ${t.nomeTema} | ${t.totalExercicios} | [${formatSecondsToClock(t.tempoTotalSegundos)}] | ${t.desfechos.solo} | ${t.desfechos.help} | ${t.totalReflexoes} |`
        );
      }
      lines.push('');
    }

    lines.push('## Sessões e Exercícios Realizados', '');

    if (exerciciosFiltradosNoPeriodo.length === 0) {
      lines.push('_Nenhum exercício registrado neste período._', '');
    } else {
      for (let i = 0; i < exerciciosFiltradosNoPeriodo.length; i++) {
        const ex = exerciciosFiltradosNoPeriodo[i]!;
        const desfechoLabel =
          ex.desfecho === 'SOLO'
            ? 'Finalizado Sozinho (SOLO)'
            : ex.desfecho === 'HELP'
              ? 'Com Ajuda (HELP)'
              : 'Sem desfecho informado';

        const temasStr =
          (ex.exercicio_temas ?? [])
            .map((t) => unwrapSingleRelation(t.tema)?.nome)
            .filter(Boolean)
            .join(', ') || 'Nenhum';

        lines.push(
          `### ${i + 1}. ${ex.titulo}`,
          '',
          `- **Criado em:** ${ex.created_at}`,
          `- **Duração:** [${formatSecondsToClock(ex.duracao_segundos)}]`,
          `- **Desfecho:** ${desfechoLabel}`,
          `- **Lousa Vinculada:** ${ex.lousa_id ? 'Sim' : 'Não'}`,
          `- **Temas:** ${temasStr}`
        );

        if (ex.link_externo) {
          lines.push(`- **Link:** ${ex.link_externo}`);
        }

        if (ex.enunciado) {
          lines.push('', '**Enunciado / Contexto:**', `> ${ex.enunciado.replace(/\n/g, '\n> ')}`);
        }

        if (ex.observacao) {
          lines.push('', '**Anotações de Raciocínio / Erros:**', `> ${ex.observacao.replace(/\n/g, '\n> ')}`);
        }

        lines.push('', '---', '');
      }
    }

    const reflexoesNoPeriodo = resumo.itens.filter((item) => item.tipo === 'REFLEXAO');
    lines.push('## Reflexões e Conexões Registradas', '');

    if (reflexoesNoPeriodo.length === 0) {
      lines.push('_Nenhuma reflexão registrada neste período._', '');
    } else {
      for (let i = 0; i < reflexoesNoPeriodo.length; i++) {
        const ref = reflexoesNoPeriodo[i]!;
        const temasStr = ref.temas.map((t) => t.nome).join(', ') || 'Geral';
        lines.push(
          `### Reflexão ${i + 1}: ${ref.titulo}`,
          `- **Criada em:** ${ref.createdAt}`,
          `- **Temas Vinculados:** ${temasStr}`,
          `- **Lousa Utilizada:** ${ref.hasLousa ? 'Sim' : 'Não'}`,
          ''
        );
      }
    }

    lines.push(
      '## Diretrizes para Análise da IA',
      '',
      'Aja como um mentor técnico de alta performance em estudos e preparação. Com base nos dados deste relatório:',
      '1. **Padrões de Desempenho:** Avalie a proporção de resoluções com ajuda vs sozinho e aponte se o estudante está consolidando autonomia ou dependendo de dicas prematuras.',
      '2. **Eficiência Temporal:** Analise se o tempo médio gasto por exercício está condizente com a complexidade dos temas abordados.',
      '3. **Lacunas Conceituais:** Cruze as observações de erro e as reflexões registradas para identificar tópicos que exigem retorno à teoria ou reforço de exercícios fundamentais.',
      '4. **Plano de Ação para o Próximo Ciclo:** Sugira de 2 a 3 metas prioritárias e específicas de estudo para os próximos dias.'
    );

    return {
      periodoLabel,
      dataInicioIso: resumo.dataInicioIso,
      dataFimIso: resumo.dataFimIso,
      markdown: lines.join('\n'),
    };
  }
}

export const exerciciosService = new ExerciciosService();
