
const API_ASIGNACION = "http://localhost:8080/api/asignacion-total";

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = Number(parametros.get("id"));

    const codigoSolicitud = document.getElementById("codigo-solicitud");
    const formulario = document.getElementById("form-asignacion");
    const botonConfirmar = document.getElementById("btn-confirmar-asignacion");
    const botonAceptar = document.getElementById("btn-aceptar-confirmacion");
    const mensajeContainer = document.getElementById("mensaje-container");

    const modalConfirmacion = new bootstrap.Modal(
        document.getElementById("modal-confirmacion")
    );

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        mostrarMensaje("Código de solicitud inválido.", "danger");
        deshabilitarFormulario();
        return;
    }

    const resultadoVerificacion = await verificarSolicitud();

    if (!resultadoVerificacion.success) {
        return;
    }

    formulario.addEventListener("submit", event => {
    event.preventDefault();

    mensajeContainer.innerHTML = "";

    const validacion = validarFormulario();

    if (!validacion.success) {
        mostrarMensaje(validacion.message, "danger");
        document.getElementById(validacion.campo).focus();
        return;
    }

    modalConfirmacion.show();
});

    botonAceptar.addEventListener("click", registrarAsignacionTotal);

    async function registrarAsignacionTotal() {

        const datos = {
            asignacionTotal: {
                montoAsignadoTotal: Number(
                    document.getElementById("monto-total").value
                ),
                razon: document.getElementById("razon-asignacion").value.trim()
            },
            recomendacion: {
                cantidadUnidades: Number(
                    document.getElementById("cantidad-unidades").value
                ),
                razonCantidadUnidades:
                    document.getElementById("razon-cantidad-unidades").value.trim(),
                equipoSeguridad:
                    document.getElementById("equipo-seguridad").value.trim(),
                otrasRecomendaciones:
                    document.getElementById("otras-recomendaciones").value.trim()
            }
        };

        botonAceptar.disabled = true;
        botonConfirmar.disabled = true;

        botonAceptar.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Registrando...
        `;

        modalConfirmacion.hide();

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

            if (!response) {
                return;
            }

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo registrar la asignación total."
                );
            }

            mostrarMensaje(
                resultado.message || "La asignación total fue registrada correctamente.",
                "success"
            );

            formulario.querySelectorAll("input, textarea").forEach(elemento => {
                elemento.disabled = true;
            });

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarSolicitudesPIConfirmadas.html";
            }, 2000);

        } catch (error) {
            mostrarMensaje(
                error.message || "No se pudo obtener una respuesta del servidor.",
                "danger"
            );

        } finally {
            botonAceptar.disabled = false;
            botonConfirmar.disabled = false;

            botonAceptar.innerHTML = `
                <i class="bi bi-check-circle me-1"></i>
                Sí, registrar
            `;
        }
    }

    function validarFormulario() {

    const montoTotal = document.getElementById("monto-total").value.trim();
    const razonAsignacion = document.getElementById("razon-asignacion").value.trim();

    const cantidadUnidades = document.getElementById("cantidad-unidades").value.trim();
    const razonCantidad = document.getElementById("razon-cantidad-unidades").value.trim();

    const equipoSeguridad = document.getElementById("equipo-seguridad").value.trim();

    if (!montoTotal || Number(montoTotal) <= 0) {
        return {
            success: false,
            message: "El monto total debe ser mayor a cero.",
            campo: "monto-total"
        };
    }

    if (!razonAsignacion) {
        return {
            success: false,
            message: "La razón de la asignación es obligatoria.",
            campo: "razon-asignacion"
        };
    }

    if (!cantidadUnidades || !Number.isInteger(Number(cantidadUnidades)) || Number(cantidadUnidades) < 1) {
        return {
            success: false,
            message: "La cantidad de unidades debe ser mayor a cero.",
            campo: "cantidad-unidades"
        };
    }

    if (!razonCantidad) {
        return {
            success: false,
            message: "La razón de las unidades recomendadas es obligatoria.",
            campo: "razon-cantidad-unidades"
        };
    }

    if (!equipoSeguridad) {
        return {
            success: false,
            message: "El equipo de seguridad recomendado es obligatorio.",
            campo: "equipo-seguridad"
        };
    }

    return { success: true };
}

    async function verificarSolicitud() {
        try {
            const response = await fetchAutenticado(
                `${API_ASIGNACION}/verificar/${idSolicitud}`
            );

            if (!response) {
                return { success: false };
            }

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(
                    resultado.message || "No se puede acceder al formulario.",
                    "danger"
                );

                deshabilitarFormulario();

                return { success: false };
            }

            codigoSolicitud.textContent = idSolicitud;
            botonConfirmar.disabled = false;

            return { success: true };

        } catch (error) {
            mostrarMensaje(
                "No se pudo establecer comunicación con el servidor.",
                "danger"
            );

            deshabilitarFormulario();

            return { success: false };
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

    function deshabilitarFormulario() {
        formulario.querySelectorAll("input, textarea, button").forEach(elemento => {
            elemento.disabled = true;
        });
    }
});
