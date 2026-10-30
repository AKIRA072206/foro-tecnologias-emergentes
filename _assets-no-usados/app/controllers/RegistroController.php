<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Controller;
use App\Core\Validator;
use App\Models\EstudianteModel;
use RuntimeException;
use Throwable;

class RegistroController extends Controller
{
    public function index(): void
    {
        $this->view('registro/index', [
            'title'   => 'Registro de Participantes',
            'page'    => 'registro',
            'csrf'    => $this->csrfToken(),
            'mensaje' => null,
            'tipo'    => null,
            'old'     => [],
            'errores' => [],
        ]);
    }

    public function guardar(): void
    {
        $csrf = (string) $this->input('_csrf', '');

        if (!$this->verifyCsrf($csrf)) {
            $this->responderError('Token de seguridad inválido. Recargue la página.', 403);
            return;
        }

        if (!$this->isPost()) {
            $this->responderError('Método no permitido.', 405);
            return;
        }

        $validator = new Validator();
        $input = [
            'cedula'           => (string) $this->input('cedula', ''),
            'nombre'           => (string) $this->input('nombre', ''),
            'apellido'         => (string) $this->input('apellido', ''),
            'fecha_nacimiento' => (string) $this->input('fecha_nacimiento', ''),
            'correo'           => (string) $this->input('correo', ''),
            'telefono'         => (string) $this->input('telefono', ''),
        ];

        if (!$validator->validateRegistro($input)) {
            $this->responderValidacion($validator->errors(), $input);
            return;
        }

        $data = $validator->data();
        $modelo = new EstudianteModel();

        try {
            if ($modelo->existePorCedula($data['cedula'])) {
                $this->responderError('Ya existe un participante registrado con esa cédula.', 409, $input, [
                    'cedula' => 'Esta cédula ya está registrada.',
                ]);
                return;
            }

            $id = $modelo->crear($data);

            $mensaje = 'Registro exitoso. Su número de inscripción es #' . $id . '.';

            if ($this->isAjax()) {
                $this->json([
                    'ok'      => true,
                    'mensaje' => $mensaje,
                    'id'      => $id,
                ], 201);
            }

            $this->view('registro/index', [
                'title'   => 'Registro de Participantes',
                'page'    => 'registro',
                'csrf'    => $this->csrfToken(),
                'mensaje' => $mensaje,
                'tipo'    => 'success',
                'old'     => [],
                'errores' => [],
            ]);
        } catch (RuntimeException $e) {
            $status = $e->getCode() >= 400 && $e->getCode() < 600 ? (int) $e->getCode() : 500;
            $this->responderError($e->getMessage(), $status, $input);
        } catch (Throwable $e) {
            $this->responderError('Ocurrió un error inesperado al procesar el registro.', 500, $input);
        }
    }

    /** @param array<string, string> $errores */
    private function responderValidacion(array $errores, array $old): void
    {
        if ($this->isAjax()) {
            $this->json([
                'ok'      => false,
                'mensaje' => 'Revise los campos del formulario.',
                'errores' => $errores,
            ], 422);
        }

        $this->view('registro/index', [
            'title'   => 'Registro de Participantes',
            'page'    => 'registro',
            'csrf'    => $this->csrfToken(),
            'mensaje' => 'Revise los campos del formulario.',
            'tipo'    => 'error',
            'old'     => $old,
            'errores' => $errores,
        ]);
    }

    /** @param array<string, string> $errores */
    private function responderError(
        string $mensaje,
        int $status = 400,
        array $old = [],
        array $errores = []
    ): void {
        if ($this->isAjax()) {
            $this->json([
                'ok'      => false,
                'mensaje' => $mensaje,
                'errores' => $errores,
            ], $status);
        }

        $this->view('registro/index', [
            'title'   => 'Registro de Participantes',
            'page'    => 'registro',
            'csrf'    => $this->csrfToken(),
            'mensaje' => $mensaje,
            'tipo'    => 'error',
            'old'     => $old,
            'errores' => $errores,
        ]);
    }
}
