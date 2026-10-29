-- ============================================================
-- Migración 2.0: procedencia del participante
-- Idempotente: se puede ejecutar varias veces sin perder datos.
-- ============================================================

BEGIN;

ALTER TABLE estudiantes
    ADD COLUMN IF NOT EXISTS institution_name VARCHAR(150);

ALTER TABLE estudiantes
    ADD COLUMN IF NOT EXISTS institution_type VARCHAR(20);

-- Rellenar filas históricas antes de exigir NOT NULL
UPDATE estudiantes
SET institution_name = COALESCE(NULLIF(btrim(institution_name), ''), 'No indicó institución')
WHERE institution_name IS NULL OR btrim(institution_name) = '';

UPDATE estudiantes
SET institution_type = COALESCE(NULLIF(btrim(institution_type), ''), 'no_indico')
WHERE institution_type IS NULL OR btrim(institution_type) = '';

ALTER TABLE estudiantes
    ALTER COLUMN institution_name SET DEFAULT 'No indicó institución';

ALTER TABLE estudiantes
    ALTER COLUMN institution_type SET DEFAULT 'no_indico';

ALTER TABLE estudiantes
    ALTER COLUMN institution_name SET NOT NULL;

ALTER TABLE estudiantes
    ALTER COLUMN institution_type SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_estudiantes_institution_type
    ON estudiantes (institution_type);

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint WHERE conname = 'chk_estudiantes_institution_type'
    ) THEN
        ALTER TABLE estudiantes
            ADD CONSTRAINT chk_estudiantes_institution_type
            CHECK (institution_type IN ('universidad', 'empresa', 'otra', 'no_indico'));
    END IF;
END
$$;

COMMIT;
