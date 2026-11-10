-- ============================================================================
-- Prumo Hub Pessoal — Migration Inicial do Schema Relacional (MVP)
-- ============================================================================
-- Contempla:
--   1. Enums de domínio
--   2. Trigger utilitário de atualização automática de updated_at
--   3. Tabelas em snake_case (Temas/Reflexões, Simulados, Caderno de Erros)
--   4. Constraints de integridade e índices de consulta
--   5. Row Level Security (RLS) multi-usuário estrito por auth.uid()
--   6. Bucket privado 'simulado-pdfs' e políticas de acesso no Storage
--   7. Stored Procedures (RPCs) transacionais SECURITY INVOKER
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Enums do Domínio
-- ----------------------------------------------------------------------------

CREATE TYPE public.review_mode_enum AS ENUM (
  'SOLO',
  'HELP'
);

CREATE TYPE public.simulado_status_enum AS ENUM (
  'PREPARACAO',
  'EM_ANDAMENTO',
  'FINALIZADO'
);

CREATE TYPE public.questao_resultado_enum AS ENUM (
  'ACERTEI',
  'PARCIAL',
  'ERREI'
);

CREATE TYPE public.erro_origem_enum AS ENUM (
  'SIMULADO',
  'EXTERNAL_LINK',
  'GENERIC_FULL'
);

CREATE TYPE public.erro_status_enum AS ENUM (
  'PENDENTE',
  'REVISADO'
);

-- ----------------------------------------------------------------------------
-- 2. Função Utilitária para Trigger de updated_at
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_catalog
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ----------------------------------------------------------------------------
-- 3. Tabelas, Constraints, Índices e Triggers
-- ----------------------------------------------------------------------------

-- 3.1. Módulo de Temas e Conexões Bidirecionais

CREATE TABLE public.temas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  last_reviewed_at timestamptz NULL,
  last_review_mode public.review_mode_enum NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT temas_nome_not_blank CHECK (btrim(nome) <> ''),
  CONSTRAINT temas_nome_sem_hashtag CHECK (position('#' IN nome) = 0),
  CONSTRAINT temas_review_consistency CHECK (
    (last_reviewed_at IS NULL AND last_review_mode IS NULL)
    OR (last_reviewed_at IS NOT NULL AND last_review_mode IS NOT NULL)
  )
);

CREATE UNIQUE INDEX idx_temas_user_lower_nome_unique
  ON public.temas (user_id, lower(nome));

CREATE INDEX idx_temas_user_last_reviewed
  ON public.temas (user_id, last_reviewed_at NULLS FIRST);

CREATE TRIGGER trg_temas_set_updated_at
  BEFORE UPDATE ON public.temas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reflexoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tema_principal_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  conteudo text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT reflexoes_conteudo_not_blank CHECK (btrim(conteudo) <> '')
);

CREATE INDEX idx_reflexoes_user_id
  ON public.reflexoes (user_id);

CREATE INDEX idx_reflexoes_tema_principal_id
  ON public.reflexoes (tema_principal_id);

CREATE TRIGGER trg_reflexoes_set_updated_at
  BEFORE UPDATE ON public.reflexoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.reflexao_temas_conectados (
  reflexao_id uuid NOT NULL REFERENCES public.reflexoes(id) ON DELETE CASCADE,
  tema_conectado_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  PRIMARY KEY (reflexao_id, tema_conectado_id)
);

CREATE INDEX idx_reflexao_temas_conectados_tema_id
  ON public.reflexao_temas_conectados (tema_conectado_id);

-- 3.2. Módulo de Simulados

CREATE TABLE public.simulados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  duracao_configurada_segundos integer NOT NULL,
  tempo_gasto_segundos integer NOT NULL DEFAULT 0,
  pdf_storage_path text NULL,
  status public.simulado_status_enum NOT NULL DEFAULT 'PREPARACAO',
  started_at timestamptz NULL,
  finished_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT simulados_titulo_not_blank CHECK (btrim(titulo) <> ''),
  CONSTRAINT simulados_duracao_positive CHECK (duracao_configurada_segundos > 0),
  CONSTRAINT simulados_tempo_gasto_non_negative CHECK (tempo_gasto_segundos >= 0),
  CONSTRAINT simulados_timestamps_order CHECK (
    started_at IS NULL
    OR finished_at IS NULL
    OR finished_at >= started_at
  )
);

CREATE INDEX idx_simulados_user_status_created
  ON public.simulados (user_id, status, created_at DESC);

