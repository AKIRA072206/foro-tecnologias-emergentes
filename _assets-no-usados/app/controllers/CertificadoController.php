<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;
use App\Models\EstudianteModel;
use Throwable;

class CertificadoController extends Controller
{
    private function requireAuth(): void
    {
        if (!Auth::check()) {
            $this->redirect('/login');
        }
    }

    public function index(): void
    {
        $this->requireAuth();

        $this->view('certificados/index', [
            'title'   => 'Consulta de Certificados',
            'page'    => 'certificados',
            'csrf'    => $this->csrfToken(),
            'mensaje' => null,
            'tipo'    => null,
        ]);
    }

    public function buscar(): void
    {
        $this->requireAuth();

        $cedula = preg_replace('/\D+/', '', (string) $this->input('cedula', '')) ?? '';

        if ($cedula === '' || !preg_match('/^[0-9]{6,10}$/', $cedula)) {
            $this->view('certificados/index', [
                'title'   => 'Consulta de Certificados',
                'page'    => 'certificados',
                'csrf'    => $this->csrfToken(),
                'mensaje' => 'Ingrese una cédula válida (solo números, máximo 10 dígitos).',
                'tipo'    => 'error',
            ]);
            return;
        }

        try {
            $modelo = new EstudianteModel();
            $estudiante = $modelo->buscarPorCedula($cedula);

            if ($estudiante === null) {
                $this->view('certificados/index', [
                    'title'   => 'Consulta de Certificados',
                    'page'    => 'certificados',
                    'csrf'    => $this->csrfToken(),
                    'mensaje' => 'No se encontró un registro con esa cédula.',
                    'tipo'    => 'error',
                ]);
                return;
            }

            $asistio = filter_var($estudiante['asistio'], FILTER_VALIDATE_BOOLEAN);
            if (!$asistio) {
                $this->view('certificados/index', [
                    'title'   => 'Consulta de Certificados',
                    'page'    => 'certificados',
                    'csrf'    => $this->csrfToken(),
                    'mensaje' => 'El participante aún no tiene asistencia confirmada. El certificado no está disponible.',
                    'tipo'    => 'error',
                ]);
                return;
            }

            $this->redirect('/certificados/' . (int) $estudiante['id']);
        } catch (Throwable $e) {
            $this->view('certificados/index', [
                'title'   => 'Consulta de Certificados',
                'page'    => 'certificados',
                'csrf'    => $this->csrfToken(),
                'mensaje' => 'Error al consultar el certificado.',
                'tipo'    => 'error',
            ]);
        }
    }

    public function ver(string $id): void
    {
        $this->requireAuth();

        $estudianteId = filter_var($id, FILTER_VALIDATE_INT);
        if ($estudianteId === false || $estudianteId <= 0) {
            http_response_code(404);
            echo 'Certificado no encontrado.';
            return;
        }

        try {
            $modelo = new EstudianteModel();
            $estudiante = $modelo->buscarPorId((int) $estudianteId);

            if ($estudiante === null) {
                http_response_code(404);
                echo 'Participante no encontrado.';
                return;
            }

            $asistio = filter_var($estudiante['asistio'], FILTER_VALIDATE_BOOLEAN);
            if (!$asistio) {
                http_response_code(403);
                $this->view('certificados/index', [
                    'title'   => 'Consulta de Certificados',
                    'page'    => 'certificados',
                    'csrf'    => $this->csrfToken(),
                    'mensaje' => 'No es posible emitir el certificado: la asistencia no está confirmada.',
                    'tipo'    => 'error',
                ]);
                return;
            }

            $this->view('certificados/ver', [
                'title'       => 'Certificado de Asistencia',
                'page'        => 'certificado-print',
                'estudiante'  => $estudiante,
                'eventoFecha' => '06 de noviembre de 2026',
                'eventoTitulo'=> 'II Foro de Tecnologías Emergentes: Inteligencia Artificial',
            ], null);
        } catch (Throwable $e) {
            http_response_code(500);
            echo 'Error al generar el certificado.';
        }
    }
}
