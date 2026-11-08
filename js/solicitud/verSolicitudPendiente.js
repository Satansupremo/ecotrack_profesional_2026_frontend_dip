document.addEventListener("DOMContentLoaded", async () => {
    if (!verificarAutenticacion()) return;

    const API_URL = "http://localhost:8080/api/solicitud";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = Number(parametros.get("id"));

    const contenidoSolicitud = document.getElementById("contenido-solicitud");
    const estadoSolicitud = document.getElementById("estado-solicitud");
    const mensajeContainer = document.getElementById("mensaje-container");

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        mostrarMensaje("Código de solicitud inválido.", "danger");
        contenidoSolicitud.innerHTML = "";
        return;
    }

    await cargarSolicitud();

    async function cargarSolicitud() {
        try {
            const url = `${API_URL}/pendientes/buscar/${idSolicitud}`;
            const response = await fetchAutenticado(url);
            const texto = await response.text();

            let resultado;

            try {
                resultado = JSON.parse(texto);
            } catch (error) {
                throw new Error("El servidor devolvió una respuesta no válida.");
            }

            if (!response.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudo obtener la solicitud.");
            }

            renderizarSolicitud(resultado.data);

        } catch (error) {
            contenidoSolicitud.innerHTML = "";
            mostrarMensaje(error.message, "danger");
        }
    }

    function renderizarSolicitud(solicitud) {
        estadoSolicitud.textContent = solicitud.estado || "SIN ESTADO";
        estadoSolicitud.dataset.estado = solicitud.estado || "";

        contenidoSolicitud.innerHTML = `
            <div class="row g-4">
                <div class="col-md-6">
                    <label class="form-label text-muted">Código de solicitud</label>
                    <p class="fw-semibold">${escaparHTML(solicitud.idSolicitud)}</p>
                </div>

                <div class="col-md-6">
                    <label class="form-label text-muted">Fecha de registro</label>
                    <p class="fw-semibold">${formatearFecha(solicitud.fechaRegistro)}</p>
                </div>

                <div class="col-12">
                    <label class="form-label text-muted">Título</label>
                    <p class="fw-semibold">${escaparHTML(solicitud.titulo)}</p>
                </div>

                <div class="col-12">
                    <label class="form-label text-muted">Descripción</label>
                    <p class="mb-0">${escaparHTML(solicitud.descripcion)}</p>
                </div>

                <div class="col-12">
                    <label class="form-label text-muted">Ubicación</label>
                    <p class="mb-0">${escaparHTML(solicitud.ubicacion)}</p>
                </div>
            </div>
        `;
    }

    function formatearFecha(fecha) {
        if (!fecha) return "No disponible";

        return new Date(fecha).toLocaleString("es-PE");
    }

    function escaparHTML(valor) {
        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";
        return elemento.innerHTML;
    }

    function mostrarMensaje(mensaje, tipo) {
        mensajeContainer.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }
});