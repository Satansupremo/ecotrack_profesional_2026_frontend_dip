
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["JEFE_UNIDAD", "ADMINISTRADOR"])) {
        return;
    }

    const API_URL = "http://localhost:8080/api/reserva-unidad";

    const parametros = new URLSearchParams(window.location.search);
    const idProgramacion = parametros.get("id");

    const mensajeContainer = document.getElementById("mensaje-container");
    const tabla = document.getElementById("tabla-reservas");
    const totalReservas = document.getElementById("total-reservas");

    const tipoVehiculo = document.getElementById("tipo-vehiculo");

    const btnReservar = document.getElementById("btn-reservar");
    const btnActualizar = document.getElementById("btn-actualizar");
    const btnConfirmar = document.getElementById("btn-confirmar");
    const btnCancelar = document.getElementById("btn-cancelar");

    let reservasActuales = [];
    let temporizador = null;

    if (!idProgramacion || !/^\d+$/.test(idProgramacion)) {

        mostrarMensaje("No se ha especificado una programación válida.", "danger");

        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    No se pudo identificar la programación.
                </td>
            </tr>
        `;

        deshabilitarAcciones(true);

        return;
    }

    document.getElementById("id-programacion").textContent =
        `#${idProgramacion}`;

    btnReservar.addEventListener("click", reservarUnidad);
    btnActualizar.addEventListener("click", cargarReservas);
    btnConfirmar.addEventListener("click", confirmarUnidades);
    btnCancelar.addEventListener("click", cancelarReservas);

    tabla.addEventListener("click", async event => {

        const boton = event.target.closest("[data-accion='liberar']");

        if (!boton || boton.disabled) {
            return;
        }

        const idReserva = boton.dataset.id;

        if (!idReserva) {
            return;
        }

        await liberarReserva(idReserva);
    });

    await cargarReservas();

    async function reservarUnidad() {

        const tipo = tipoVehiculo.value;

        if (!tipo) {
            mostrarMensaje("Selecciona un tipo de vehículo.", "warning");
            return;
        }

        try {

            bloquearBotones(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/reservar?tipo=${encodeURIComponent(tipo)}`,
                {
                    method: "POST"
                }
            );

            const resultado = await leerRespuesta(
                respuesta,
                "Reserva de emergencia"
            );

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo reservar la unidad."
                );
            }

            tipoVehiculo.value = "";

            mostrarMensaje(
                resultado.message || "La unidad fue reservada correctamente.",
                "success"
            );

            await cargarReservas();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            bloquearBotones(false);

        }
    }

    async function cargarReservas() {

        try {

            mensajeContainer.innerHTML = "";

            btnActualizar.disabled = true;

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}`
            );

            const resultado = await leerRespuesta(
                respuesta,
                "Listado de reservas"
            );

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudieron cargar las reservas."
                );
            }

            reservasActuales = resultado.data || [];

            renderizarReservas();

        } catch (error) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger py-4">
                        No se pudieron cargar las reservas.
                    </td>
                </tr>
            `;

            totalReservas.textContent = "0";

            actualizarBotones();

            mostrarMensaje(error.message, "danger");

        } finally {

            btnActualizar.disabled = false;

        }
    }

    function renderizarReservas() {

        tabla.innerHTML = "";

        if (temporizador) {
            clearInterval(temporizador);
            temporizador = null;
        }

        if (reservasActuales.length === 0) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">

                        <i class="bi bi-inbox display-5 text-secondary"></i>

                        <p class="text-secondary mt-3 mb-0">
                            No tienes reservas de emergencia para esta programación.
                        </p>

                    </td>
                </tr>
            `;

            totalReservas.textContent = "0";

            actualizarBotones();

            return;
        }

        reservasActuales.forEach(reserva => {

            const fila = document.createElement("tr");

            const nombreTransportista = [
                reserva.nombreTransportista,
                reserva.apellidoTransportista
            ].filter(Boolean).join(" ");

            fila.innerHTML = `
                <td class="fw-semibold">
                    #${escaparHTML(reserva.idReserva)}
                </td>

                <td>
                    ${escaparHTML(nombreTransportista || "-")}
                </td>

                <td>
                    ${escaparHTML(reserva.celular || "-")}
                </td>

                <td>
                    ${escaparHTML(
                        `${reserva.marca || ""} ${reserva.modelo || ""}`.trim() || "-"
                    )}
                    <div class="small text-secondary">
                        ${escaparHTML(reserva.tipoVehiculo || "-")}
                    </div>
                </td>

                <td class="fw-semibold">
                    ${escaparHTML(reserva.placa || "-")}
                </td>

                <td>
                    ${formatearNumero(reserva.capacidadLibras)}
                </td>

                <td>
                    <span class="badge text-bg-warning"
                        data-expiracion="${escaparHTML(reserva.fechaExpiracion)}">
                        Calculando...
                    </span>
                </td>

                <td class="text-center">

                    <button type="button"
                        class="btn btn-outline-danger btn-sm"
                        data-accion="liberar"
                        data-id="${escaparHTML(reserva.idReserva)}">

                        <i class="bi bi-trash me-1"></i>
                        Liberar

                    </button>

                </td>
            `;

            tabla.appendChild(fila);

        });

        totalReservas.textContent = reservasActuales.length;

        actualizarExpiraciones();

        temporizador = setInterval(
            actualizarExpiraciones,
            1000
        );

        actualizarBotones();
    }

    function actualizarExpiraciones() {

        const ahora = Date.now();

        document.querySelectorAll("[data-expiracion]").forEach(elemento => {

            const fecha = elemento.dataset.expiracion;
            const expiracion = new Date(fecha).getTime();

            if (!Number.isFinite(expiracion)) {

                elemento.textContent = "Fecha inválida";
                elemento.className = "badge text-bg-secondary";

                return;
            }

            const diferencia = expiracion - ahora;

            if (diferencia <= 0) {

                elemento.textContent = "Expirada";
                elemento.className = "badge text-bg-danger";

                return;
            }

            const segundos = Math.floor(diferencia / 1000);

            const minutosRestantes = Math.floor(segundos / 60);
            const segundosRestantes = segundos % 60;

            elemento.textContent =
                `${String(minutosRestantes).padStart(2, "0")}:${String(segundosRestantes).padStart(2, "0")}`;

            elemento.className = "badge text-bg-warning";
        });
    }

    async function liberarReserva(idReserva) {

        if (!confirm("¿Deseas liberar esta reserva de emergencia?")) {
            return;
        }

        try {

            bloquearBotones(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/${idReserva}`,
                {
                    method: "DELETE"
                }
            );

            const resultado = await leerRespuesta(
                respuesta,
                "Liberación de reserva"
            );

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo liberar la reserva."
                );
            }

            mostrarMensaje(
                resultado.message || "La reserva fue liberada correctamente.",
                "success"
            );

            await cargarReservas();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            bloquearBotones(false);

        }
    }

    async function confirmarUnidades() {

        if (reservasActuales.length === 0) {

            mostrarMensaje(
                "No tienes reservas para confirmar.",
                "warning"
            );

            return;
        }

        if (!confirm(
            "¿Deseas confirmar tus unidades reservadas e incorporarlas a la programación?"
        )) {
            return;
        }

        try {

            bloquearBotones(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/confirmar`,
                {
                    method: "POST"
                }
            );

            const resultado = await leerRespuesta(
                respuesta,
                "Confirmación de unidades"
            );

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudieron confirmar las unidades."
                );
            }

            mostrarMensaje(
                resultado.message || "Las unidades fueron confirmadas correctamente.",
                "success"
            );

            await cargarReservas();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            bloquearBotones(false);

        }
    }

    async function cancelarReservas() {

        if (reservasActuales.length === 0) {

            mostrarMensaje(
                "No tienes reservas pendientes para cancelar.",
                "warning"
            );

            return;
        }

        if (!confirm(
            "¿Deseas cancelar todas tus reservas de emergencia para esta programación?"
        )) {
            return;
        }

        try {

            bloquearBotones(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/cancelar`,
                {
                    method: "DELETE"
                }
            );

            const resultado = await leerRespuesta(
                respuesta,
                "Cancelación de reservas"
            );

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudieron cancelar las reservas."
                );
            }

            mostrarMensaje(
                resultado.message || "Las reservas fueron canceladas correctamente.",
                "success"
            );

            await cargarReservas();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            bloquearBotones(false);

        }
    }

    function actualizarBotones() {

        const tieneReservas = reservasActuales.length > 0;

        btnConfirmar.disabled = !tieneReservas;
        btnCancelar.disabled = !tieneReservas;
    }

    function bloquearBotones(bloquear) {

        btnReservar.disabled = bloquear;
        btnActualizar.disabled = bloquear;
        btnConfirmar.disabled = bloquear || reservasActuales.length === 0;
        btnCancelar.disabled = bloquear || reservasActuales.length === 0;

        tabla.querySelectorAll("[data-accion='liberar']").forEach(boton => {
            boton.disabled = bloquear;
        });
    }

    function deshabilitarAcciones(deshabilitar) {

        btnReservar.disabled = deshabilitar;
        btnActualizar.disabled = deshabilitar;
        btnConfirmar.disabled = deshabilitar;
        btnCancelar.disabled = deshabilitar;
        tipoVehiculo.disabled = deshabilitar;
    }

    function formatearNumero(valor) {

        if (valor === null || valor === undefined) {
            return "-";
        }

        return Number(valor).toLocaleString("es-PE");
    }

    async function leerRespuesta(respuesta, nombre) {

        const contenido = await respuesta.text();

        try {

            return JSON.parse(contenido);

        } catch (error) {

            throw new Error(
                `${nombre} no devolvió una respuesta JSON válida.`
            );
        }
    }

    function mostrarMensaje(mensaje, tipo) {

        mensajeContainer.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">

                ${escaparHTML(mensaje)}

                <button type="button"
                    class="btn-close"
                    data-bs-dismiss="alert">
                </button>

            </div>
        `;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });
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
