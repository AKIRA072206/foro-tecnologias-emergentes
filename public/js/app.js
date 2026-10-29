(() => {
  "use strict";

  const CEDULA_RE = /^[0-9]{6,10}$/;
  const NOMBRE_RE = /^[\p{L}'\-]+$/u;
  const EMAIL_RE = /^[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}$/;
  const TELEFONO_RE = /^[0-9]{7,15}$/;

  document.addEventListener("DOMContentLoaded", () => {
    initRegistro();
    initLogistica();
  });

  function soloDigitos(value, max) {
    return String(value || "").replace(/\D+/g, "").slice(0, max);
  }

  function soloLetrasNombre(value, max) {
    return String(value || "")
      .replace(/[^\p{L}'\-]/gu, "")
      .slice(0, max);
  }

  function calcularEdad(fechaISO) {
    if (!fechaISO) return "";
    const nacimiento = new Date(fechaISO + "T00:00:00");
    if (Number.isNaN(nacimiento.getTime())) return "";

    const hoy = new Date();
    let edad = hoy.getFullYear() - nacimiento.getFullYear();
    const m = hoy.getMonth() - nacimiento.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < nacimiento.getDate())) {
      edad -= 1;
    }
    return edad >= 0 ? String(edad) : "";
  }

  function setError(field, message) {
    const slot = document.querySelector(`[data-error-for="${field.id}"]`);
    field.classList.toggle("is-invalid", Boolean(message));
    if (slot) slot.textContent = message || "";
  }

  function clearErrors(form) {
    form.querySelectorAll(".is-invalid").forEach((f) => f.classList.remove("is-invalid"));
    form.querySelectorAll(".field-error").forEach((e) => {
      e.textContent = "";
    });
  }

  function showAlert(el, message, type) {
    if (!el) return;
    const bsType = type === "error" ? "danger" : type;
    el.textContent = message;
    el.className = `alert alert-${bsType} show`;
    el.classList.remove("d-none");
  }

  function validarRegistro(form) {
    clearErrors(form);
    let ok = true;

    const cedula = soloDigitos(form.cedula.value, 10);
    const nombre = soloLetrasNombre(form.nombre.value.trim(), 30);
    const apellido = soloLetrasNombre(form.apellido.value.trim(), 30);
    const fecha = form.fecha_nacimiento.value;
    const correo = form.correo.value.trim().toLowerCase();
    const telefono = soloDigitos(form.telefono.value, 15);

    form.cedula.value = cedula;
    form.nombre.value = nombre;
    form.apellido.value = apellido;
    form.correo.value = correo;
    form.telefono.value = telefono;

    if (!CEDULA_RE.test(cedula)) {
      setError(form.cedula, "La cédula debe tener solo números (6 a 10 dígitos).");
      ok = false;
    }

    if (nombre.length < 2 || !NOMBRE_RE.test(nombre)) {
      setError(form.nombre, "Ingrese solo su primer nombre (letras, máx. 30).");
      ok = false;
    }

    if (apellido.length < 2 || !NOMBRE_RE.test(apellido)) {
      setError(form.apellido, "Ingrese solo su primer apellido (letras, máx. 30).");
      ok = false;
    }

    const edad = Number(calcularEdad(fecha));
    if (!fecha || Number.isNaN(edad) || edad < 12 || edad > 100) {
      setError(form.fecha_nacimiento, "Fecha inválida. La edad debe estar entre 12 y 100 años.");
      ok = false;
    }

    if (!EMAIL_RE.test(correo)) {
      setError(form.correo, "Correo electrónico inválido.");
      ok = false;
    }

    if (!TELEFONO_RE.test(telefono)) {
      setError(form.telefono, "El teléfono debe tener solo números (7 a 15 dígitos).");
      ok = false;
    }

    const vieneRadio = form.querySelector('input[name="viene_institucion"]:checked');
    if (vieneRadio && vieneRadio.value === "si") {
      const tipo = form.institution_type.value;
      if (!["universidad", "empresa", "otra"].includes(tipo)) {
        setError(form.institution_type, "Seleccione el tipo de institución.");
        ok = false;
      }

      const institucion = form.institution_name.value.trim().replace(/\s+/g, " ");
      form.institution_name.value = institucion;
      if (institucion.length < 2 || institucion.length > 150) {
        setError(form.institution_name, "El nombre de la institución debe tener entre 2 y 150 caracteres.");
        ok = false;
      }
    }

    return ok;
  }

  function abrirModal(modal) {
    if (!modal) return;
    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("modal-open");
    const focusable = modal.querySelector("button, [href], input, select, textarea");
    if (focusable) focusable.focus();
  }

  function cerrarModal(modal) {
    if (!modal) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    if (!document.querySelector(".success-modal:not([hidden]), .confirm-modal:not([hidden])")) {
      document.body.classList.remove("modal-open");
    }
  }

  function initRegistro() {
    const form = document.getElementById("form-registro");
    if (!form) return;

    const fecha = form.fecha_nacimiento;
    const edadInput = form.edad;
    const alerta = document.getElementById("alerta");
    const btn = document.getElementById("btn-registrar");
    const instExtra = document.getElementById("inst-extra");
    const successModal = document.getElementById("success-modal");
    const successMessage = document.getElementById("success-message");
    const successClose = document.getElementById("success-close");

    const syncInstitucion = () => {
      const checked = form.querySelector('input[name="viene_institucion"]:checked');
      const si = checked?.value === "si";
      if (instExtra) instExtra.classList.toggle("d-none", !si);
      form.institution_type.required = si;
      form.institution_name.required = si;
    };

    form.querySelectorAll('input[name="viene_institucion"]').forEach((radio) => {
      radio.addEventListener("change", syncInstitucion);
    });
    syncInstitucion();

    if (successClose) {
      successClose.addEventListener("click", () => cerrarModal(successModal));
    }
    if (successModal) {
      successModal.addEventListener("click", (event) => {
        if (event.target === successModal) cerrarModal(successModal);
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cerrarModal(successModal);
    });

    form.cedula.addEventListener("input", () => {
      form.cedula.value = soloDigitos(form.cedula.value, 10);
    });
    form.telefono.addEventListener("input", () => {
      form.telefono.value = soloDigitos(form.telefono.value, 15);
    });
    form.nombre.addEventListener("input", () => {
      form.nombre.value = soloLetrasNombre(form.nombre.value, 30);
    });
    form.apellido.addEventListener("input", () => {
      form.apellido.value = soloLetrasNombre(form.apellido.value, 30);
    });

    const syncEdad = () => {
      edadInput.value = calcularEdad(fecha.value);
    };

    fecha.addEventListener("change", syncEdad);
    fecha.addEventListener("input", syncEdad);
    syncEdad();

    form.addEventListener("submit", async (event) => {
      event.preventDefault();

      if (!validarRegistro(form)) {
        showAlert(alerta, "Revise los campos del formulario.", "error");
        return;
      }

      btn.disabled = true;
      const original = btn.textContent;
      btn.textContent = "Guardando…";

      try {
        const body = new FormData(form);
        const response = await fetch("/registro", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body,
        });

        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.ok) {
          if (data?.errores) {
            Object.entries(data.errores).forEach(([key, msg]) => {
              const field = form.elements.namedItem(key);
              if (field && field instanceof HTMLElement) setError(field, msg);
            });
          }
          showAlert(alerta, data?.mensaje || "No se pudo completar el registro.", "error");
          return;
        }

        showAlert(alerta, data.mensaje, "success");
        form.reset();
        edadInput.value = "";
        clearErrors(form);
        syncInstitucion();

        if (successModal && successMessage) {
          successMessage.textContent = data.mensaje;
          abrirModal(successModal);
        }
      } catch (err) {
        showAlert(alerta, "Error de red. Intente nuevamente.", "error");
      } finally {
        btn.disabled = false;
        btn.textContent = original;
      }
    });
  }

  function escapeHtml(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;");
  }

  function initLogistica() {
    const tabla = document.getElementById("tabla-asistencia");
    const tbody = document.getElementById("tbody-estudiantes");
    const buscador = document.getElementById("buscador");
    const csrf = document.getElementById("csrf-logistica");
    const toast = document.getElementById("toast-logistica");
    const confirmModal = document.getElementById("confirm-modal");
    const confirmText = document.getElementById("confirm-text");
    const confirmCancel = document.getElementById("confirm-cancel");
    const confirmDelete = document.getElementById("confirm-delete");
    if (!tabla || !tbody || !csrf) return;

    let pendienteEliminar = null;

    let asistenciaHabilitada = tabla.dataset.asistencia === "1";
    let filtroTipo = "todos";

    const mostrarToast = (msg, isError = false) => {
      if (!toast) return;
      toast.textContent = msg;
      toast.classList.toggle("is-error", isError);
      toast.classList.add("is-visible");
      clearTimeout(mostrarToast._t);
      mostrarToast._t = setTimeout(() => toast.classList.remove("is-visible"), 2800);
    };

    const aplicarFiltro = () => {
      const q = buscador ? buscador.value.trim().toLowerCase() : "";
      tbody.querySelectorAll("tr").forEach((row) => {
        if (row.classList.contains("empty-row")) return;
        const tipo = row.dataset.tipo || "no_indico";
        const coincideTipo = filtroTipo === "todos" || tipo === filtroTipo;
        const texto = (row.textContent || "").toLowerCase();
        const coincideTexto = !q || texto.includes(q);
        row.classList.toggle("is-hidden", !(coincideTipo && coincideTexto));
      });
    };

    const formatFecha = (raw) => {
      if (!raw) return "—";
      const d = new Date(raw);
      if (Number.isNaN(d.getTime())) return "—";
      const pad = (n) => String(n).padStart(2, "0");
      return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    };

    const renderFilas = (estudiantes) => {
      const cols = asistenciaHabilitada ? 9 : 8;
      if (!estudiantes.length) {
        tbody.innerHTML = `<tr class="empty-row"><td colspan="${cols}">No hay participantes registrados aún.</td></tr>`;
        return;
      }

      tbody.innerHTML = estudiantes
        .map((e) => {
          const nombre = escapeHtml(e.nombre);
          const apellido = escapeHtml(e.apellido);
          const cedula = escapeHtml(e.cedula);
          const correo = escapeHtml(e.correo);
          const telefono = escapeHtml(e.telefono);
          const cedulaKey = String(e.cedula).toLowerCase();
          const apellidoKey = String(e.apellido).toLowerCase();
          const tipo = e.institution_type || "no_indico";
          const institucion =
            tipo === "no_indico"
              ? `<span class="text-muted">—</span>`
              : `<span class="inst-nombre">${escapeHtml(e.institution_name || "")}</span><span class="inst-tipo">${escapeHtml(tipo)}</span>`;
          const acciones = `<button type="button" class="btn btn-sm btn-outline-danger btn-eliminar"
              data-id="${e.id}" data-nombre="${nombre} ${apellido}" data-eliminar="${e.asistio ? "1" : "0"}"
              ${e.asistio ? "disabled" : ""}
              title="${e.asistio ? "No se puede eliminar: asistencia confirmada" : "Eliminar registro"}">Eliminar</button>`;
          const attrs = `data-id="${e.id}" data-cedula="${escapeHtml(cedulaKey)}" data-apellido="${escapeHtml(apellidoKey)}" data-tipo="${escapeHtml(tipo)}"`;

          if (asistenciaHabilitada) {
            const cert = e.asistio
              ? `<a class="btn btn-sm btn-outline-primary" href="/certificados/${e.id}" target="_blank" rel="noopener">Ver</a>`
              : `<span class="text-muted">—</span>`;
            const selectHtml = e.asistio
              ? `<select class="form-select form-select-sm select-asistencia" data-id="${e.id}" disabled title="Asistencia confirmada: no se puede modificar" aria-label="Asistencia confirmada de ${nombre} ${apellido}">
                  <option value="1" selected>Sí</option>
                </select>`
              : `<select class="form-select form-select-sm select-asistencia" data-id="${e.id}" aria-label="Asistencia de ${nombre} ${apellido}">
                  <option value="0" selected>No</option>
                  <option value="1">Sí</option>
                </select>`;
            return `<tr ${attrs}>
              <td>${cedula}</td><td>${apellido}</td><td>${nombre}</td><td>${correo}</td><td>${telefono}</td>
              <td class="cell-inst">${institucion}</td>
              <td>${selectHtml}</td>
              <td class="cell-cert">${cert}</td>
              <td class="cell-acciones">${acciones}</td>
            </tr>`;
          }

          return `<tr ${attrs}>
            <td>${cedula}</td><td>${apellido}</td><td>${nombre}</td><td>${correo}</td><td>${telefono}</td>
            <td class="cell-inst">${institucion}</td>
            <td>${escapeHtml(formatFecha(e.fecha_registro))}</td>
            <td class="cell-acciones">${acciones}</td>
          </tr>`;
        })
        .join("");

      aplicarFiltro();
    };

    const actualizarStats = (total, asistentes) => {
      const totalEl = document.getElementById("stat-total");
      const asisEl = document.getElementById("stat-asistentes");
      if (totalEl) totalEl.textContent = String(total);
      if (asisEl) asisEl.textContent = String(asistentes);
    };

    // Neon Realtime (public/js/logistica-live.js) empuja el listado completo.
    // Si la suscripción está viva, el polling de 15 s queda desactivado.
    window.addEventListener("foro:estudiantes", (event) => {
      const detail = event.detail || {};
      if (!Array.isArray(detail.estudiantes)) return;
      if (detail.status !== "live" && detail.status !== "stale") return;

      const prevAsistencia = asistenciaHabilitada;
      if (typeof detail.asistencia_habilitada === "boolean") {
        asistenciaHabilitada = detail.asistencia_habilitada;
      }
      if (prevAsistencia !== asistenciaHabilitada) {
        window.location.reload();
        return;
      }

      const focused = document.activeElement;
      if (focused instanceof HTMLSelectElement && focused.classList.contains("select-asistencia")) {
        return;
      }

      renderFilas(detail.estudiantes);
      actualizarStats(detail.total ?? detail.estudiantes.length, detail.asistentes ?? 0);

      const note = document.getElementById("refresh-note");
      if (note) note.textContent = "Actualización en vivo (Neon Realtime)";
    });

    const refrescarLista = async () => {
      if (window.__foroLiveConnected) return;
      try {
        const response = await fetch("/logistica/lista", {
          headers: { Accept: "application/json", "X-Requested-With": "XMLHttpRequest" },
        });
        if (response.status === 401) {
          window.location.href = "/login";
          return;
        }
        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) return;

        const prevAsistencia = asistenciaHabilitada;
        asistenciaHabilitada = Boolean(data.asistencia_habilitada);
        if (prevAsistencia !== asistenciaHabilitada) {
          window.location.reload();
          return;
        }

        // Conservar valores de selects en edición local no es crítico; re-render limpio
        const focused = document.activeElement;
        const editingSelect =
          focused instanceof HTMLSelectElement && focused.classList.contains("select-asistencia");
        if (editingSelect) return;

        renderFilas(data.estudiantes || []);
        actualizarStats(data.total ?? 0, data.asistentes ?? 0);
      } catch (err) {
        /* silencio: el panel sigue usable offline temporalmente */
      }
    };

    if (buscador) {
      buscador.addEventListener("input", aplicarFiltro);
    }

    document.querySelectorAll(".filtro-btn").forEach((boton) => {
      boton.addEventListener("click", () => {
        filtroTipo = boton.dataset.tipo || "todos";
        document.querySelectorAll(".filtro-btn").forEach((b) => {
          b.classList.toggle("is-active", b === boton);
        });
        aplicarFiltro();
      });
    });

    tbody.addEventListener("click", (event) => {
      const btn = event.target.closest(".btn-eliminar");
      if (!btn) return;

      if (btn.dataset.eliminar === "1") {
        mostrarToast("No se puede eliminar: la asistencia ya fue confirmada.", true);
        return;
      }

      pendienteEliminar = btn;
      if (confirmText) {
        confirmText.textContent = `¿Seguro que desea eliminar a ${btn.dataset.nombre}? La acción no se puede deshacer.`;
      }
      abrirModal(confirmModal);
    });

    if (confirmCancel) {
      confirmCancel.addEventListener("click", () => cerrarModal(confirmModal));
    }
    if (confirmModal) {
      confirmModal.addEventListener("click", (event) => {
        if (event.target === confirmModal) cerrarModal(confirmModal);
      });
    }
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") cerrarModal(confirmModal);
    });

    if (confirmDelete) {
      confirmDelete.addEventListener("click", async () => {
        if (!pendienteEliminar) return;

        const btn = pendienteEliminar;
        const id = Number(btn.dataset.id);
        confirmDelete.disabled = true;

        try {
          const response = await fetch("/logistica/eliminar", {
            method: "POST",
            headers: {
              Accept: "application/json",
              "Content-Type": "application/json",
              "X-Requested-With": "XMLHttpRequest",
            },
            body: JSON.stringify({ id, _csrf: csrf.value }),
          });

          const data = await response.json().catch(() => null);
          if (!response.ok || !data?.ok) {
            mostrarToast(data?.mensaje || "No se pudo eliminar el registro.", true);
            if (response.status === 401) window.location.href = "/login";
            return;
          }

          const row = btn.closest("tr");
          if (row) row.remove();
          pendienteEliminar = null;
          cerrarModal(confirmModal);

          const restantes = tbody.querySelectorAll("tr:not(.empty-row)").length;
          const asistentes = [...tbody.querySelectorAll(".select-asistencia")].filter(
            (s) => s.value === "1",
          ).length;
          actualizarStats(restantes, asistentes);

          mostrarToast(data.mensaje);
        } catch (err) {
          mostrarToast("Error de red al eliminar.", true);
        } finally {
          confirmDelete.disabled = false;
        }
      });
    }

    tabla.addEventListener("change", async (event) => {
      const select = event.target;
      if (!(select instanceof HTMLSelectElement) || !select.classList.contains("select-asistencia")) {
        return;
      }

      if (select.disabled) return;

      const id = select.dataset.id;
      const asistio = select.value === "1";
      const prev = "0";

      // Solo se permite confirmar (Sí). Si vuelve a No, revertir.
      if (!asistio) {
        select.value = prev;
        return;
      }

      select.disabled = true;

      try {
        const response = await fetch("/logistica/asistencia", {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
            "X-Requested-With": "XMLHttpRequest",
          },
          body: JSON.stringify({
            id: Number(id),
            asistio: true,
            _csrf: csrf.value,
          }),
        });

        const data = await response.json().catch(() => null);
        if (!response.ok || !data?.ok) {
          select.value = prev;
          select.disabled = false;
          mostrarToast(data?.mensaje || "No se pudo actualizar.", true);
          if (response.status === 401) window.location.href = "/login";
          return;
        }

        // Bloquear definitivamente el select
        select.innerHTML = '<option value="1" selected>Sí</option>';
        select.disabled = true;
        select.title = "Asistencia confirmada: no se puede modificar";

        const cell = select.closest("tr")?.querySelector(".cell-cert");
        if (cell) {
          cell.innerHTML = `<a class="btn btn-sm btn-outline-primary" href="/certificados/${id}" target="_blank" rel="noopener">Ver</a>`;
        }

        const asisEl = document.getElementById("stat-asistentes");
        if (asisEl) {
          const count = [...tbody.querySelectorAll(".select-asistencia")].filter((s) => s.value === "1").length;
          asisEl.textContent = String(count);
        }

        mostrarToast(data.mensaje);
      } catch (err) {
        select.value = prev;
        select.disabled = false;
        mostrarToast("Error de red al actualizar.", true);
      }
    });

    setInterval(refrescarLista, 15000);
  }
})();
