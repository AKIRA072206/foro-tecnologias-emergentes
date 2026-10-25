<?php

declare(strict_types=1);

namespace App\Core;

final class Auth
{
    private const SESSION_KEY = 'foro_staff';

    /** @return array<string, mixed> */
    private static function config(): array
    {
        return require dirname(__DIR__, 2) . '/config/auth.php';
    }

    public static function attempt(string $usuario, string $password): bool
    {
        $config = self::config();
        $esperadoUser = (string) ($config['usuario'] ?? '');
        $esperadoPass = (string) ($config['password'] ?? '');

        if ($usuario === '' || $password === '') {
            return false;
        }

        if (!hash_equals($esperadoUser, $usuario) || !hash_equals($esperadoPass, $password)) {
            return false;
        }

        session_regenerate_id(true);
        $_SESSION[self::SESSION_KEY] = [
            'usuario'  => $esperadoUser,
            'login_at' => time(),
        ];

        return true;
    }

    public static function check(): bool
    {
        return !empty($_SESSION[self::SESSION_KEY]['usuario']);
    }

    public static function user(): ?string
    {
        return $_SESSION[self::SESSION_KEY]['usuario'] ?? null;
    }

    public static function logout(): void
    {
        unset($_SESSION[self::SESSION_KEY]);
        session_regenerate_id(true);
    }

    public static function asistenciaHabilitada(): bool
    {
        $config = self::config();

        if (array_key_exists('forzar_asistencia', $config) && $config['forzar_asistencia'] !== null) {
            return (bool) $config['forzar_asistencia'];
        }

        $evento = (string) ($config['evento_fecha'] ?? '2026-11-06');
        $hoy = (new \DateTimeImmutable('today'))->format('Y-m-d');

        return $hoy >= $evento;
    }
}
