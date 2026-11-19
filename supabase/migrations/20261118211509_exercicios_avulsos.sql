-- ============================================================================
-- Prumo Hub Pessoal — Migration de Exercícios Avulsos / Sessões de Estudo
-- ============================================================================
-- Contempla:
--   1. Nova tabela public.exercicios_avulsos com constraints e índices
--   2. Nova tabela associativa public.exercicio_temas
--   3. Triggers de exclusividade e limpeza automática de lousa
--   4. Row Level Security (RLS) multi-usuário estrito
--   5. RPC atômica public.rpc_salvar_exercicio_avulso
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nova Tabela: public.exercicios_avulsos
-- ----------------------------------------------------------------------------

CREATE TABLE public.exercicios_avulsos (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  titulo text NOT NULL,
  enunciado text NULL,
  link_externo text NULL,
  observacao text NULL,
  duracao_segundos integer NOT NULL DEFAULT 0,
  desfecho public.review_mode_enum NULL,
  lousa_id uuid NULL REFERENCES public.lousas(id) ON DELETE SET NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT exercicios_avulsos_titulo_not_blank CHECK (btrim(titulo) <> ''),
  CONSTRAINT exercicios_avulsos_duracao_positive CHECK (duracao_segundos >= 0),
  CONSTRAINT exercicios_avulsos_enunciado_not_blank CHECK (enunciado IS NULL OR btrim(enunciado) <> ''),
  CONSTRAINT exercicios_avulsos_link_externo_not_blank CHECK (link_externo IS NULL OR btrim(link_externo) <> ''),
  CONSTRAINT exercicios_avulsos_observacao_not_blank CHECK (observacao IS NULL OR btrim(observacao) <> '')
);

CREATE INDEX idx_exercicios_avulsos_user_id
  ON public.exercicios_avulsos (user_id);

CREATE INDEX idx_exercicios_avulsos_created_at
  ON public.exercicios_avulsos (user_id, created_at DESC);

CREATE UNIQUE INDEX idx_exercicios_avulsos_lousa_id_unique
  ON public.exercicios_avulsos (lousa_id)
  WHERE lousa_id IS NOT NULL;

CREATE TRIGGER trg_exercicios_avulsos_set_updated_at
  BEFORE UPDATE ON public.exercicios_avulsos
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Nova Tabela Associativa: public.exercicio_temas
-- ----------------------------------------------------------------------------

CREATE TABLE public.exercicio_temas (
  exercicio_id uuid NOT NULL REFERENCES public.exercicios_avulsos(id) ON DELETE CASCADE,
  tema_id uuid NOT NULL REFERENCES public.temas(id) ON DELETE CASCADE,
  PRIMARY KEY (exercicio_id, tema_id)
);

CREATE INDEX idx_exercicio_temas_tema_id
  ON public.exercicio_temas (tema_id);

-- ----------------------------------------------------------------------------
-- 3. Triggers de Exclusividade e Limpeza de Lousas (Integrando com lousa_universal)
-- ----------------------------------------------------------------------------

-- 3.1 Trigger de exclusividade para exercicios_avulsos
CREATE OR REPLACE FUNCTION public.check_exercicio_avulso_lousa_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lousa_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.lousa_id IS DISTINCT FROM OLD.lousa_id) THEN
    IF EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.lousa_id = NEW.lousa_id
    ) OR EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.lousa_id = NEW.lousa_id
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_exercicios_avulsos_check_lousa_exclusivity
  BEFORE INSERT OR UPDATE OF lousa_id ON public.exercicios_avulsos
  FOR EACH ROW
  EXECUTE FUNCTION public.check_exercicio_avulso_lousa_exclusivity();

-- 3.2 Atualização da verificação de exclusividade em reflexoes
CREATE OR REPLACE FUNCTION public.check_reflexao_lousa_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lousa_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.lousa_id IS DISTINCT FROM OLD.lousa_id) THEN
    IF EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.lousa_id = NEW.lousa_id
    ) OR EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.lousa_id = NEW.lousa_id
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3.3 Atualização da verificação de exclusividade em caderno_erros
CREATE OR REPLACE FUNCTION public.check_caderno_erro_lousa_exclusivity()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_catalog
AS $$
BEGIN
  IF NEW.lousa_id IS NOT NULL AND (TG_OP = 'INSERT' OR NEW.lousa_id IS DISTINCT FROM OLD.lousa_id) THEN
    IF EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.lousa_id = NEW.lousa_id
    ) OR EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.lousa_id = NEW.lousa_id
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

