<?php

declare(strict_types=1);

namespace App\Core;

abstract class Controller
{
    protected function view(string $view, array $data = [], ?string $layout = 'layouts/header'): void
    {
        extract($data, EXTR_SKIP);

        $viewFile = dirname(__DIR__) . '/views/' . str_replace('.', '/', $view) . '.php';

        if (!is_file($viewFile)) {
            http_response_code(500);
            echo 'Vista no encontrada.';
            return;
        }

        if ($layout !== null) {
            $header = dirname(__DIR__) . '/views/layouts/header.php';
            $footer = dirname(__DIR__) . '/views/layouts/footer.php';
            require $header;
            require $viewFile;
            require $footer;
            return;
        }

        require $viewFile;
    }

    protected function json(array $payload, int $status = 200): void
    {
        http_response_code($status);
        header('Content-Type: application/json; charset=utf-8');
        header('X-Content-Type-Options: nosniff');
        echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
        exit;
    }

    protected function redirect(string $path): void
    {
        header('Location: ' . $path);
        exit;
    }

    protected function isPost(): bool
    {
        return strtoupper($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST';
    }

    protected function isAjax(): bool
    {
        $requestedWith = $_SERVER['HTTP_X_REQUESTED_WITH'] ?? '';
        $accept = $_SERVER['HTTP_ACCEPT'] ?? '';

        return strcasecmp($requestedWith, 'XMLHttpRequest') === 0
            || str_contains($accept, 'application/json');
    }

    protected function csrfToken(): string
    {
        if (empty($_SESSION['_csrf'])) {
            $_SESSION['_csrf'] = bin2hex(random_bytes(32));
        }

        return $_SESSION['_csrf'];
    }

    protected function verifyCsrf(?string $token): bool
    {
        if ($token === null || empty($_SESSION['_csrf'])) {
            return false;
        }

        return hash_equals($_SESSION['_csrf'], $token);
    }

    protected function input(string $key, mixed $default = null): mixed
    {
        return $_POST[$key] ?? $_GET[$key] ?? $default;
    }
}
