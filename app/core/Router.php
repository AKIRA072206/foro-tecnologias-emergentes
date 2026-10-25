<?php

declare(strict_types=1);

namespace App\Core;

/**
 * Enrutador simple para el front controller.
 */
final class Router
{
    /** @var array<string, array<string, array{0: class-string, 1: string}>> */
    private array $routes = [];

    public function get(string $path, array $handler): void
    {
        $this->routes['GET'][$this->normalize($path)] = $handler;
    }

    public function post(string $path, array $handler): void
    {
        $this->routes['POST'][$this->normalize($path)] = $handler;
    }

    public function dispatch(string $uri, string $method): void
    {
        $path = parse_url($uri, PHP_URL_PATH) ?: '/';
        $path = $this->normalize($path);
        $method = strtoupper($method);

        // Quitar prefijo /public si el DocumentRoot no apunta a public/
        if (str_starts_with($path, '/public')) {
            $path = substr($path, 7) ?: '/';
            $path = $this->normalize($path);
        }

        $class = null;
        $action = null;
        $params = [];

        if (isset($this->routes[$method][$path])) {
            [$class, $action] = $this->routes[$method][$path];
        } else {
            $matched = $this->matchDynamic($method, $path);
            if ($matched !== null) {
                [$class, $action, $params] = $matched;
            }
        }

        if ($class === null || $action === null) {
            http_response_code(404);
            echo 'Página no encontrada.';
            return;
        }

        if (!class_exists($class)) {
            http_response_code(500);
            echo 'Controlador no disponible.';
            return;
        }

        $controller = new $class();

        if (!method_exists($controller, $action)) {
            http_response_code(500);
            echo 'Acción no disponible.';
            return;
        }

        $controller->{$action}(...$params);
    }

    /**
     * @return array{0: class-string, 1: string, 2: list<string>}|null
     */
    private function matchDynamic(string $method, string $path): ?array
    {
        foreach ($this->routes[$method] ?? [] as $route => $handler) {
            if (!str_contains($route, '{')) {
                continue;
            }

            $pattern = preg_replace('#\{([a-zA-Z_]+)\}#', '([^/]+)', $route);
            $pattern = '#^' . $pattern . '$#';

            if (preg_match($pattern, $path, $matches)) {
                array_shift($matches);
                return [$handler[0], $handler[1], array_values($matches)];
            }
        }

        return null;
    }

    private function normalize(string $path): string
    {
        $path = '/' . trim($path, '/');
        return $path === '/' ? '/' : rtrim($path, '/');
    }
}