CREATE TRIGGER trg_simulados_set_updated_at
  BEFORE UPDATE ON public.simulados
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.simulado_questoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulado_id uuid NOT NULL REFERENCES public.simulados(id) ON DELETE CASCADE,
  numero_questao text NOT NULL,
  titulo_questao text NOT NULL,
  ordem integer NOT NULL DEFAULT 0,
  resultado public.questao_resultado_enum NULL,
  observacao_pos_revisao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT simulado_questoes_numero_not_blank CHECK (btrim(numero_questao) <> ''),
  CONSTRAINT simulado_questoes_titulo_not_blank CHECK (btrim(titulo_questao) <> ''),
  CONSTRAINT simulado_questoes_ordem_non_negative CHECK (ordem >= 0),
  CONSTRAINT simulado_questoes_acertei_sem_observacao CHECK (
    resultado IS DISTINCT FROM 'ACERTEI'
    OR observacao_pos_revisao IS NULL
  )
);

CREATE INDEX idx_simulado_questoes_simulado_ordem
  ON public.simulado_questoes (simulado_id, ordem, created_at);

CREATE INDEX idx_simulado_questoes_user_id
  ON public.simulado_questoes (user_id);

CREATE TRIGGER trg_simulado_questoes_set_updated_at
  BEFORE UPDATE ON public.simulado_questoes
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.simulado_questao_temas (
  simulado_questao_id uuid NOT NULL REFERENCES public.simulado_questoes(id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  PRIMARY KEY (simulado_questao_id, tema_id)
);

CREATE INDEX idx_simulado_questao_temas_tema_id
  ON public.simulado_questao_temas (tema_id);

CREATE TABLE public.simulado_pensamentos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  simulado_questao_id uuid NOT NULL REFERENCES public.simulado_questoes(id) ON DELETE CASCADE,
  descricao text NOT NULL,
  tempo_decorrido_segundos integer NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT simulado_pensamentos_descricao_not_blank CHECK (btrim(descricao) <> ''),
  CONSTRAINT simulado_pensamentos_tempo_non_negative CHECK (
    tempo_decorrido_segundos IS NULL
    OR tempo_decorrido_segundos >= 0
  )
);

CREATE INDEX idx_simulado_pensamentos_questao_created
  ON public.simulado_pensamentos (simulado_questao_id, created_at);

CREATE INDEX idx_simulado_pensamentos_user_id
  ON public.simulado_pensamentos (user_id);

CREATE TRIGGER trg_simulado_pensamentos_set_updated_at
  BEFORE UPDATE ON public.simulado_pensamentos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- 3.3. Módulo de Caderno de Erros

CREATE TABLE public.caderno_erros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  origem public.erro_origem_enum NOT NULL,
  status public.erro_status_enum NOT NULL DEFAULT 'PENDENTE',
  simulado_questao_id uuid UNIQUE NULL REFERENCES public.simulado_questoes(id) ON DELETE CASCADE,
  codigo_referencia text NULL,
  titulo text NOT NULL,
  enunciado_completo text NULL,
  link_externo text NULL,
  observacao_erro text NULL,
  last_reviewed_at timestamptz NULL,
  last_review_mode public.review_mode_enum NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT caderno_erros_titulo_not_blank CHECK (btrim(titulo) <> ''),
  CONSTRAINT caderno_erros_review_consistency CHECK (
    (last_reviewed_at IS NULL AND last_review_mode IS NULL)
    OR (last_reviewed_at IS NOT NULL AND last_review_mode IS NOT NULL)
  ),
  CONSTRAINT caderno_erros_origem_payload_check CHECK (
    (
      origem = 'SIMULADO'
      AND simulado_questao_id IS NOT NULL
    )
    OR (
      origem = 'EXTERNAL_LINK'
      AND simulado_questao_id IS NULL
      AND codigo_referencia IS NOT NULL
      AND btrim(codigo_referencia) <> ''
      AND link_externo IS NOT NULL
      AND btrim(link_externo) <> ''
    )
    OR (
      origem = 'GENERIC_FULL'
      AND simulado_questao_id IS NULL
      AND enunciado_completo IS NOT NULL
      AND btrim(enunciado_completo) <> ''
    )
  )
);

CREATE INDEX idx_caderno_erros_user_status_created
  ON public.caderno_erros (user_id, status, created_at DESC);

