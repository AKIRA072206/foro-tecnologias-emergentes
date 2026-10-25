<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Models\AsistenciaModel;
use App\Models\EstudianteModel;
use Throwable;

class LogisticaController extends Controller
{
    private function requireAuth(): void
    {
        if (!Auth::check()) {
            if ($this->isAjax()) {
                $this->json(['ok' => false, 'mensaje' => 'Sesión expirada. Inicie sesión nuevamente.'], 401);
            }
            $this->redirect('/login');
        }
    }

    public function index(): void
    {
        $this->requireAuth();

        $estudiantes = [];
        $error = null;

        try {
            $modelo = new EstudianteModel();
            $estudiantes = $modelo->listarTodos();
        } catch (Throwable $e) {
            $error = 'No se pudieron cargar los registros. Verifique la conexión a PostgreSQL.';
        }

        $asistenciaOk = Auth::asistenciaHabilitada();

        $this->view('logistica/index', [
            'title'              => 'Logística',
            'page'               => 'logistica',
            'csrf'               => $this->csrfToken(),
            'estudiantes'        => $estudiantes,
            'error'              => $error,
            'eventoFecha'        => '06 de noviembre de 2026',
            'eventoHora'         => '8:00 AM',
            'asistenciaHabilitada'=> $asistenciaOk,
            'usuario'            => Auth::user(),
        ]);
    }

    /** Listado JSON para refresco automático del panel */
    public function lista(): void
    {
        $this->requireAuth();

        try {
            $modelo = new EstudianteModel();
            $rows = $modelo->listarTodos();

            $data = array_map(static function (array $e): array {
                return [
                    'id'               => (int) $e['id'],
                    'cedula'           => (string) $e['cedula'],
                    'nombre'           => (string) $e['nombre'],
                    'apellido'         => (string) $e['apellido'],
                    'correo'           => (string) $e['correo'],
                    'telefono'         => (string) $e['telefono'],
                    'asistio'          => filter_var($e['asistio'], FILTER_VALIDATE_BOOLEAN),
                    'fecha_registro'   => (string) ($e['fecha_registro'] ?? ''),
                ];
            }, $rows);

            $this->json([
                'ok'                   => true,
                'asistencia_habilitada' => Auth::asistenciaHabilitada(),
                'total'                => count($data),
                'asistentes'           => count(array_filter($data, static fn($r) => $r['asistio'])),
                'estudiantes'          => $data,
            ]);
        } catch (Throwable $e) {
            $this->json(['ok' => false, 'mensaje' => 'No se pudo obtener el listado.'], 500);
        }
    }

    public function actualizarAsistencia(): void
    {
        $this->requireAuth();

        if (!Auth::asistenciaHabilitada()) {
            $this->json([
                'ok'      => false,
                'mensaje' => 'El control de asistencia se habilita el día del evento (06/11/2026).',
            ], 403);
        }

        if (!$this->isPost()) {
            $this->json(['ok' => false, 'mensaje' => 'Método no permitido.'], 405);
        }

        $raw = file_get_contents('php://input') ?: '';
        $jsonBody = json_decode($raw, true);
        $payload = is_array($jsonBody) ? array_merge($_POST, $jsonBody) : $_POST;

        $csrf = (string) ($payload['_csrf'] ?? '');
        if (!$this->verifyCsrf($csrf)) {
            $this->json(['ok' => false, 'mensaje' => 'Token de seguridad inválido.'], 403);
        }

        $id = filter_var($payload['id'] ?? null, FILTER_VALIDATE_INT);
        if ($id === false || $id <= 0) {
            $this->json(['ok' => false, 'mensaje' => 'Identificador de estudiante inválido.'], 422);
        }

        $asistioRaw = $payload['asistio'] ?? null;
        if (is_bool($asistioRaw)) {
            $asistio = $asistioRaw;
        } elseif (is_string($asistioRaw) || is_int($asistioRaw)) {
            $val = strtolower((string) $asistioRaw);
            if (in_array($val, ['1', 'true', 'yes', 'on', 'si', 'sí'], true)) {
                $asistio = true;
            } elseif (in_array($val, ['0', 'false', 'no', 'off'], true)) {
                $asistio = false;
            } else {
                $this->json(['ok' => false, 'mensaje' => 'Valor de asistencia inválido.'], 422);
            }
        } else {
            $asistio = filter_var($asistioRaw, FILTER_VALIDATE_BOOLEAN, FILTER_NULL_ON_FAILURE);
            if ($asistio === null) {
                $this->json(['ok' => false, 'mensaje' => 'Valor de asistencia inválido.'], 422);
            }
        }

        try {
            $estudiantes = new EstudianteModel();
            $actual = $estudiantes->buscarPorId((int) $id);

            if ($actual === null) {
                $this->json(['ok' => false, 'mensaje' => 'Estudiante no encontrado.'], 404);
            }

            $yaAsistio = filter_var($actual['asistio'], FILTER_VALIDATE_BOOLEAN);

            // Una vez marcada la asistencia (Sí), no se puede modificar
            if ($yaAsistio) {
                $this->json([
                    'ok'      => false,
                    'mensaje' => 'La asistencia ya fue confirmada y no se puede modificar.',
                    'data'    => ['id' => (int) $id, 'asistio' => true, 'bloqueado' => true],
                ], 409);
            }

            // Solo se permite confirmar asistencia (pasar a Sí)
            if (!(bool) $asistio) {
                $this->json([
                    'ok'      => true,
                    'mensaje' => 'Sin cambios: la persona aún no ha sido marcada como asistente.',
                    'data'    => ['id' => (int) $id, 'asistio' => false],
                ]);
            }

            $modelo = new AsistenciaModel();
            $resultado = $modelo->actualizarAsistencia((int) $id, true);

            if ($resultado === null) {
                $this->json(['ok' => false, 'mensaje' => 'Estudiante no encontrado.'], 404);
            }

            $this->json([
                'ok'      => true,
                'mensaje' => 'Asistencia confirmada: Sí vino. Este registro quedó bloqueado.',
                'data'    => array_merge($resultado, ['bloqueado' => true]),
            ]);
        } catch (Throwable $e) {
            $this->json(['ok' => false, 'mensaje' => 'Error al actualizar la asistencia.'], 500);
        }
    }
}
