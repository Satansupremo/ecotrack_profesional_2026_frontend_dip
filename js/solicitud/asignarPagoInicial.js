
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
    const razon = document.getElementById("razon");
    const botonConfirmar = document.getElementById("btn-confirmar-asignacion");
    const botonAceptar = document.getElementById("btn-aceptar-registro");
    const mensajeContainer = document.getElementById("mensaje-container");

    const modalElemento = document.getElementById("modal-confirmacion");
    const modalConfirmacion = new bootstrap.Modal(modalElemento);

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        return;
    }

    await verificarSolicitud();

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
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            mensajeContainer.innerHTML = "";
            modalConfirmacion.show();

        } catch (error) {
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
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            const solicitud = resultado.data;

            if (solicitud.estado !== "PENDIENTE") {
                return;
            }

            codigoSolicitud.textContent = solicitud.idSolicitud;
            botonConfirmar.disabled = false;

        } catch (error) {
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
