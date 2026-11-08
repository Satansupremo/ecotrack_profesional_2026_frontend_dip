
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_ASIGNACION = "http://localhost:8080/api/asignacion-total";
    const API_ASIGNACION_INICIAL = "http://localhost:8080/api/asignacion-inicial";
    const API_PAGO_TOTAL = "http://localhost:8080/api/pago-total";
    const API_MEDIO_PAGO = "http://localhost:8080/api/medio-pago";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = Number(parametros.get("id"));

    const codigoSolicitud = document.getElementById("codigo-solicitud");
    const montoAsignado = document.getElementById("monto-a-pagar");
    const montoTotalAsignado = document.getElementById("monto-total-asignado");
    const pagoInicial = document.getElementById("pago-inicial");
    const razon = document.getElementById("razon");

    const formulario = document.getElementById("formulario-pago");
    const medioPago = document.getElementById("medio-pago");
    const monto = document.getElementById("monto");

    const fechaOperacion = document.getElementById("fecha-operacion");
    const horaOperacion = document.getElementById("hora-operacion");
    const numeroOperacion = document.getElementById("numero-operacion");

    fechaOperacion.maxLength = 10;
    fechaOperacion.setAttribute("inputmode", "numeric");
    fechaOperacion.addEventListener("input", () => {
        const valor = fechaOperacion.value.replace(/[^\d-]/g, "");
        if (valor.length > 10) {
            fechaOperacion.value = valor.slice(0, 10);
            return;
        }
        fechaOperacion.value = valor;
    });

    const numeroCuenta = document.getElementById("numero-cuenta");
    const botonRegistrar = document.getElementById("boton-registrar");
    const mensajeContainer = document.getElementById("mensaje-container");

    let registroExitoso = false;

    if (!Number.isInteger(idSolicitud) || idSolicitud <= 0) {
        deshabilitarFormulario();
        return;
    }

    codigoSolicitud.textContent = `#${idSolicitud}`;

    medioPago.addEventListener("change", () => {
        const opcionSeleccionada = medioPago.selectedOptions[0];
        const cuenta = opcionSeleccionada?.dataset.numeroCuenta || "";

        numeroCuenta.value = cuenta
            ? cuenta.replace(/\s+/g, "").replace(/(\d{3})(?=\d)/g, "$1 ")
            : "";

        actualizarEstadoFormulario();
    });

    await cargarInformacion();

    formulario.addEventListener("submit", async event => {
        event.preventDefault();

        mensajeContainer.innerHTML = "";

        const validacion = validarFormulario();

        if (!validacion.success) {
            mostrarMensaje(validacion.message, "danger");
            const campo = document.getElementById(validacion.campo);
            if (campo) {
                campo.focus({ preventScroll: true });
            }
            return;
        }

        const request = {
            idMedioPago: Number(medioPago.value),
            monto: Number(monto.value),
            fechaOperacion: fechaOperacion.value,
            horaOperacion: horaOperacion.value.length === 5
                ? `${horaOperacion.value}:00`
                : horaOperacion.value,
            numeroOperacion: numeroOperacion.value.trim()
        };

        botonRegistrar.disabled = true;
        botonRegistrar.innerHTML = `
            <span class="spinner-border spinner-border-sm me-1"></span>
            Registrando...
        `;

        try {
            const respuesta = await fetchAutenticado(
                `${API_PAGO_TOTAL}/pago/registrar/${idSolicitud}`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify(request)
                }
            );

            const resultado = await leerRespuesta(respuesta);

            if (!respuesta.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            registroExitoso = true;

            mostrarMensaje(resultado.message, "success");

            deshabilitarFormulario();

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarMisSolicitudes.html";
            }, 2500);

        } catch (error) {
            mostrarMensaje(
                error.message || "No se pudo registrar el pago total.",
                "danger"
            );
        } finally {
            if (!registroExitoso) {
                botonRegistrar.innerHTML = "Registrar pago";
                actualizarEstadoFormulario();
            }
        }
    });

    async function cargarInformacion() {
        try {
            const [respuestaAsignacion, respuestaAsignacionInicial, respuestaMedios] = await Promise.all([
                fetchAutenticado(`${API_ASIGNACION}/buscar/${idSolicitud}`),
                fetchAutenticado(`${API_ASIGNACION_INICIAL}/buscar/${idSolicitud}`),
                fetchAutenticado(`${API_MEDIO_PAGO}/listar`)
            ]);

            const [asignacion, asignacionInicial, medios] = await Promise.all([
                leerRespuesta(respuestaAsignacion),
                leerRespuesta(respuestaAsignacionInicial),
                leerRespuesta(respuestaMedios)
            ]);

            if (!respuestaAsignacion.ok || !asignacion.success) {
                mostrarMensaje(asignacion.message, "danger");
                deshabilitarFormulario();
                return;
            }

            if (!respuestaAsignacionInicial.ok || !asignacionInicial.success) {
                mostrarMensaje(asignacionInicial.message, "danger");
                deshabilitarFormulario();
                return;
            }

            if (!respuestaMedios.ok || !medios.success) {
                mostrarMensaje(medios.message, "danger");
                deshabilitarFormulario();
                return;
            }
            const montoTotal = Number(asignacion.data.montoAsignadoTotal);
            const montoPendiente = Number(asignacion.data.montoPorCobrar);
            const montoInicial = Number(asignacionInicial.data.montoAsignadoInicial);

            if (
                !Number.isFinite(montoTotal) ||
                !Number.isFinite(montoPendiente) ||
                !Number.isFinite(montoInicial) ||
                montoTotal < 0 ||
                montoPendiente < 0 ||
                montoInicial < 0 ||
                montoPendiente > montoTotal
            ) {
                throw new Error("La asignación total contiene montos inválidos.");
            }

            montoTotalAsignado.textContent = formatearMonto(montoTotal);
            pagoInicial.textContent = formatearMonto(montoInicial);
            montoAsignado.textContent = formatearMonto(montoPendiente);
            razon.value = asignacion.data.razon || "";

            cargarMediosPago(medios.data || []);

        } catch (error) {
            mostrarMensaje(
                error.message || "No se pudo cargar la información del pago total.",
                "danger"
            );
            deshabilitarFormulario();
        }
    }

    function formatearMonto(valor) {
        return `S/ ${valor.toFixed(2)}`;
    }

    function cargarMediosPago(medios) {
        medioPago.innerHTML = `
            <option value="">Selecciona un medio de pago</option>
        `;

        numeroCuenta.value = "";

        medios.forEach(medio => {
            const opcion = document.createElement("option");

            opcion.value = medio.idMedioPago;
            opcion.textContent = medio.nombre;
            opcion.dataset.numeroCuenta = medio.numeroCuenta || "";

            medioPago.appendChild(opcion);
        });

        actualizarEstadoFormulario();
    }

    async function leerRespuesta(respuesta) {
        try {
            return await respuesta.json();
        } catch {
            return {};
        }
    }

    function validarFormulario() {
        if (!medioPago.value) {
            return {
                success: false,
                message: "Selecciona un medio de pago.",
                campo: "medio-pago"
            };
        }

        if (!monto.value || Number(monto.value) <= 0) {
            return {
                success: false,
                message: "El monto pagado debe ser mayor a cero.",
                campo: "monto"
            };
        }

        if (!fechaOperacion.value) {
            return {
                success: false,
                message: "La fecha de operación es obligatoria.",
                campo: "fecha-operacion"
            };
        }

        if (!horaOperacion.value) {
            return {
                success: false,
                message: "La hora de operación es obligatoria.",
                campo: "hora-operacion"
            };
        }

        if (!numeroOperacion.value.trim()) {
            return {
                success: false,
                message: "El número de operación es obligatorio.",
                campo: "numero-operacion"
            };
        }

        return { success: true };
    }

    function mostrarMensaje(mensaje, tipo) {
        if (!mensaje) {
            return;
        }

        mensajeContainer.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
        mensajeContainer.scrollIntoView({ behavior: "smooth", block: "center" });
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

    function actualizarEstadoFormulario() {
        const medioValido = medioPago.value !== "";

        const camposPago = [
            monto,
            fechaOperacion,
            horaOperacion,
            numeroOperacion
        ];

        camposPago.forEach(campo => {
            campo.disabled = !medioValido;
        });

        botonRegistrar.disabled = !medioValido;

        if (!medioValido) {
            numeroCuenta.value = "";
        }
    }

    function deshabilitarFormulario() {
        formulario.querySelectorAll("input, select, button").forEach(elemento => {
            elemento.disabled = true;
        });
    }

});
