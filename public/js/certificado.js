(() => {
  "use strict";

  document.addEventListener("DOMContentLoaded", () => {
    const certificado = document.getElementById("certificado");
    const btnPdf = document.getElementById("btn-descargar-pdf");
    const btnPrint = document.getElementById("btn-imprimir");

    if (btnPrint) {
      btnPrint.addEventListener("click", () => window.print());
    }

    if (!btnPdf || !certificado) return;

    const estado = document.getElementById("pdf-estado");
    const setEstado = (mensaje, esError = false) => {
      if (!estado) return;
      estado.textContent = mensaje;
      estado.classList.toggle("is-error", esError);
    };

    // Sube la copia del PDF a Neon Object Storage (bucket privado).
    const guardarCopia = async (blob) => {
      const id = certificado.dataset.estudianteId;
      if (!id) return;

      try {
        setEstado("Guardando copia en Neon Object Storage…");
        const response = await fetch(`/certificados/${id}/pdf`, {
          method: "POST",
          headers: {
            "Content-Type": "application/pdf",
            "X-CSRF-Token": certificado.dataset.csrf || "",
          },
          body: blob,
        });
        const data = await response.json().catch(() => null);

        if (!response.ok || !data?.ok) {
          setEstado(data?.mensaje || "No se pudo guardar la copia.", true);
          return;
        }

        setEstado(`Copia guardada (${Math.round((data.size || blob.size) / 1024)} KB).`);
      } catch (err) {
        console.error(err);
        setEstado("No se pudo guardar la copia.", true);
      }
    };

    btnPdf.addEventListener("click", async () => {
      if (typeof html2pdf === "undefined") {
        alert("No se pudo cargar el generador de PDF. Recargue la página.");
        return;
      }

      const filename = certificado.dataset.filename || "Certificado_Asistencia.pdf";
      const original = btnPdf.textContent;
      btnPdf.disabled = true;
      btnPdf.textContent = "Generando PDF…";

      try {
        // Esperar a que la imagen de fondo esté lista
        const bg = certificado.querySelector(".cert-bg");
        if (bg && !bg.complete) {
          await new Promise((resolve) => {
            bg.onload = resolve;
            bg.onerror = resolve;
          });
        }

        const opt = {
          margin: 0,
          filename,
          image: { type: "jpeg", quality: 0.98 },
          html2canvas: {
            scale: 2,
            useCORS: true,
            allowTaint: true,
            backgroundColor: "#ffffff",
            logging: false,
          },
          jsPDF: {
            unit: "mm",
            // Proporción exacta del lienzo (3300×2550) para evitar una
            // segunda página en blanco al exportar.
            format: [297, 229.5],
            orientation: "landscape",
          },
          pagebreak: { mode: ["avoid-all"] },
        };

        // Genera el PDF una sola vez: descarga local + copia en Object Storage.
        const blob = await html2pdf().set(opt).from(certificado).outputPdf("blob");

        const url = URL.createObjectURL(blob);
        const enlace = document.createElement("a");
        enlace.href = url;
        enlace.download = filename;
        document.body.appendChild(enlace);
        enlace.click();
        enlace.remove();
        setTimeout(() => URL.revokeObjectURL(url), 4000);

        await guardarCopia(blob);
      } catch (err) {
        console.error(err);
        alert("Ocurrió un error al generar el PDF. Intente nuevamente.");
      } finally {
        btnPdf.disabled = false;
        btnPdf.textContent = original;
      }
    });
  });
})();
