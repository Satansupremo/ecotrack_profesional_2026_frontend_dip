
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["JEFE_UNIDAD", "ADMINISTRADOR"])) {
        return;
    }

    const API_URL = "http://localhost:8080/api/programacion/mis-programaciones";

    const parametros = new URLSearchParams(window.location.search);
    const idProgramacion = parametros.get("id");

    const mensajeContainer = document.getElementById("mensaje-container");
    const informacionProgramacion = document.getElementById("informacion-programacion");
    const contenedorTiposVehiculo = document.getElementById("contenedor-tipos-vehiculo");
    const tablaUnidades = document.getElementById("tabla-unidades");
    const totalUnidades = document.getElementById("total-unidades");

    const botonCancelar = document.getElementById("cancelar");
    const botonEjecutar = document.getElementById("ejecutar-programacion");

    const tiposVehiculo = [
        { valor: "VOLQUETE", nombre: "Volquete", icono: "bi-truck" },
        { valor: "EXCAVADORA", nombre: "Excavadora", icono: "bi-cone-striped" },
        { valor: "RETROEXCAVADORA", nombre: "Retroexcavadora", icono: "bi-truck-front" },
        { valor: "CARGADOR_FRONTAL", nombre: "Cargador frontal", icono: "bi-truck" },
        { valor: "TRACTOR_DE_ORUGAS", nombre: "Tractor de orugas", icono: "bi-gear-wide-connected" }
    ];

    let programacion = null;
    let unidades = [];
    let procesando = false;

    if (!idProgramacion || !/^\d+$/.test(idProgramacion) || Number(idProgramacion) <= 0) {

        mostrarMensaje("No se proporcionó un código de programación válido.", "danger");

        informacionProgramacion.innerHTML = `
            <p class="text-danger mb-0">
                No se pudo identificar la programación.
            </p>
        `;

        contenedorTiposVehiculo.innerHTML = "";
        tablaUnidades.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-secondary py-4">
                    No se puede consultar la programación.
                </td>
            </tr>
        `;

        return;
    }

    botonCancelar.addEventListener("click", () => {
        window.location.href = "/pages/programacion/gestionarMisProgramaciones.html";
    });

    contenedorTiposVehiculo.addEventListener("click", async event => {

        const boton = event.target.closest("[data-tipo]");

        if (!boton || boton.disabled || procesando) {
            return;
        }

        await agregarUnidad(boton.dataset.tipo);
    });

    tablaUnidades.addEventListener("click", async event => {

        const boton = event.target.closest("[data-eliminar]");

        if (!boton || boton.disabled || procesando) {
            return;
        }

        const idDetalle = boton.dataset.eliminar;

        if (!confirm("¿Estás seguro de retirar esta unidad de la programación?")) {
            return;
        }

        await eliminarUnidad(idDetalle);
    });

    botonEjecutar.addEventListener("click", async () => {

        if (procesando || unidades.length === 0) {
            return;
        }

        if (!confirm("¿Deseas ejecutar esta programación? Esta acción cambiará su estado.")) {
            return;
        }

        await ejecutarProgramacion();
    });

    await cargarInformacion();

    async function cargarInformacion() {

        try {

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/detalle`
            );

            const resultado = await leerRespuesta(respuesta, "Información de programación");

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudo consultar la programación.");
            }

            programacion = resultado.data;

            if (programacion.estado !== "ASIGNADO") {
                throw new Error("Esta programación ya no se encuentra disponible para su ejecución.");
            }

            renderizarInformacionProgramacion();

            await Promise.all([
                cargarUnidades(),
                renderizarTiposVehiculo()
            ]);

        } catch (error) {

            informacionProgramacion.innerHTML = `
                <p class="text-danger mb-0">
                    ${escaparHTML(error.message)}
                </p>
            `;

            contenedorTiposVehiculo.innerHTML = "";

            tablaUnidades.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-secondary py-4">
                        No se pudieron consultar las unidades.
                    </td>
                </tr>
            `;

            mostrarMensaje(error.message, "danger");
            botonEjecutar.disabled = true;

        }
    }

    function renderizarInformacionProgramacion() {

        informacionProgramacion.innerHTML = `
            <div class="row g-3">

                <div class="col-md-3">
                    <span class="text-secondary small d-block">Código de programación</span>
                    <span class="fw-semibold">#${programacion.idProgramacion}</span>
                </div>

                <div class="col-md-3">
                    <span class="text-secondary small d-block">Código de solicitud</span>
                    <span class="fw-semibold">#${programacion.idSolicitud}</span>
                </div>

                <div class="col-md-3">
                    <span class="text-secondary small d-block">Fecha de ejecución</span>
                    <span class="fw-semibold">${formatearFecha(programacion.fechaEjecucion)}</span>
                </div>

                <div class="col-md-3">
                    <span class="text-secondary small d-block">Estado</span>
                    <span class="badge text-bg-primary">
                        ${escaparHTML(programacion.estado)}
                    </span>
                </div>

                <div class="col-12">
                    <hr>
                    <span class="text-secondary small d-block">Título de la solicitud</span>
                    <span class="fw-semibold">${escaparHTML(programacion.tituloSolicitud)}</span>
                </div>

                <div class="col-md-6">
                    <span class="text-secondary small d-block">Ubicación</span>
                    <span>${escaparHTML(programacion.ubicacionSolicitud)}</span>
                </div>

                <div class="col-md-6">
                    <span class="text-secondary small d-block">Jefe de unidad</span>
                    <span>${escaparHTML([
            programacion.nombreJefeUnidad,
            programacion.apellidoJefeUnidad
        ].filter(Boolean).join(" ") || "-")}</span>
                </div>

                <div class="col-12">
                    <span class="text-secondary small d-block">Descripción</span>
                    <p class="mb-0">${escaparHTML(programacion.descripcionSolicitud)}</p>
                </div>

                <div class="col-md-6">
                    <span class="text-secondary small d-block">Cantidad de unidades recomendadas</span>
                    <span class="fw-semibold">${programacion.cantidadUnidades ?? 0}</span>
                </div>

                <div class="col-md-6">
                    <span class="text-secondary small d-block">Razón de la cantidad recomendada</span>
                    <span>${escaparHTML(programacion.razonCantidadUnidades || "-")}</span>
                </div>

                <div class="col-12">
                    <span class="text-secondary small d-block">Equipo de seguridad</span>
                    <p class="mb-0">${escaparHTML(programacion.equipoSeguridad || "-")}</p>
                </div>

                <div class="col-12">
                    <span class="text-secondary small d-block">Otras recomendaciones</span>
                    <p class="mb-0">${escaparHTML(programacion.otrasRecomendaciones || "-")}</p>
                </div>

            </div>
        `;
    }

    async function cargarUnidades() {

        try {

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/unidades`
            );

            const resultado = await leerRespuesta(respuesta, "Unidades de programación");

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudieron cargar las unidades.");
            }

            unidades = resultado.data || [];

            renderizarUnidades();

        } catch (error) {

            tablaUnidades.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center text-danger py-4">
                        ${escaparHTML(error.message)}
                    </td>
                </tr>
            `;

            botonEjecutar.disabled = true;

            throw error;
        }
    }

    function renderizarTiposVehiculo() {

        contenedorTiposVehiculo.innerHTML = tiposVehiculo.map(tipo => `
            <div class="col-12 col-sm-6 col-lg-4">

                <div class="card h-100 border rounded-3">
                    <div class="card-body text-center">

                        <i class="bi ${tipo.icono} display-5 text-danger"></i>

                        <h3 class="h6 fw-bold mt-3 mb-3">
                            ${tipo.nombre}
                        </h3>

                        <button type="button"
                            class="btn btn-outline-danger btn-sm w-100"
                            data-tipo="${tipo.valor}">

                            <i class="bi bi-plus-circle me-1"></i>
                            Agregar unidad

                        </button>

                    </div>
                </div>

            </div>
        `).join("");
    }

    function renderizarUnidades() {

        totalUnidades.textContent = unidades.length;

        if (unidades.length === 0) {

            tablaUnidades.innerHTML = `
                <tr>
                    <td colspan="7" class="text-center py-5">

                        <i class="bi bi-truck display-5 text-secondary"></i>

                        <p class="text-secondary mt-3 mb-0">
                            Todavía no hay unidades asignadas.
                        </p>

                    </td>
                </tr>
            `;

        } else {

            tablaUnidades.innerHTML = unidades.map(unidad => {

                const nombreTransportista = [
                    unidad.nombreTransportista,
                    unidad.apellidoTransportista
                ].filter(Boolean).join(" ");

                return `
                    <tr>

                        <td class="fw-semibold">
                            ${escaparHTML(formatearTipoVehiculo(unidad.tipoVehiculo))}
                        </td>

                        <td>${escaparHTML(unidad.placa)}</td>

                        <td>${escaparHTML(unidad.marca)}</td>

                        <td>${escaparHTML(unidad.modelo)}</td>

                        <td>${escaparHTML(unidad.capacidadLibras)}</td>

                        <td>${escaparHTML(nombreTransportista || "-")}</td>

                        <td class="text-center">
                            <button type="button"
                                class="btn btn-outline-danger btn-sm"
                                data-eliminar="${unidad.idDetalle}">

                                <i class="bi bi-trash me-1"></i>
                                Retirar

                            </button>
                        </td>

                    </tr>
                `;
            }).join("");
        }

        botonEjecutar.disabled = unidades.length === 0 || procesando;
    }

    async function agregarUnidad(tipo) {

        try {

            establecerProcesando(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/unidades?tipo=${encodeURIComponent(tipo)}`,
                {
                    method: "POST"
                }
            );

            const resultado = await leerRespuesta(respuesta, "Agregar unidad");

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudo agregar la unidad.");
            }

            mostrarMensaje(
                `Se agregó correctamente la unidad ${formatearTipoVehiculo(tipo)}.`,
                "success"
            );

            await cargarUnidades();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            establecerProcesando(false);

        }
    }

    async function eliminarUnidad(idDetalle) {

        try {

            establecerProcesando(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/unidades/${idDetalle}`,
                {
                    method: "DELETE"
                }
            );

            const resultado = await leerRespuesta(respuesta, "Retirar unidad");

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudo retirar la unidad.");
            }

            mostrarMensaje("La unidad fue retirada correctamente.", "success");

            await cargarUnidades();

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        } finally {

            establecerProcesando(false);

        }
    }

    async function ejecutarProgramacion() {

        try {

            establecerProcesando(true);

            const respuesta = await fetchAutenticado(
                `${API_URL}/${idProgramacion}/ejecutar`,
                {
                    method: "PUT"
                }
            );

            const resultado = await leerRespuesta(respuesta, "Ejecutar programación");

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message || "No se pudo ejecutar la programación.");
            }

            mostrarMensaje("La programación se ejecutó correctamente.", "success");

            sessionStorage.setItem("paginaMisProgramaciones",
                sessionStorage.getItem("paginaMisProgramaciones") || "0"
            );

            setTimeout(() => {
                window.location.href = "/pages/programacion/gestionarMisProgramaciones.html";
            }, 1000);

        } catch (error) {

            mostrarMensaje(error.message, "danger");

            establecerProcesando(false);

        }
    }

    function establecerProcesando(estado) {

        procesando = estado;

        contenedorTiposVehiculo.querySelectorAll("[data-tipo]").forEach(boton => {
            boton.disabled = estado;
        });

        tablaUnidades.querySelectorAll("[data-eliminar]").forEach(boton => {
            boton.disabled = estado;
        });

        botonEjecutar.disabled = estado || unidades.length === 0;

        botonCancelar.disabled = estado;
    }

    function formatearTipoVehiculo(tipo) {

        const encontrado = tiposVehiculo.find(item => item.valor === tipo);

        return encontrado ? encontrado.nombre : tipo;
    }

    function formatearFecha(fecha) {

        if (!fecha) {
            return "-";
        }

        const partes = String(fecha).split("-");

        if (partes.length !== 3) {
            return escaparHTML(fecha);
        }

        return `${partes[2]}/${partes[1]}/${partes[0]}`;
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

        mensajeContainer.scrollIntoView({
            behavior: "smooth",
            block: "nearest"
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
