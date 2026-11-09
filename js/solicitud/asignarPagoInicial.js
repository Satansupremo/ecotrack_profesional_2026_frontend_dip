
const API_SOLICITUD = "http://localhost:8080/api/solicitud";
const API_ASIGNACION = "http://localhost:8080/api/asignacion-inicial";

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = Number(parametros.get("id"));

    const codigoSolicitud = document.getElementById("codigo-solicitud");
    const estadoSolicitud = document.getElementById("estado-solicitud");
    const tituloSolicitud = document.getElementById("titulo-solicitud");
    const descripcionSolicitud = document.getElementById("descripcion-solicitud");
    const ubicacionSolicitud = document.getElementById("ubicacion-solicitud");
    const fechaRegistro = document.getElementById("fecha-registro");
    const formulario = document.getElementById("form-asignacion");
    const montoInicial = document.getElementById("monto-inicial");
    const razon = document.getElementById("razon");
    const botonConfirmar = document.getElementById("btn-confirmar-asignacion");
    const botonAceptar = document.getElementById("btn-aceptar-registro");
    const mensajeContainer = document.getElementById("mensaje-container");

    const modalElemento = document.getElementById("modal-confirmacion");
    const modalConfirmacion = new bootstrap.Modal(modalElemento);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        return;
    }

    const solicitudDisponible = await verificarSolicitud();
    if (!solicitudDisponible) {
        return;
    }

    formulario.addEventListener("submit", async event => {
        event.preventDefault();

        const datos = {
            montoAsignadoInicial: Number(montoInicial.value),
            razon: razon.value.trim()
        };

        botonConfirmar.disabled = true;

        try {
            const response = await fetchAutenticado(
                `${API_ASIGNACION}/validar/${idSolicitud}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(datos)
                }
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(
                    resultado.message || "No se pudo validar la asignación inicial.",
                    "danger"
                );
                return;
            }

            mensajeContainer.innerHTML = "";
            modalConfirmacion.show();

        } catch (error) {
            mostrarMensaje(
                error.message || "No se pudo validar la asignación inicial.",
                "danger"
            );
        } finally {
            botonConfirmar.disabled = false;
        }
    });

    botonAceptar.addEventListener("click", async () => {

        const datos = {
            montoAsignadoInicial: Number(montoInicial.value),
            razon: razon.value.trim()
        };

        botonAceptar.disabled = true;
        botonAceptar.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Registrando...
        `;

        try {
            const response = await fetchAutenticado(
                `${API_ASIGNACION}/registrar/${idSolicitud}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(datos)
                }
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                modalConfirmacion.hide();
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            modalConfirmacion.hide();
            mostrarMensaje(resultado.message, "success");

            formulario.reset();

            formulario.querySelectorAll("input, textarea").forEach(elemento => {
                elemento.disabled = true;
            });

            botonConfirmar.disabled = true;

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarSolicitudesPendientes.html";
            }, 2000);

        } catch (error) {
            modalConfirmacion.hide();
            mostrarMensaje(
                error.message || "No se pudo registrar la asignación inicial.",
                "danger"
            );
        } finally {
            if (!botonConfirmar.disabled) {
                botonAceptar.disabled = false;
                botonAceptar.innerHTML = "Sí, registrar";
            }
        }
    });

    async function verificarSolicitud() {
        try {
            const response = await fetchAutenticado(
                `${API_SOLICITUD}/pendientes/buscar/${idSolicitud}`
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(
                    resultado.message || "No se pudo obtener la solicitud.",
                    "danger"
                );
                mostrarDetalleNoDisponible();
                return false;
            }

            const solicitud = resultado.data;
            if (!solicitud || typeof solicitud !== "object") {
                throw new Error("El servidor devolvió una solicitud no válida.");
            }

            codigoSolicitud.textContent = solicitud.idSolicitud ?? "-";
            tituloSolicitud.textContent = solicitud.titulo || "No disponible";
            descripcionSolicitud.textContent =
                solicitud.descripcion || "No disponible";
            ubicacionSolicitud.textContent = solicitud.ubicacion || "No disponible";
            fechaRegistro.textContent = formatearFecha(solicitud.fechaRegistro);

            const estado = solicitud.estado || "SIN ESTADO";
            estadoSolicitud.textContent = estado;
            estadoSolicitud.dataset.estado = solicitud.estado || "";

            if (solicitud.estado !== "PENDIENTE") {
                mostrarMensaje(
                    "Esta solicitud ya no está pendiente y no se puede asignar un pago inicial.",
                    "warning"
                );
                return false;
            }

            botonConfirmar.disabled = false;
            return true;

        } catch (error) {
            mostrarDetalleNoDisponible();
            mostrarMensaje(
                error.message || "No se pudo obtener la solicitud.",
                "danger"
            );
            return false;
        }
    }

    function mostrarDetalleNoDisponible() {
        codigoSolicitud.textContent = "-";
        estadoSolicitud.textContent = "No disponible";
        tituloSolicitud.textContent = "No disponible";
        descripcionSolicitud.textContent = "No disponible";
        ubicacionSolicitud.textContent = "No disponible";
        fechaRegistro.textContent = "No disponible";
    }

    function formatearFecha(fecha) {
        if (!fecha) return "No disponible";

        const fechaFormateada = new Date(fecha);
        if (Number.isNaN(fechaFormateada.getTime())) return "No disponible";

        return fechaFormateada.toLocaleString("es-PE");
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
