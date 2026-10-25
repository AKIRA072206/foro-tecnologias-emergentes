<?php
$page = $page ?? '';
$title = $title ?? 'II Foro de Tecnologías Emergentes';
$isStaff = in_array($page, ['logistica', 'certificados'], true);
$brandHref = $isStaff ? '/logistica' : ($page === 'login' ? '/login' : '/registro');
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <meta name="description" content="II Foro de Tecnologías Emergentes: Inteligencia Artificial — 06 de noviembre de 2026">
    <meta name="robots" content="noindex, nofollow">
    <title><?= htmlspecialchars($title, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link href="https://cdn.jsdelivr.net/npm/bootstrap@5.3.3/dist/css/bootstrap.min.css" rel="stylesheet"
          integrity="sha384-QWTKZyjpPEjISv5WaRU9OFeRpok6YctnYmDr5pNlyT2bRjXh0JMhjY6hW+ALEwIH" crossorigin="anonymous">
    <link rel="stylesheet" href="/css/style.css">
</head>
<body class="page-<?= htmlspecialchars($page, ENT_QUOTES, 'UTF-8') ?> d-flex flex-column min-vh-100">
    <a class="skip-link visually-hidden-focusable" href="#contenido">Saltar al contenido</a>

    <nav class="navbar navbar-expand-lg navbar-foro sticky-top shadow-sm">
        <div class="container">
            <a class="navbar-brand d-flex align-items-center gap-2" href="<?= htmlspecialchars($brandHref, ENT_QUOTES, 'UTF-8') ?>">
                <img src="/img/logo-foro-cert.png" alt="II Foro Tecnologías Emergentes — Inteligencia Artificial"
                     class="brand-logo" width="72" height="72">
                <span class="brand-text d-none d-sm-flex flex-column lh-sm">
                    <strong>II Foro</strong>
                    <small>Tecnologías Emergentes · IA</small>
                </span>
            </a>

            <?php if ($isStaff): ?>
            <button class="navbar-toggler" type="button" data-bs-toggle="collapse" data-bs-target="#navStaff"
                    aria-controls="navStaff" aria-expanded="false" aria-label="Menú">
                <span class="navbar-toggler-icon"></span>
            </button>
            <div class="collapse navbar-collapse" id="navStaff">
                <ul class="navbar-nav ms-auto align-items-lg-center gap-lg-2">
                    <li class="nav-item">
                        <a class="nav-link <?= $page === 'logistica' ? 'active' : '' ?>" href="/logistica">Logística</a>
                    </li>
                    <li class="nav-item">
                        <a class="nav-link <?= $page === 'certificados' ? 'active' : '' ?>" href="/certificados">Certificados</a>
                    </li>
                    <li class="nav-item">
                        <a class="btn btn-outline-light btn-sm ms-lg-2" href="/logout">Salir</a>
                    </li>
                </ul>
            </div>
            <?php endif; ?>
        </div>
    </nav>

    <main id="contenido" class="site-main flex-grow-1">
