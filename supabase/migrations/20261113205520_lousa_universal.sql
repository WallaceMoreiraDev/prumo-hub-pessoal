-- ============================================================================
-- Prumo Hub Pessoal — Migration de Lousas Universais
-- ============================================================================
-- Contempla:
--   1. Nova tabela public.lousas com constraints de integridade e RLS
--   2. Vínculo 1:0..1 em public.reflexoes (lousa_id + reflexão sem texto)
--   3. Vínculo 1:0..1 em public.caderno_erros (lousa_id)
--   4. Triggers de exclusividade mútua de lousa_id entre reflexões e caderno
--   5. Trigger de limpeza automática de lousas órfãs
--   6. Atualização das políticas RLS em reflexoes e caderno_erros
--   7. Bucket privado 'lousas-private' e políticas no Storage
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Nova Tabela: public.lousas
-- ----------------------------------------------------------------------------

CREATE TABLE public.lousas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  scene_storage_path text NOT NULL,
  preview_storage_path text NOT NULL,
  scene_size_bytes integer NOT NULL,
  preview_size_bytes integer NOT NULL,
  preview_mime_type text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),

  CONSTRAINT lousas_scene_path_not_blank CHECK (btrim(scene_storage_path) <> ''),
  CONSTRAINT lousas_preview_path_not_blank CHECK (btrim(preview_storage_path) <> ''),
  CONSTRAINT lousas_preview_mime_allowed CHECK (preview_mime_type IN ('image/webp', 'image/png')),
  CONSTRAINT lousas_sizes_positive CHECK (scene_size_bytes > 0 AND preview_size_bytes > 0),
  CONSTRAINT lousas_total_size_within_3mib CHECK ((scene_size_bytes + preview_size_bytes) <= 3145728)
);

CREATE INDEX idx_lousas_user_id
  ON public.lousas (user_id);

CREATE TRIGGER trg_lousas_set_updated_at
  BEFORE UPDATE ON public.lousas
  FOR EACH ROW
  EXECUTE FUNCTION public.set_updated_at();

-- ----------------------------------------------------------------------------
-- 2. Vínculo 1:0..1 em public.reflexoes
-- ----------------------------------------------------------------------------

ALTER TABLE public.reflexoes
  ALTER COLUMN conteudo DROP NOT NULL;

ALTER TABLE public.reflexoes
  DROP CONSTRAINT reflexoes_conteudo_not_blank;

ALTER TABLE public.reflexoes
  ADD CONSTRAINT reflexoes_conteudo_not_blank_when_present
  CHECK (conteudo IS NULL OR btrim(conteudo) <> '');

ALTER TABLE public.reflexoes
  ADD COLUMN lousa_id uuid NULL REFERENCES public.lousas(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_reflexoes_lousa_id_unique
  ON public.reflexoes (lousa_id)
  WHERE lousa_id IS NOT NULL;

ALTER TABLE public.reflexoes
  ADD CONSTRAINT reflexoes_conteudo_ou_lousa_required
  CHECK ((conteudo IS NOT NULL AND btrim(conteudo) <> '') OR lousa_id IS NOT NULL);

-- ----------------------------------------------------------------------------
-- 3. Vínculo 1:0..1 em public.caderno_erros
-- ----------------------------------------------------------------------------

ALTER TABLE public.caderno_erros
  ADD COLUMN lousa_id uuid NULL REFERENCES public.lousas(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX idx_caderno_erros_lousa_id_unique
  ON public.caderno_erros (lousa_id)
  WHERE lousa_id IS NOT NULL;

-- ----------------------------------------------------------------------------
-- 4. Triggers de Exclusividade de lousa_id (Reflexões vs Caderno de Erros)
-- ----------------------------------------------------------------------------

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
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_reflexoes_check_lousa_exclusivity
  BEFORE INSERT OR UPDATE OF lousa_id ON public.reflexoes
  FOR EACH ROW
  EXECUTE FUNCTION public.check_reflexao_lousa_exclusivity();

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
    ) THEN
      RAISE EXCEPTION 'LOUSA_ALREADY_IN_USE'
        USING ERRCODE = '23505';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_caderno_erros_check_lousa_exclusivity
  BEFORE INSERT OR UPDATE OF lousa_id ON public.caderno_erros
  FOR EACH ROW
  EXECUTE FUNCTION public.check_caderno_erro_lousa_exclusivity();

-- ----------------------------------------------------------------------------
-- 5. Trigger de Limpeza Automática de Lousas Órfãs
-- ----------------------------------------------------------------------------

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
      ) THEN
        DELETE FROM public.lousas
        WHERE id = OLD.lousa_id;
      END IF;
    END IF;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_reflexoes_cleanup_orphan_lousa
  AFTER UPDATE OF lousa_id OR DELETE ON public.reflexoes
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphan_lousa();

CREATE TRIGGER trg_caderno_erros_cleanup_orphan_lousa
  AFTER UPDATE OF lousa_id OR DELETE ON public.caderno_erros
  FOR EACH ROW
  EXECUTE FUNCTION public.cleanup_orphan_lousa();

-- ----------------------------------------------------------------------------
-- 6. Row Level Security (RLS) Multi-Usuário Estrito
-- ----------------------------------------------------------------------------

-- 6.1. RLS na tabela public.lousas
ALTER TABLE public.lousas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lousas_select_own"
  ON public.lousas
  FOR SELECT
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "lousas_insert_own"
  ON public.lousas
  FOR INSERT
  TO authenticated
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "lousas_update_own"
  ON public.lousas
  FOR UPDATE
  TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

CREATE POLICY "lousas_delete_own"
  ON public.lousas
  FOR DELETE
  TO authenticated
  USING (user_id = (SELECT auth.uid()));

-- 6.2. Atualização das políticas RLS de public.reflexoes
DROP POLICY IF EXISTS "reflexoes_insert_own" ON public.reflexoes;

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

DROP POLICY IF EXISTS "reflexoes_update_own" ON public.reflexoes;

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

-- 6.3. Atualização das políticas RLS de public.caderno_erros
DROP POLICY IF EXISTS "caderno_erros_insert_own" ON public.caderno_erros;

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

DROP POLICY IF EXISTS "caderno_erros_update_own" ON public.caderno_erros;

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

-- ----------------------------------------------------------------------------
-- 7. Bucket Privado no Supabase Storage (lousas-private) e Políticas
-- ----------------------------------------------------------------------------

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'lousas-private',
  'lousas-private',
  false,
  3145728,
  ARRAY['application/json', 'image/webp', 'image/png']
)
ON CONFLICT (id) DO UPDATE
SET
  public = EXCLUDED.public,
  file_size_limit = EXCLUDED.file_size_limit,
  allowed_mime_types = EXCLUDED.allowed_mime_types;

CREATE POLICY "lousas_private_select_own"
  ON storage.objects
  FOR SELECT
  TO authenticated
  USING (
    bucket_id = 'lousas-private'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "lousas_private_insert_own"
  ON storage.objects
  FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'lousas-private'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "lousas_private_update_own"
  ON storage.objects
  FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'lousas-private'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  )
  WITH CHECK (
    bucket_id = 'lousas-private'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );

CREATE POLICY "lousas_private_delete_own"
  ON storage.objects
  FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'lousas-private'
    AND (storage.foldername(name))[1] = (SELECT (auth.uid())::text)
  );
