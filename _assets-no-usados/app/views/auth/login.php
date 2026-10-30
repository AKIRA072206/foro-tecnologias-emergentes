<section class="section py-4 py-md-5">
    <div class="container" style="max-width: 480px;">
        <header class="section-head mb-4 text-center">
            <img src="/img/logo-foro-cert.png" alt="Logo II Foro" class="mb-3" width="120" height="120"
                 style="object-fit:contain;border-radius:16px;background:transparent;box-shadow:0 8px 24px rgba(0,27,72,.12);">
            <span class="badge rounded-pill text-bg-primary mb-2">Acceso restringido · Personal</span>
            <h1 class="h3 mb-1">Iniciar sesión</h1>
            <p class="text-muted mb-0">Panel de logística — II Foro de Tecnologías Emergentes</p>
        </header>

        <?php if (!empty($error)): ?>
            <div class="alert alert-danger" role="alert">
                <?= htmlspecialchars((string) $error, ENT_QUOTES, 'UTF-8') ?>
            </div>
        <?php endif; ?>

        <form class="card shadow-sm border-0 p-3 p-md-4" method="POST" action="/login" autocomplete="off">
            <input type="hidden" name="_csrf" value="<?= htmlspecialchars($csrf, ENT_QUOTES, 'UTF-8') ?>">

            <div class="mb-3">
                <label class="form-label" for="usuario">Usuario</label>
                <input type="text" class="form-control" id="usuario" name="usuario" maxlength="60" required
                       value="<?= htmlspecialchars((string) ($usuario ?? ''), ENT_QUOTES, 'UTF-8') ?>"
                       autocomplete="username">
            </div>

            <div class="mb-4">
                <label class="form-label" for="password">Contraseña</label>
                <input type="password" class="form-control" id="password" name="password" maxlength="120" required
                       autocomplete="current-password">
            </div>

            <button type="submit" class="btn btn-primary w-100">Entrar al panel</button>
        </form>
    </div>
</section>
