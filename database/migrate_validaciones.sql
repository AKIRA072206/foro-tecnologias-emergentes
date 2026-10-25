-- Actualiza restricciones de la tabla estudiantes (cédula, nombre, apellido, teléfono)
BEGIN;

ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS chk_estudiantes_cedula;
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS chk_estudiantes_telefono;
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS chk_estudiantes_nombre;
ALTER TABLE estudiantes DROP CONSTRAINT IF EXISTS chk_estudiantes_apellido;

-- Normalizar datos existentes incompatibles (opcional: revisar antes en producción)
UPDATE estudiantes SET cedula = regexp_replace(cedula, '\D', '', 'g');
UPDATE estudiantes SET telefono = regexp_replace(telefono, '\D', '', 'g');

ALTER TABLE estudiantes
    ALTER COLUMN cedula TYPE VARCHAR(10),
    ALTER COLUMN nombre TYPE VARCHAR(30),
    ALTER COLUMN apellido TYPE VARCHAR(30),
    ALTER COLUMN telefono TYPE VARCHAR(15);

ALTER TABLE estudiantes
    ADD CONSTRAINT chk_estudiantes_cedula CHECK (cedula ~ '^[0-9]{6,10}$'),
    ADD CONSTRAINT chk_estudiantes_telefono CHECK (telefono ~ '^[0-9]{7,15}$'),
    ADD CONSTRAINT chk_estudiantes_nombre CHECK (
        char_length(trim(nombre)) BETWEEN 2 AND 30
        AND nombre ~ '^[[:alpha:]''\-]+$'
    ),
    ADD CONSTRAINT chk_estudiantes_apellido CHECK (
        char_length(trim(apellido)) BETWEEN 2 AND 30
        AND apellido ~ '^[[:alpha:]''\-]+$'
    );

COMMIT;
