<?php

declare(strict_types=1);

namespace App\Controllers;

use App\Core\Auth;
use App\Core\Controller;

class AuthController extends Controller
{
    public function loginForm(): void
    {
        if (Auth::check()) {
            $this->redirect('/logistica');
        }

        $this->view('auth/login', [
            'title'   => 'Acceso Logística',
            'page'    => 'login',
            'csrf'    => $this->csrfToken(),
            'error'   => null,
            'usuario' => '',
        ]);
    }

    public function login(): void
    {
        if (!$this->isPost()) {
            $this->redirect('/login');
        }

        $csrf = (string) $this->input('_csrf', '');
        if (!$this->verifyCsrf($csrf)) {
            $this->view('auth/login', [
                'title'   => 'Acceso Logística',
                'page'    => 'login',
                'csrf'    => $this->csrfToken(),
                'error'   => 'Token de seguridad inválido. Recargue la página.',
                'usuario' => '',
            ]);
            return;
        }

        // Pequeña pausa anti fuerza bruta
        usleep(250000);

        $usuario = trim((string) $this->input('usuario', ''));
        $password = (string) $this->input('password', '');

        if (!Auth::attempt($usuario, $password)) {
            $this->view('auth/login', [
                'title'   => 'Acceso Logística',
                'page'    => 'login',
                'csrf'    => $this->csrfToken(),
                'error'   => 'Usuario o contraseña incorrectos.',
                'usuario' => $usuario,
            ]);
            return;
        }

        $this->redirect('/logistica');
    }

    public function logout(): void
    {
        Auth::logout();
        $this->redirect('/login');
    }
}
