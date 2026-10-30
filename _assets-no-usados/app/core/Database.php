<?php

declare(strict_types=1);

namespace App\Core;

use PDO;
use PDOException;
use RuntimeException;

/**
 * Singleton de conexión PDO a PostgreSQL.
 */
final class Database
{
    private static ?PDO $instance = null;

    private function __construct()
    {
    }

    public static function getInstance(): PDO
    {
        if (self::$instance === null) {
            $config = require dirname(__DIR__, 2) . '/config/database.php';

            $dsn = sprintf(
                '%s:host=%s;port=%s;dbname=%s',
                $config['driver'],
                $config['host'],
                $config['port'],
                $config['dbname']
            );

            try {
                self::$instance = new PDO(
                    $dsn,
                    $config['user'],
                    $config['password'],
                    $config['options']
                );
                self::$instance->exec("SET NAMES 'UTF8'");
                self::$instance->exec("SET TIME ZONE 'America/Caracas'");
            } catch (PDOException $e) {
                throw new RuntimeException(
                    'No se pudo conectar a la base de datos. Verifique la configuración.',
                    0,
                    $e
                );
            }
        }

        return self::$instance;
    }

    public static function beginTransaction(): void
    {
        self::getInstance()->beginTransaction();
    }

    public static function commit(): void
    {
        self::getInstance()->commit();
    }

    public static function rollBack(): void
    {
        $pdo = self::getInstance();
        if ($pdo->inTransaction()) {
            $pdo->rollBack();
        }
    }
}
