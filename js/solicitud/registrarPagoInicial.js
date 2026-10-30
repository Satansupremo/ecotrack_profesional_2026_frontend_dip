
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_ASIGNACION = "http://localhost:8080/api/asignacion-inicial";
    const API_PAGO_INICIAL = "http://localhost:8080/api/pago-inicial";
    const API_MEDIO_PAGO = "http://localhost:8080/api/medio-pago";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    const codigoSolicitud = document.getElementById("codigo-solicitud");
    const montoAsignado = document.getElementById("monto-asignado");

    const formulario = document.getElementById("formulario-pago");
    const medioPago = document.getElementById("medio-pago");
    const monto = document.getElementById("monto");
    const horaOperacion = document.getElementById("hora-operacion");
    const numeroOperacion = document.getElementById("numero-operacion");

    const numeroCuenta = document.getElementById("numero-cuenta");
    const botonRegistrar = document.getElementById("boton-registrar");
    const mensajeContainer = document.getElementById("mensaje-container");

    let montoInicial = null;

    if (!idSolicitud || !Number.isInteger(Number(idSolicitud)) || Number(idSolicitud) <= 0) {
        mostrarMensaje("No se proporcionó un código de solicitud válido.", "danger");
        formulario.querySelectorAll("input, select, button").forEach(elemento => {
            elemento.disabled = true;
        });
        return;
    }

    codigoSolicitud.textContent = `#${idSolicitud}`;

    medioPago.addEventListener("change", () => {
        const opcionSeleccionada = medioPago.selectedOptions[0];
        const cuenta = opcionSeleccionada?.dataset.numeroCuenta || "";

        numeroCuenta.value = cuenta
            ? cuenta.match(/.{1,4}/g).join(" - ")
            : "";
    });

    await cargarInformacion();

    formulario.addEventListener("submit", async (event) => {
        event.preventDefault();

        if (montoInicial === null) {
            mostrarMensaje("No se pudo obtener el monto asignado.", "danger");
            return;
        }

        const idMedioPago = medioPago.value;
        const hora = horaOperacion.value;
        const numero = numeroOperacion.value.trim();

        if (!idMedioPago || !hora || !numero) {
            mostrarMensaje("Completa todos los campos del formulario.", "warning");
            return;
        }

        const request = {
            idMedioPago: Number(idMedioPago),
            monto: montoInicial,
            horaOperacion: hora,
            numeroOperacion: numero
        };

        try {
            botonRegistrar.disabled = true;
            botonRegistrar.innerHTML = `
                <span class="spinner-border spinner-border-sm me-1"></span>
                Registrando...
            `;

            const respuesta = await fetchAutenticado(
                `${API_PAGO_INICIAL}/pago/registrar/${idSolicitud}`,
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
                throw new Error(resultado.message || "No se pudo registrar el pago inicial.");
            }

            mostrarMensaje(
                resultado.message || "Pago inicial registrado correctamente.",
                "success"
            );

            formulario.querySelectorAll("input, select, button").forEach(elemento => {
                elemento.disabled = true;
            });

            setTimeout(() => {
                window.location.href = "/pages/solicitud/gestionarMisSolicitudes.html";
            }, 2500);

        } catch (error) {
            console.error("Error al registrar el pago inicial:", error);
            mostrarMensaje(error.message, "danger");

            botonRegistrar.disabled = false;
            botonRegistrar.innerHTML = `
                <i class="bi bi-check-circle me-1"></i>
                Registrar pago
            `;
        }
    });

    async function cargarInformacion() {
        try {
            const [respuestaAsignacion, respuestaMedios] = await Promise.all([
                fetchAutenticado(`${API_ASIGNACION}/buscar/${idSolicitud}`),
                fetchAutenticado(`${API_MEDIO_PAGO}/listar`)
            ]);

            console.log("Estado asignación:", respuestaAsignacion.status);
            console.log("Estado medios de pago:", respuestaMedios.status);

            const asignacion = await leerRespuesta(respuestaAsignacion);
            const medios = await leerRespuesta(respuestaMedios);

            console.log("Respuesta asignación:", asignacion);
            console.log("Respuesta medios:", medios);

            if (!respuestaAsignacion.ok || !asignacion.success) {
                throw new Error(
                    asignacion.message || "No se pudo obtener la asignación inicial."
                );
            }

            if (!respuestaMedios.ok || !medios.success) {
                throw new Error(
                    medios.message || "No se pudieron obtener los medios de pago."
                );
            }

            montoInicial = Number(asignacion.data.montoAsignadoInicial);

            if (!Number.isFinite(montoInicial) || montoInicial <= 0) {
                throw new Error("El monto asignado no es válido.");
            }

            montoAsignado.textContent = `S/ ${montoInicial.toFixed(2)}`;

            cargarMediosPago(medios.data || []);

        } catch (error) {
            console.error("Error al cargar información:", error);
            mostrarMensaje(error.message, "danger");

            formulario.querySelectorAll("input, select, button").forEach(elemento => {
                elemento.disabled = true;
            });
        }
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

        if (medios.length === 0) {
            mostrarMensaje("No hay medios de pago disponibles.", "warning");
            botonRegistrar.disabled = true;
        }
    }

    async function leerRespuesta(respuesta) {
        const contenido = await respuesta.text();

        try {
            return JSON.parse(contenido);
        } catch (error) {
            throw new Error(
                "El servidor no devolvió una respuesta JSON válida."
            );
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
