<?php

declare(strict_types=1);

namespace App\Models;

use App\Core\Database;
use PDO;
use PDOException;
use RuntimeException;

class AsistenciaModel
{
    private PDO $db;

    public function __construct()
    {
        $this->db = Database::getInstance();
    }

    /**
     * Actualiza el flag asistio de forma transaccional.
     *
     * @return array{id: int, asistio: bool}|null
     */
    public function actualizarAsistencia(int $id, bool $asistio): ?array
    {
        $sql = 'UPDATE estudiantes
                SET asistio = :asistio
                WHERE id = :id
                RETURNING id, asistio';

        try {
            Database::beginTransaction();

            $stmt = $this->db->prepare($sql);
            // PostgreSQL PDO: boolean como 't'/'f' evita ambigüedad del driver
            $stmt->bindValue(':asistio', $asistio ? 't' : 'f', PDO::PARAM_STR);
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();

            $row = $stmt->fetch();

            if ($row === false) {
                Database::rollBack();
                return null;
            }

            Database::commit();

            return [
                'id'      => (int) $row['id'],
                'asistio' => filter_var($row['asistio'], FILTER_VALIDATE_BOOLEAN),
            ];
        } catch (PDOException $e) {
            Database::rollBack();
            throw new RuntimeException('No se pudo actualizar la asistencia.', 500, $e);
        }
    }

    public function haAsistido(int $id): bool
    {
        $stmt = $this->db->prepare(
            'SELECT asistio FROM estudiantes WHERE id = :id LIMIT 1'
        );
        $stmt->bindValue(':id', $id, PDO::PARAM_INT);
        $stmt->execute();

        $value = $stmt->fetchColumn();
        if ($value === false) {
            return false;
        }

        return filter_var($value, FILTER_VALIDATE_BOOLEAN);
    }
}