-- 3.4 Atualização da função de limpeza de lousas órfãs
CREATE OR REPLACE FUNCTION public.cleanup_orphan_lousa()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD.lousa_id IS NOT NULL THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.reflexoes r
        WHERE r.lousa_id = OLD.lousa_id
      ) AND NOT EXISTS (
        SELECT 1
        FROM public.caderno_erros ce
        WHERE ce.lousa_id = OLD.lousa_id
      ) AND NOT EXISTS (
        SELECT 1
        FROM public.exercicios_avulsos ea
        WHERE ea.lousa_id = OLD.lousa_id
      ) THEN
        DELETE FROM public.lousas
        WHERE id = OLD.lousa_id;
      END IF;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.lousa_id IS NOT NULL AND NEW.lousa_id IS DISTINCT FROM OLD.lousa_id THEN
      IF NOT EXISTS (
        SELECT 1
        FROM public.reflexoes r
        WHERE r.lousa_id = OLD.lousa_id
      ) AND NOT EXISTS (
        SELECT 1
        FROM public.caderno_erros ce
        WHERE ce.lousa_id = OLD.lousa_id
      ) AND NOT EXISTS (
        SELECT 1
        FROM public.exercicios_avulsos ea
        WHERE ea.lousa_id = OLD.lousa_id
      ) THEN
        DELETE FROM public.lousas
        WHERE id = OLD.lousa_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_exercicios_avulsos_cleanup_orphan_lousa
  AFTER UPDATE OF lousa_id OR DELETE ON public.exercicios_avulsos
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphan_lousa();

-- ----------------------------------------------------------------------------
-- 4. Row Level Security (RLS) Multi-Usuário Estrito
-- ----------------------------------------------------------------------------

-- 4.1 RLS na tabela public.exercicios_avulsos
ALTER TABLE public.exercicios_avulsos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercicios_avulsos_select_own"
  ON public.exercicios_avulsos
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "exercicios_avulsos_insert_own"
  ON public.exercicios_avulsos
  FOR INSERT
  TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      lousa_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.lousas l
        WHERE l.id = lousa_id
          AND l.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "exercicios_avulsos_update_own"
  ON public.exercicios_avulsos
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND (
      lousa_id IS NULL
      OR EXISTS (
        SELECT 1
        FROM public.lousas l
        WHERE l.id = lousa_id
          AND l.user_id = (SELECT auth.uid())
      )
    )
  );

CREATE POLICY "exercicios_avulsos_delete_own"
  ON public.exercicios_avulsos
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 4.2 RLS na tabela public.exercicio_temas
ALTER TABLE public.exercicio_temas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "exercicio_temas_select_own"
  ON public.exercicio_temas
  FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.id = exercicio_id
        AND ea.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "exercicio_temas_insert_own"
  ON public.exercicio_temas
  FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.id = exercicio_id
        AND ea.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "exercicio_temas_update_own"
  ON public.exercicio_temas
  FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.id = exercicio_id
        AND ea.user_id = (SELECT auth.uid())
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.id = exercicio_id
        AND ea.user_id = (SELECT auth.uid())
    )
    AND EXISTS (
      SELECT 1
      FROM public.temas t
      WHERE t.id = tema_id
        AND t.user_id = (SELECT auth.uid())
    )
  );

CREATE POLICY "exercicio_temas_delete_own"
  ON public.exercicio_temas
  FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.id = exercicio_id
        AND ea.user_id = (SELECT auth.uid())
    )
  );

