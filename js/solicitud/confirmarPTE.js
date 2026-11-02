
document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_URL = "http://localhost:8080/api/pago-total/ptt";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    const botonCancelar = document.getElementById("cancelar");
    const botonConfirmar = document.getElementById("confirmar-pago");
    const botonRechazar = document.getElementById("rechazar-pt");

    if (!idSolicitud || !/^\d+$/.test(idSolicitud) || Number(idSolicitud) <= 0) {
        mostrarMensaje("El código de solicitud no es válido.", "danger");
        deshabilitarBotones();
        return;
    }

    botonCancelar.addEventListener("click", () => {
        window.location.href =
            "/pages/solicitud/gestionarSolicitudesPagoTotal.html";
    });

    botonRechazar.href =
        `/pages/solicitud/rechazarPTE.html?id=${idSolicitud}`;

    botonConfirmar.addEventListener("click", confirmarPagoTotal);

    cargarDetallePagoTotal();

    async function cargarDetallePagoTotal() {
        try {
            const respuesta = await fetchAutenticado(
                `${API_URL}/detalle/${idSolicitud}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo obtener el detalle del pago total."
                );
            }

            mostrarDetalle(resultado.data);

        } catch (error) {
            mostrarMensaje(error.message, "danger");
            deshabilitarBotones();
        }
    }

    function mostrarDetalle(pago) {
        document.getElementById("id-solicitud").textContent =
            pago.idSolicitud;

        document.getElementById("titulo-solicitud").textContent =
            pago.tituloSolicitud || "-";

        document.getElementById("fecha-solicitud").textContent =
            formatearFecha(pago.fechaRegistroSolicitud);

        document.getElementById("id-asignacion").textContent =
            pago.idAsignacionTotal;

        document.getElementById("monto-asignado").textContent =
            formatearMonto(pago.montoAsignadoTotal);

        document.getElementById("monto-descontado").textContent =
            formatearMonto(pago.montoDescontado);

        document.getElementById("monto-por-cobrar").textContent =
            formatearMonto(pago.montoPorCobrar);

        document.getElementById("fecha-asignacion").textContent =
            formatearFecha(pago.fechaRegistroAsignacion);

        document.getElementById("id-pago").textContent =
            pago.idPagoTotal;

        document.getElementById("monto-pago").textContent =
            formatearMonto(pago.montoPago);

        document.getElementById("estado-pago").textContent =
            pago.estadoPago || "-";

        document.getElementById("medio-pago").textContent =
            pago.nombreMedioPago || "-";

        document.getElementById("fecha-operacion").textContent =
            formatearFecha(pago.fechaOperacion);

        document.getElementById("hora-operacion").textContent =
            pago.horaOperacion || "-";

        document.getElementById("numero-operacion").textContent =
            pago.numeroOperacion || "-";
    }

    async function confirmarPagoTotal() {
        const modal = new bootstrap.Modal(
            document.getElementById("modal-confirmacion")
        );

        modal.show();

        const botonAceptar = document.getElementById("btn-aceptar-confirmacion");

        botonAceptar.onclick = async () => {
            modal.hide();

            botonConfirmar.disabled = true;
            botonRechazar.classList.add("disabled");
            botonCancelar.disabled = true;

            try {
                const respuesta = await fetchAutenticado(
                    `${API_URL}/confirmar/${idSolicitud}`,
                    {
                        method: "PUT"
                    }
                );

                const resultado = await respuesta.json();

                if (!respuesta.ok || !resultado.success) {
                    throw new Error(
                        resultado.message || "No se pudo confirmar el pago total."
                    );
                }

                mostrarMensaje(
                    "El pago total fue confirmado correctamente.",
                    "success"
                );

                setTimeout(() => {
                    window.location.href =
                        "/pages/solicitud/gestionarSolicitudesPagoTotal.html";
                }, 1200);

            } catch (error) {
                mostrarMensaje(error.message, "danger");

                botonConfirmar.disabled = false;
                botonRechazar.classList.remove("disabled");
                botonCancelar.disabled = false;
            }
        };
    }

    function formatearMonto(monto) {
        if (monto === null || monto === undefined) {
            return "-";
        }

        return `S/ ${Number(monto).toFixed(2)}`;
    }

    function formatearFecha(fecha) {
        if (!fecha) {
            return "-";
        }

        const valor = new Date(fecha);

        if (Number.isNaN(valor.getTime())) {
            return fecha;
        }

        return valor.toLocaleString("es-PE");
    }

    function mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById("mensaje-container");

        contenedor.innerHTML = "";

        const alerta = document.createElement("div");
        alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
        alerta.setAttribute("role", "alert");
        alerta.textContent = mensaje;

        const botonCerrar = document.createElement("button");
        botonCerrar.type = "button";
        botonCerrar.className = "btn-close";
        botonCerrar.setAttribute("data-bs-dismiss", "alert");
        botonCerrar.setAttribute("aria-label", "Cerrar");

        alerta.appendChild(botonCerrar);
        contenedor.appendChild(alerta);
    }

    function deshabilitarBotones() {
        botonConfirmar.disabled = true;
        botonRechazar.classList.add("disabled");
    }
});
