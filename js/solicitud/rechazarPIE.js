
document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_URL = "http://localhost:8080/api/pago-inicial/pie";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    const descripcionRechazo = document.getElementById("descripcion-rechazo");
    const botonCancelar = document.getElementById("cancelar");
    const botonRechazar = document.getElementById("rechazar-pago");

    if (!idSolicitud || !/^\d+$/.test(idSolicitud) || Number(idSolicitud) <= 0) {
        mostrarMensaje("El código de solicitud no es válido.", "danger");
        botonRechazar.disabled = true;
        return;
    }

    botonCancelar.addEventListener("click", () => {
        window.location.href = "/pages/solicitud/gestionarSolicitudesPIE.html";
    });

    botonRechazar.addEventListener("click", rechazarPagoInicial);

    cargarDetallePagoInicial();

    async function cargarDetallePagoInicial() {
        try {
            const respuesta = await fetchAutenticado(
                `${API_URL}/detalle/${idSolicitud}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo obtener el detalle del pago inicial."
                );
            }

            mostrarDetalle(resultado.data);

        } catch (error) {
            mostrarMensaje(error.message, "danger");
            botonRechazar.disabled = true;
        }
    }

    function mostrarDetalle(pago) {
        document.getElementById("id-solicitud").textContent =
            pago.idSolicitud;

        document.getElementById("titulo-solicitud").textContent =
            pago.tituloSolicitud || "-";

        document.getElementById("id-pago").textContent =
            pago.idPagoInicial;

        document.getElementById("monto-pago").textContent =
            formatearMonto(pago.montoPago);

        document.getElementById("estado-pago").textContent =
            pago.estadoPago || "-";

        document.getElementById("medio-pago").textContent =
            pago.nombreMedioPago || "-";

        document.getElementById("hora-operacion").textContent =
            pago.horaOperacion || "-";

        document.getElementById("numero-operacion").textContent =
            pago.numeroOperacion || "-";
    }

    async function rechazarPagoInicial() {
        const descripcion = descripcionRechazo.value.trim();

        if (!descripcion) {
            mostrarMensaje("Debes ingresar el motivo del rechazo.", "warning");
            descripcionRechazo.focus();
            return;
        }

        if (descripcion.length > 1000) {
            mostrarMensaje("El motivo no puede superar los 1000 caracteres.", "warning");
            descripcionRechazo.focus();
            return;
        }

        const confirmar = window.confirm(
            "¿Estás seguro de rechazar el pago inicial de esta solicitud?"
        );

        if (!confirmar) {
            return;
        }

        botonRechazar.disabled = true;
        botonCancelar.disabled = true;

        try {
            const respuesta = await fetchAutenticado(
                `${API_URL}/rechazar/${idSolicitud}`,
                {
                    method: "PUT",
                    body: JSON.stringify({
                        descripcion: descripcion
                    })
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo rechazar el pago inicial."
                );
            }

            mostrarMensaje(
                resultado.message || "El pago inicial fue rechazado correctamente.",
                "success"
            );

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarSolicitudesPIE.html";
            }, 1500);

        } catch (error) {
            mostrarMensaje(error.message, "danger");

            botonRechazar.disabled = false;
            botonCancelar.disabled = false;
        }
    }

    function formatearMonto(monto) {
        if (monto === null || monto === undefined) {
            return "-";
        }

        return `S/ ${Number(monto).toFixed(2)}`;
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
});
