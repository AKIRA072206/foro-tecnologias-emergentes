<?php
/**
 * Credenciales del personal de logística.
 */

return [
    'usuario' => getenv('FORO_USER') ?: 'logistica',
    'password' => getenv('FORO_PASS') ?: 'foro2026',

    // Fecha del evento: a partir de este día se habilita el select de asistencia
    'evento_fecha' => '2026-11-06',

    // null = automático por fecha | true/false = forzar
    // true = pruebas: asistencia y certificados disponibles ya
    'forzar_asistencia' => true,
];
