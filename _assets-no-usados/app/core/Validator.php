<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Validación y sanitización de entradas del formulario de registro.
 */
final class Validator
{
    /** @var array<string, string> */
    private array $errors = [];

    /** @var array<string, mixed> */
    private array $data = [];

    public function validateRegistro(array $input): bool
    {
        $this->errors = [];
        $this->data = [];

        $cedula = $this->clean($input['cedula'] ?? '');
        $nombre = $this->clean($input['nombre'] ?? '');
        $apellido = $this->clean($input['apellido'] ?? '');
        $fechaNacimiento = $this->clean($input['fecha_nacimiento'] ?? '');
        $correo = strtolower($this->clean($input['correo'] ?? ''));
        $telefono = $this->clean($input['telefono'] ?? '');

        // Cédula: solo dígitos, máximo 10
        $cedulaNorm = preg_replace('/\D+/', '', $cedula) ?? '';
        if ($cedulaNorm === '' || !preg_match('/^[0-9]{6,10}$/', $cedulaNorm)) {
            $this->errors['cedula'] = 'La cédula debe contener solo números (entre 6 y 10 dígitos).';
        } else {
            $this->data['cedula'] = $cedulaNorm;
        }

        // Solo primer nombre (sin espacios), máx. 30
        if ($nombre === '' || mb_strlen($nombre) < 2 || mb_strlen($nombre) > 30) {
            $this->errors['nombre'] = 'El primer nombre debe tener entre 2 y 30 caracteres.';
        } elseif (!preg_match('/^[\p{L}\'\-]+$/u', $nombre)) {
            $this->errors['nombre'] = 'Solo primer nombre: únicamente letras (sin espacios ni números).';
        } else {
            $this->data['nombre'] = mb_convert_case($nombre, MB_CASE_TITLE, 'UTF-8');
        }

        // Solo primer apellido (sin espacios), máx. 30
        if ($apellido === '' || mb_strlen($apellido) < 2 || mb_strlen($apellido) > 30) {
            $this->errors['apellido'] = 'El primer apellido debe tener entre 2 y 30 caracteres.';
        } elseif (!preg_match('/^[\p{L}\'\-]+$/u', $apellido)) {
            $this->errors['apellido'] = 'Solo primer apellido: únicamente letras (sin espacios ni números).';
        } else {
            $this->data['apellido'] = mb_convert_case($apellido, MB_CASE_TITLE, 'UTF-8');
        }

        if ($fechaNacimiento === '' || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $fechaNacimiento)) {
            $this->errors['fecha_nacimiento'] = 'La fecha de nacimiento es obligatoria (AAAA-MM-DD).';
        } else {
            $fecha = \DateTimeImmutable::createFromFormat('Y-m-d', $fechaNacimiento);
            $errors = \DateTimeImmutable::getLastErrors();
            $invalid = ($errors['warning_count'] ?? 0) > 0 || ($errors['error_count'] ?? 0) > 0;

            if ($fecha === false || $invalid || $fecha->format('Y-m-d') !== $fechaNacimiento) {
                $this->errors['fecha_nacimiento'] = 'La fecha de nacimiento no es válida.';
            } else {
                $hoy = new \DateTimeImmutable('today');
                if ($fecha > $hoy) {
                    $this->errors['fecha_nacimiento'] = 'La fecha de nacimiento no puede ser futura.';
                } else {
                    $edad = (int) $fecha->diff($hoy)->y;
                    if ($edad < 12 || $edad > 100) {
                        $this->errors['fecha_nacimiento'] = 'La edad debe estar entre 12 y 100 años.';
                    } else {
                        $this->data['fecha_nacimiento'] = $fechaNacimiento;
                        $this->data['edad'] = $edad;
                    }
                }
            }
        }

        if ($correo === '' || !filter_var($correo, FILTER_VALIDATE_EMAIL)) {
            $this->errors['correo'] = 'El correo electrónico no es válido.';
        } elseif (mb_strlen($correo) > 150) {
            $this->errors['correo'] = 'El correo electrónico es demasiado largo.';
        } else {
            $this->data['correo'] = $correo;
        }

        // Teléfono: solo números
        $telefonoNorm = preg_replace('/\D+/', '', $telefono) ?? '';
        if ($telefonoNorm === '' || !preg_match('/^[0-9]{7,15}$/', $telefonoNorm)) {
            $this->errors['telefono'] = 'El teléfono debe contener solo números (entre 7 y 15 dígitos).';
        } else {
            $this->data['telefono'] = $telefonoNorm;
        }

        return $this->errors === [];
    }

    /** @return array<string, string> */
    public function errors(): array
    {
        return $this->errors;
    }

    /** @return array<string, mixed> */
    public function data(): array
    {
        return $this->data;
    }

    public function firstError(): string
    {
        return $this->errors === [] ? '' : (string) reset($this->errors);
    }

    private function clean(string $value): string
    {
        $value = trim($value);
        return preg_replace('/[\x00-\x1F\x7F]/u', '', $value) ?? '';
    }
}