-- ----------------------------------------------------------------------------
-- 5. RPC Atômica de Persistência: public.rpc_salvar_exercicio_avulso
-- ----------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION public.rpc_salvar_exercicio_avulso(
  p_titulo text,
  p_tema_ids uuid[],
  p_enunciado text DEFAULT NULL,
  p_link_externo text DEFAULT NULL,
  p_observacao text DEFAULT NULL,
  p_duracao_segundos integer DEFAULT 0,
  p_desfecho public.review_mode_enum DEFAULT NULL,
  p_lousa_id uuid DEFAULT NULL
)
RETURNS public.exercicios_avulsos
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_catalog
AS $$
DECLARE
  v_user_id uuid;
  v_now timestamptz := now();
  v_tema_ids uuid[];
  v_valid_temas_count integer;
  v_exercicio public.exercicios_avulsos;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'UNAUTHORIZED' USING ERRCODE = '42501';
  END IF;

  IF p_titulo IS NULL OR btrim(p_titulo) = '' THEN
    RAISE EXCEPTION 'TITULO_REQUIRED' USING ERRCODE = '22023';
  END IF;

  IF p_duracao_segundos IS NOT NULL AND p_duracao_segundos < 0 THEN
    RAISE EXCEPTION 'INVALID_DURACAO' USING ERRCODE = '22023';
  END IF;

  -- Deduplica e normaliza array de temas vinculados
  SELECT coalesce(array_agg(DISTINCT t_id), '{}'::uuid[])
  INTO v_tema_ids
  FROM unnest(coalesce(p_tema_ids, '{}'::uuid[])) AS t_id
  WHERE t_id IS NOT NULL;

  IF cardinality(v_tema_ids) = 0 THEN
    RAISE EXCEPTION 'TEMAS_REQUIRED' USING ERRCODE = '22023';
  END IF;

  -- Valida se todos os temas existem e pertencem ao usuário autenticado
  SELECT count(*)
  INTO v_valid_temas_count
  FROM public.temas t
  WHERE t.id = ANY(v_tema_ids)
    AND t.user_id = v_user_id;

  IF v_valid_temas_count <> cardinality(v_tema_ids) THEN
    RAISE EXCEPTION 'TEMA_NOT_FOUND' USING ERRCODE = 'P0002';
  END IF;

  -- Validação de integridade e posse da lousa quando informada
  IF p_lousa_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1
      FROM public.lousas l
      WHERE l.id = p_lousa_id
        AND l.user_id = v_user_id
    ) THEN
      RAISE EXCEPTION 'LOUSA_NOT_FOUND' USING ERRCODE = 'P0002';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM public.reflexoes r
      WHERE r.lousa_id = p_lousa_id
    ) OR EXISTS (
      SELECT 1
      FROM public.caderno_erros ce
      WHERE ce.lousa_id = p_lousa_id
    ) OR EXISTS (
      SELECT 1
      FROM public.exercicios_avulsos ea
      WHERE ea.lousa_id = p_lousa_id
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE' USING ERRCODE = '23505';
    END IF;
  END IF;

  -- 1. Insere o registro em public.exercicios_avulsos
  INSERT INTO public.exercicios_avulsos (
    user_id,
    titulo,
    enunciado,
    link_externo,
    observacao,
    duracao_segundos,
    desfecho,
    lousa_id
  ) VALUES (
    v_user_id,
    btrim(p_titulo),
    nullif(btrim(p_enunciado), ''),
    nullif(btrim(p_link_externo), ''),
    nullif(btrim(p_observacao), ''),
    coalesce(p_duracao_segundos, 0),
    p_desfecho,
    p_lousa_id
  )
  RETURNING * INTO v_exercicio;

  -- 2. Insere as associações em public.exercicio_temas
  INSERT INTO public.exercicio_temas (exercicio_id, tema_id)
  SELECT v_exercicio.id, unnest(v_tema_ids);

  -- 3. Atualização condicional de temas
  IF p_desfecho IS NOT NULL THEN
    UPDATE public.temas
    SET
      last_reviewed_at = v_now,
      last_review_mode = p_desfecho
    WHERE id = ANY(v_tema_ids)
      AND user_id = v_user_id;
  END IF;

  -- 4. Retorna a linha completa inserida
  RETURN v_exercicio;
END;
$$;

REVOKE ALL ON FUNCTION public.rpc_salvar_exercicio_avulso(text, uuid[], text, text, text, integer, public.review_mode_enum, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.rpc_salvar_exercicio_avulso(text, uuid[], text, text, text, integer, public.review_mode_enum, uuid) TO authenticated, service_role;
