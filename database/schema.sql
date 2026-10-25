-- ============================================================
-- II Foro de Tecnologías Emergentes: Inteligencia Artificial
-- Script de inicialización - Base de datos: foro
-- ============================================================

-- CREATE DATABASE foro WITH ENCODING 'UTF8';
-- \c foro

BEGIN;

CREATE TABLE IF NOT EXISTS estudiantes (
    id               SERIAL PRIMARY KEY,
    cedula           VARCHAR(10)  NOT NULL,
    nombre           VARCHAR(30)  NOT NULL,
    apellido         VARCHAR(30)  NOT NULL,
    fecha_nacimiento DATE         NOT NULL,
    edad             INT          NOT NULL CHECK (edad >= 0 AND edad <= 120),
    correo           VARCHAR(150) NOT NULL,
    telefono         VARCHAR(15)  NOT NULL,
    asistio          BOOLEAN      NOT NULL DEFAULT FALSE,
    fecha_registro   TIMESTAMP    NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT uq_estudiantes_cedula UNIQUE (cedula),
    CONSTRAINT chk_estudiantes_correo CHECK (
        correo ~* '^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$'
    ),
    CONSTRAINT chk_estudiantes_cedula CHECK (
        cedula ~ '^[0-9]{6,10}$'
    ),
    CONSTRAINT chk_estudiantes_telefono CHECK (
        telefono ~ '^[0-9]{7,15}$'
    ),
    CONSTRAINT chk_estudiantes_nombre CHECK (
        char_length(trim(nombre)) BETWEEN 2 AND 30
        AND nombre ~ '^[[:alpha:]''\-]+$'
    ),
    CONSTRAINT chk_estudiantes_apellido CHECK (
        char_length(trim(apellido)) BETWEEN 2 AND 30
        AND apellido ~ '^[[:alpha:]''\-]+$'
    )
);

CREATE INDEX IF NOT EXISTS idx_estudiantes_apellido ON estudiantes (apellido);
CREATE INDEX IF NOT EXISTS idx_estudiantes_asistio ON estudiantes (asistio);
CREATE INDEX IF NOT EXISTS idx_estudiantes_cedula ON estudiantes (cedula);

COMMENT ON TABLE estudiantes IS 'Participantes registrados al II Foro de Tecnologías Emergentes';
COMMENT ON COLUMN estudiantes.asistio IS 'TRUE cuando logística confirma asistencia el 06/11/2026';
COMMENT ON COLUMN estudiantes.nombre IS 'Solo primer nombre';
COMMENT ON COLUMN estudiantes.apellido IS 'Solo primer apellido';

COMMIT;