CREATE TRIGGER trg_caderno_erros_set_updated_at
  BEFORE UPDATE ON public.caderno_erros
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

CREATE TABLE public.caderno_erro_temas (
  caderno_erro_id uuid NOT NULL REFERENCES public.caderno_erros(id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  PRIMARY KEY (caderno_erro_id, tema_id)
);

CREATE INDEX idx_caderno_erro_temas_tema_id
  ON public.caderno_erro_temas (tema_id);

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Multi-Usuário Estrito
-- ----------------------------------------------------------------------------

ALTER TABLE public.temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflexoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.reflexao_temas_conectados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_questoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_questao_temas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.simulado_pensamentos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caderno_erros ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.caderno_erro_temas ENABLE ROW LEVEL SECURITY;

-- Políticas: temas

CREATE POLICY "temas_select_own"
  ON public.temas
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "temas_insert_own"
  ON public.temas
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "temas_update_own"
  ON public.temas
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "temas_delete_own"
  ON public.temas
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: reflexoes

CREATE POLICY "reflexoes_select_own"
  ON public.reflexoes
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "reflexoes_insert_own"
  ON public.reflexoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_principal_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "reflexoes_update_own"
  ON public.reflexoes
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_principal_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "reflexoes_delete_own"
  ON public.reflexoes
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: reflexao_temas_conectados

CREATE POLICY "reflexao_temas_conectados_select_own"
  ON public.reflexao_temas_conectados
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.id = reflexao_id
        AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_conectado_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "reflexao_temas_conectados_insert_own"
  ON public.reflexao_temas_conectados
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.id = reflexao_id
        AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_conectado_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "reflexao_temas_conectados_update_own"
  ON public.reflexao_temas_conectados
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.id = reflexao_id
        AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_conectado_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.id = reflexao_id
        AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_conectado_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "reflexao_temas_conectados_delete_own"
  ON public.reflexao_temas_conectados
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.id = reflexao_id
        AND r.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_conectado_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

-- Políticas: simulados

CREATE POLICY "simulados_select_own"
  ON public.simulados
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "simulados_insert_own"
  ON public.simulados
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "simulados_update_own"
  ON public.simulados
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "simulados_delete_own"
  ON public.simulados
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: simulado_questoes

CREATE POLICY "simulado_questoes_select_own"
  ON public.simulado_questoes
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "simulado_questoes_insert_own"
  ON public.simulado_questoes
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.simulados s
      WHERE s.id = simulado_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_questoes_update_own"
  ON public.simulado_questoes
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.simulados s
      WHERE s.id = simulado_id
        AND s.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_questoes_delete_own"
  ON public.simulado_questoes
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: simulado_questao_temas

CREATE POLICY "simulado_questao_temas_select_own"
  ON public.simulado_questao_temas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_questao_temas_insert_own"
  ON public.simulado_questao_temas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_questao_temas_update_own"
  ON public.simulado_questao_temas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_questao_temas_delete_own"
  ON public.simulado_questao_temas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

-- Políticas: simulado_pensamentos

CREATE POLICY "simulado_pensamentos_select_own"
  ON public.simulado_pensamentos
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "simulado_pensamentos_insert_own"
  ON public.simulado_pensamentos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_pensamentos_update_own"
  ON public.simulado_pensamentos
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1
      FROM public.simulado_questoes sq
      WHERE sq.id = simulado_questao_id
        AND sq.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "simulado_pensamentos_delete_own"
  ON public.simulado_pensamentos
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: caderno_erros

CREATE POLICY "caderno_erros_select_own"
  ON public.caderno_erros
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "caderno_erros_insert_own"
  ON public.caderno_erros
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      simulado_questao_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.simulado_questoes sq
        WHERE sq.id = simulado_questao_id
          AND sq.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "caderno_erros_update_own"
  ON public.caderno_erros
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      simulado_questao_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.simulado_questoes sq
        WHERE sq.id = simulado_questao_id
          AND sq.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "caderno_erros_delete_own"
  ON public.caderno_erros
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- Políticas: caderno_erro_temas

CREATE POLICY "caderno_erro_temas_select_own"
  ON public.caderno_erro_temas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.id = caderno_erro_id
        AND ce.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "caderno_erro_temas_insert_own"
  ON public.caderno_erro_temas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.id = caderno_erro_id
        AND ce.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "caderno_erro_temas_update_own"
  ON public.caderno_erro_temas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.id = caderno_erro_id
        AND ce.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.id = caderno_erro_id
        AND ce.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "caderno_erro_temas_delete_own"
  ON public.caderno_erro_temas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.id = caderno_erro_id
        AND ce.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. Bucket Privado de PDFs no Supabase Storage e Políticas de Acesso
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public)
VALUES ('simulado-pdfs', 'simulado-pdfs', false)
ON CONFLICT (id) DO UPDATE
SET public = EXCLUDED.public;

