const API_SOLICITUD = "http://localhost:8080/api/solicitud";
const API_ASIGNACION = "http://localhost:8080/api/asignacion-inicial";

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = Number(parametros.get("id"));

    const codigoSolicitud = document.getElementById("codigo-solicitud");
    const formulario = document.getElementById("form-asignacion");
    const montoInicial = document.getElementById("monto-inicial");
    const botonConfirmar = document.getElementById("btn-confirmar-asignacion");
    const mensajeContainer = document.getElementById("mensaje-container");

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        mostrarMensaje("Código de solicitud inválido.", "danger");
        return;
    }

    await verificarSolicitud();

    formulario.addEventListener("submit", async event => {
        event.preventDefault();

        mensajeContainer.innerHTML = "";

        const monto = Number(montoInicial.value);

        botonConfirmar.disabled = true;
        botonConfirmar.innerHTML = `
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
                    body: JSON.stringify({
                        montoAsignadoInicial: monto
                    })
                }
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            mostrarMensaje(resultado.message, "success");

            formulario.reset();

            formulario.querySelectorAll("input").forEach(input => {
                input.disabled = true;
            });

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarSolicitudesPendientes.html";
            }, 2000);

        } catch (error) {
            console.error("Error al registrar la asignación inicial:", error);

            mostrarMensaje(
                "No se pudo obtener una respuesta del servidor.",
                "danger"
            );

        } finally {
            botonConfirmar.disabled = false;
            botonConfirmar.innerHTML = `
                <i class="bi bi-check-circle me-1"></i>
                Registrar asignación inicial
            `;
        }
    });

    async function verificarSolicitud() {
        try {
            const response = await fetchAutenticado(
                `${API_SOLICITUD}/pendientes/buscar/${idSolicitud}`
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                throw new Error(resultado.message);
            }

            const solicitud = resultado.data;

            if (solicitud.estado !== "PENDIENTE") {
                throw new Error("La solicitud ya no se encuentra pendiente.");
            }

            codigoSolicitud.textContent = solicitud.idSolicitud;
            botonConfirmar.disabled = false;

        } catch (error) {
            console.error("Error al verificar la solicitud:", error);

            codigoSolicitud.textContent = "No disponible";

            mostrarMensaje(
                error.message || "No se pudo obtener una respuesta del servidor.",
                "danger"
            );

            formulario.querySelectorAll("input, button").forEach(elemento => {
                elemento.disabled = true;
            });
        }
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