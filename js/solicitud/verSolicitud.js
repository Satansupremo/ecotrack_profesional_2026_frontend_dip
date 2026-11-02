
const API_URL = "http://localhost:8080/api/solicitud";

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const detalleContainer = document.getElementById("detalle-solicitud");
    const mensajeContainer = document.getElementById("mensaje-container");

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    if (!idSolicitud || !/^\d+$/.test(idSolicitud)) {
        mostrarMensaje("El código de solicitud no es válido.", "warning");
        detalleContainer.innerHTML = "";
        return;
    }

    await cargarSolicitud();

    async function cargarSolicitud() {
        try {
            const response = await fetchAutenticado(
                `${API_URL}/buscar/${idSolicitud}`
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                detalleContainer.innerHTML = "";
                return;
            }

            renderizarSolicitud(resultado.data);

        } catch (error) {
            detalleContainer.innerHTML = "";

            mostrarMensaje(
                "No se pudo obtener una respuesta del servidor.",
                "danger"
            );
        }
    }

    function renderizarSolicitud(solicitud) {
        const fechaRegistro = solicitud.fechaRegistro
            ? new Date(solicitud.fechaRegistro).toLocaleString("es-PE")
            : "-";

        const fechaFinalizacion = solicitud.fechaFinalizacion
            ? new Date(solicitud.fechaFinalizacion).toLocaleString("es-PE")
            : "Pendiente";

        detalleContainer.innerHTML = `
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">

                <div>
                    <span class="text-secondary small">Código de solicitud</span>
                    <h2 class="h3 fw-bold mb-0">
                        #${escaparHTML(solicitud.idSolicitud)}
                    </h2>
                </div>

                <span class="badge rounded-pill fs-6 ${obtenerClaseEstado(solicitud.estado)}">
                    ${escaparHTML(solicitud.estado)}
                </span>

            </div>

            <hr class="text-secondary opacity-25">

            <div class="mb-4">
                <label class="form-label text-secondary small fw-semibold">
                    Título
                </label>
                <p class="fs-5 fw-semibold mb-0">
                    ${escaparHTML(solicitud.titulo)}
                </p>
            </div>

            <div class="mb-4">
                <label class="form-label text-secondary small fw-semibold">
                    Descripción
                </label>
                <p class="mb-0" style="white-space: pre-line;">
                    ${escaparHTML(solicitud.descripcion)}
                </p>
            </div>

            <div class="mb-4">
                <label class="form-label text-secondary small fw-semibold">
                    Ubicación
                </label>
                <p class="mb-0">
                    <i class="bi bi-geo-alt text-danger me-2"></i>
                    ${escaparHTML(solicitud.ubicacion)}
                </p>
            </div>

            <div class="row g-4 mt-2">

                <div class="col-12 col-md-6">
                    <div class="bg-light rounded-3 p-3 h-100">
                        <span class="text-secondary small">
                            Fecha de registro
                        </span>
                        <p class="fw-semibold mb-0 mt-1">
                            <i class="bi bi-calendar-event text-danger me-2"></i>
                            ${fechaRegistro}
                        </p>
                    </div>
                </div>

                <div class="col-12 col-md-6">
                    <div class="bg-light rounded-3 p-3 h-100">
                        <span class="text-secondary small">
                            Fecha de finalización
                        </span>
                        <p class="fw-semibold mb-0 mt-1">
                            <i class="bi bi-calendar-check text-danger me-2"></i>
                            ${fechaFinalizacion}
                        </p>
                    </div>
                </div>

            </div>

            <div class="d-flex justify-content-end mt-4">
                <a href="/pages/solicitud/gestionarMisSolicitudes.html"
                   class="btn btn-outline-danger">
                    <i class="bi bi-arrow-left me-2"></i>
                    Volver al listado
                </a>
            </div>
        `;
    }

    function obtenerClaseEstado(estado) {
        const estados = {
            PENDIENTE: "text-bg-success",
            PAGO_INICIAL_PENDIENTE: "text-bg-warning",
            PAGO_INICIAL_EFECTUADO: "text-bg-warning",
            PAGO_INICIAL_CONFIRMADO: "text-bg-warning",

            PAGO_TOTAL_PENDIENTE: "text-bg-dark",
            PAGO_TOTAL_EFECTUADO: "text-bg-dark",
            PAGO_TOTAL_CONFIRMADO: "text-bg-dark",
            PROGRAMADO: "text-bg-primary",
            FINALIZADO: "text-bg-success",
            CANCELADO: "text-bg-danger"
        };

        return estados[estado] || "text-bg-secondary";
    }

    function mostrarMensaje(mensaje, tipo) {
        mensajeContainer.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }
});
