<?php

declare(strict_types=1);

/**
 * Front Controller — II Foro de Tecnologías Emergentes
 */

session_start([
    'cookie_httponly' => true,
    'cookie_samesite' => 'Lax',
    'use_strict_mode' => true,
]);

// Cabeceras de seguridad básicas
header('X-Frame-Options: SAMEORIGIN');
header('X-Content-Type-Options: nosniff');
header('Referrer-Policy: strict-origin-when-cross-origin');
header("Content-Security-Policy: default-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com https://cdn.jsdelivr.net; font-src 'self' https://fonts.gstatic.com https://cdn.jsdelivr.net; script-src 'self' https://cdn.jsdelivr.net; img-src 'self' data: blob:; connect-src 'self' https://cdn.jsdelivr.net; worker-src 'self' blob:;");

define('BASE_PATH', dirname(__DIR__));

spl_autoload_register(static function (string $class): void {
    $prefix = 'App\\';
    if (!str_starts_with($class, $prefix)) {
        return;
    }

    $relative = substr($class, strlen($prefix));
    $parts = explode('\\', $relative);

    // App\Controllers\X -> app/controllers/X.php
    if (isset($parts[0])) {
        $parts[0] = strtolower($parts[0]);
    }

    $path = BASE_PATH . '/app/' . implode('/', $parts) . '.php';

    if (is_file($path)) {
        require_once $path;
    }
});

use App\Controllers\AuthController;
use App\Controllers\CertificadoController;
use App\Controllers\HomeController;
use App\Controllers\LogisticaController;
use App\Controllers\RegistroController;
use App\Core\Router;

$router = new Router();

$router->get('/', [HomeController::class, 'index']);
$router->get('/registro', [RegistroController::class, 'index']);
$router->post('/registro', [RegistroController::class, 'guardar']);

$router->get('/login', [AuthController::class, 'loginForm']);
$router->post('/login', [AuthController::class, 'login']);
$router->get('/logout', [AuthController::class, 'logout']);

$router->get('/logistica', [LogisticaController::class, 'index']);
$router->get('/logistica/lista', [LogisticaController::class, 'lista']);
$router->post('/logistica/asistencia', [LogisticaController::class, 'actualizarAsistencia']);

$router->get('/certificados', [CertificadoController::class, 'index']);
$router->get('/certificados/buscar', [CertificadoController::class, 'buscar']);
$router->get('/certificados/{id}', [CertificadoController::class, 'ver']);

$uri = $_SERVER['REQUEST_URI'] ?? '/';
$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

$router->dispatch($uri, $method);