CREATE POLICY "simulado_pdfs_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'simulado-pdfs'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "simulado_pdfs_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'simulado-pdfs'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "simulado_pdfs_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'simulado-pdfs'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  )
  WITH CHECK (
    bucket_id = 'simulado-pdfs'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "simulado_pdfs_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'simulado-pdfs'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

-- ----------------------------------------------------------------------------
-- 6. Stored Procedures Transacionais (Postgres RPCs — SECURITY INVOKER)
-- ----------------------------------------------------------------------------

-- 6.1. Classificar questão pós-simulado (ACERTEI vs PARCIAL/ERREI)
CREATE OR REPLACE FUNCTION public.rpc_classificar_questao_simulado(
  p_simulado_questao_id uuid,
  p_resultado public.questao_resultado_enum,
  p_tema_ids uuid[],
  p_observacao_pos_revisao text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_titulo_questao text;
  v_observacao text;
  v_tema_ids uuid[];
  v_valid_temas_count integer;
  v_caderno_erro_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_resultado IS NULL THEN
    RAISE EXCEPTION 'INVALID_RESULTADO' USING ERRCODE = '22023';
  END IF;

  -- Trava e valida pertencimento da questão do simulado ao usuário autenticado
  SELECT sq.titulo_questao
  INTO v_titulo_questao
  FROM public.simulado_questoes sq
  WHERE sq.id = p_simulado_questao_id
    AND sq.user_id = v_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'SIMULADO_QUESTAO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Deduplica e remove eventuais NULLs do array de temas
  SELECT coalesce(array_agg(DISTINCT t_id), '{}'::uuid[])
  INTO v_tema_ids
  FROM unnest(coalesce(p_tema_ids, '{}'::uuid[])) AS t_id
  WHERE t_id IS NOT NULL;

  -- Valida que todos os temas informados existem e pertencem ao usuário
  IF cardinality(v_tema_ids) > 0 THEN
    SELECT count(*)
    INTO v_valid_temas_count
    FROM public.temas t
    WHERE t.id = ANY(v_tema_ids)
      AND t.user_id = v_user_id;

    IF v_valid_temas_count <> cardinality(v_tema_ids) THEN
      RAISE EXCEPTION 'TEMA_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;
  END IF;

  -- Força NULL em observacao_pos_revisao se ACERTEI; normaliza vazio para NULL
  IF p_resultado = 'ACERTEI' THEN
    v_observacao := NULL;
  ELSIF p_observacao_pos_revisao IS NULL OR btrim(p_observacao_pos_revisao) = '' THEN
    v_observacao := NULL;
  ELSE
    v_observacao := p_observacao_pos_revisao;
  END IF;

  -- Atualiza resultado e observação pós-revisão da questão
  UPDATE public.simulado_questoes
  SET
    resultado = p_resultado,
    observacao_pos_revisao = v_observacao
  WHERE id = p_simulado_questao_id
    AND user_id = v_user_id;

  -- Sincroniza vínculos em simulado_questao_temas
  DELETE FROM public.simulado_questao_temas
  WHERE simulado_questao_id = p_simulado_questao_id;

  IF cardinality(v_tema_ids) > 0 THEN
    INSERT INTO public.simulado_questao_temas (simulado_questao_id, tema_id)
    SELECT p_simulado_questao_id, unnest(v_tema_ids);
  END IF;

  -- Regras acopladas 3.1 e 3.2 do GEMINI.md
  IF p_resultado = 'ACERTEI' THEN
    IF cardinality(v_tema_ids) > 0 THEN
      UPDATE public.temas
      SET
        last_reviewed_at = v_now,
        last_review_mode = 'SOLO'
      WHERE id = ANY(v_tema_ids)
        AND user_id = v_user_id;
    END IF;

    DELETE FROM public.caderno_erros
    WHERE simulado_questao_id = p_simulado_questao_id
      AND user_id = v_user_id;
  ELSE
    -- PARCIAL ou ERREI: NÃO atualiza last_reviewed_at/last_review_mode em temas
    INSERT INTO public.caderno_erros (
      user_id,
      origem,
      status,
      simulado_questao_id,
      titulo,
      observacao_erro
    )
    VALUES (
      v_user_id,
      'SIMULADO',
      'PENDENTE',
      p_simulado_questao_id,
      v_titulo_questao,
      v_observacao
    )
    ON CONFLICT (simulado_questao_id) DO UPDATE
    SET
      origem = 'SIMULADO',
      status = 'PENDENTE',
      titulo = EXCLUDED.titulo,
      observacao_erro = EXCLUDED.observacao_erro
    RETURNING id INTO v_caderno_erro_id;

    DELETE FROM public.caderno_erro_temas
    WHERE caderno_erro_id = v_caderno_erro_id;

    IF cardinality(v_tema_ids) > 0 THEN
      INSERT INTO public.caderno_erro_temas (caderno_erro_id, tema_id)
      SELECT v_caderno_erro_id, unnest(v_tema_ids);
    END IF;
  END IF;
END;
$$;

-- 6.2. Concluir revisão de um item do Caderno de Erros e atualizar temas vinculados
CREATE OR REPLACE FUNCTION public.rpc_concluir_revisao_erro(
  p_caderno_erro_id uuid,
  p_review_mode public.review_mode_enum
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_review_mode IS NULL THEN
    RAISE EXCEPTION 'INVALID_REVIEW_MODE' USING ERRCODE = '22023';
  END IF;

  UPDATE public.caderno_erros
  SET
    status = 'REVISADO',
    last_reviewed_at = v_now,
    last_review_mode = p_review_mode
  WHERE id = p_caderno_erro_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CADERNO_ERRO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.temas t
  SET
    last_reviewed_at = v_now,
    last_review_mode = p_review_mode
  FROM public.caderno_erro_temas cet
  WHERE cet.caderno_erro_id = p_caderno_erro_id
    AND t.id = cet.tema_id
    AND t.user_id = v_user_id;
END;
$$;

-- 6.3. Devolver item revisado do Caderno de Erros para Pendentes
CREATE OR REPLACE FUNCTION public.rpc_devolver_erro_para_pendente(
  p_caderno_erro_id uuid
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  UPDATE public.caderno_erros
  SET status = 'PENDENTE'
  WHERE id = p_caderno_erro_id
    AND user_id = v_user_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'CADERNO_ERRO_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- 6.4. Registrar prática/revisão avulsa diretamente para um ou mais temas
CREATE OR REPLACE FUNCTION public.rpc_registrar_pratica_temas(
  p_tema_ids uuid[],
  p_review_mode public.review_mode_enum
)
RETURNS void
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_tema_ids uuid[];
  v_updated_count integer;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_review_mode IS NULL THEN
    RAISE EXCEPTION 'INVALID_REVIEW_MODE' USING ERRCODE = '22023';
  END IF;

  SELECT coalesce(array_agg(DISTINCT t_id), '{}'::uuid[])
  INTO v_tema_ids
  FROM unnest(coalesce(p_tema_ids, '{}'::uuid[])) AS t_id
  WHERE t_id IS NOT NULL;

  IF cardinality(v_tema_ids) = 0 THEN
    RAISE EXCEPTION 'TEMAS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  UPDATE public.temas
  SET
    last_reviewed_at = v_now,
    last_review_mode = p_review_mode
  WHERE id = ANY(v_tema_ids)
    AND user_id = v_user_id;

  GET DIAGNOSTICS v_updated_count = ROW_COUNT;

  IF v_updated_count <> cardinality(v_tema_ids) THEN
    RAISE EXCEPTION 'TEMA_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;
END;
$$;

-- Restringe execução das RPCs apenas a usuários autenticados (e service_role)
REVOKE ALL ON FUNCTION public.rpc_classificar_questao_simulado(uuid, public.questao_resultado_enum, uuid[], text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_classificar_questao_simulado(uuid, public.questao_resultado_enum, uuid[], text) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_concluir_revisao_erro(uuid, public.review_mode_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_concluir_revisao_erro(uuid, public.review_mode_enum) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_devolver_erro_para_pendente(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_devolver_erro_para_pendente(uuid) TO authenticated, service_role;

REVOKE ALL ON FUNCTION public.rpc_registrar_pratica_temas(uuid[], public.review_mode_enum) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_registrar_pratica_temas(uuid[], public.review_mode_enum) TO authenticated, service_role;
