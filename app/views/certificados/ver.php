<?php
$nombreCompleto = mb_strtoupper(
    trim(($estudiante['nombre'] ?? '') . ' ' . ($estudiante['apellido'] ?? '')),
    'UTF-8'
);
$cedula = (string) ($estudiante['cedula'] ?? '');
$codigo = 'CERT-' . str_pad((string) ($estudiante['id'] ?? 0), 6, '0', STR_PAD_LEFT);
$eventoFecha = $eventoFecha ?? '06 de noviembre de 2026';
$archivoPdf = 'Certificado_Asistencia_' . preg_replace('/[^A-Za-z0-9_-]+/', '_', $nombreCompleto) . '.pdf';
?>
<!DOCTYPE html>
<html lang="es">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Certificado de Asistencia — <?= htmlspecialchars($nombreCompleto, ENT_QUOTES, 'UTF-8') ?></title>
    <link rel="preconnect" href="https://fonts.googleapis.com">
    <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
    <link href="https://fonts.googleapis.com/css2?family=Libre+Baskerville:wght@400;700&family=Montserrat:wght@400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="/css/certificado.css">
</head>
<body class="cert-page">
    <div class="cert-toolbar no-print">
        <a href="/certificados" class="btn-tool">← Volver</a>
        <div class="cert-toolbar-actions">
            <button type="button" class="btn-tool" id="btn-imprimir">Imprimir</button>
            <button type="button" class="btn-tool btn-tool-primary" id="btn-descargar-pdf">Descargar PDF</button>
        </div>
    </div>

    <article class="certificate" id="certificado" aria-label="Certificado de asistencia"
             data-filename="<?= htmlspecialchars($archivoPdf, ENT_QUOTES, 'UTF-8') ?>">
        <img class="cert-bg" src="/img/plantilla-certificado.png" alt="" aria-hidden="true">

        <header class="cert-logos">
            <img class="logo-foro-cert" src="/img/logo-foro-cert.png" alt="II Foro Tecnologías Emergentes — Inteligencia Artificial">
            <img class="logo-uptyab" src="/img/logo-uptyab.png" alt="UPTYAB">
        </header>

        <div class="cert-content">
            <div class="cert-divider" aria-hidden="true"><span></span></div>

            <h1 class="cert-title">CERTIFICADO DE ASISTENCIA</h1>

            <div class="cert-divider" aria-hidden="true"><span></span></div>

            <p class="cert-otorgado">Otorgado a</p>

            <p class="cert-name"><?= htmlspecialchars($nombreCompleto, ENT_QUOTES, 'UTF-8') ?></p>

            <div class="cert-divider cert-divider-name" aria-hidden="true"><span></span></div>

            <p class="cert-cedula">Cédula: <?= htmlspecialchars($cedula, ENT_QUOTES, 'UTF-8') ?></p>

            <p class="cert-motivo">
                Por su asistencia al
                <strong>II Foro de Tecnologías Emergentes (IA).</strong>
            </p>

            <p class="cert-colaboracion">
                Realizado en colaboración con los estudiantes de trayecto IV
                del programa nacional de formación en informática de la UPTYAB.
            </p>

            <div class="cert-divider" aria-hidden="true"><span></span></div>

            <p class="cert-fecha"><?= htmlspecialchars($eventoFecha, ENT_QUOTES, 'UTF-8') ?></p>
        </div>
    </article>

    <script src="https://cdn.jsdelivr.net/npm/html2pdf.js@0.10.1/dist/html2pdf.bundle.min.js"></script>
    <script src="/js/certificado.js"></script>
</body>
</html>
