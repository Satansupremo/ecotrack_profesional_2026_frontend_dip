
document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) return;

    const API_SOLICITUD = "http://localhost:8080/api/solicitud/pago-total";
    const API_PROGRAMACION = "http://localhost:8080/api/programacion";

    const parametros = new URLSearchParams(window.location.search);

    const idSolicitud = parametros.get("id");

    const campoFecha = document.getElementById("fecha-ejecucion");
    const botonComprobar = document.getElementById("comprobar-fecha");
    const botonProgramar = document.getElementById("programar-recojo");
    const botonCancelar = document.getElementById("cancelar");

    const tablaProgramaciones = document.getElementById("tabla-programaciones");
    const paginacionContainer = document.getElementById("paginacion-container");

    let paginaActual = Number(parametros.get("pagina")) || 0;
    let totalPaginas = 0;
    let solicitudCargada = false;
    let fechaConsultada = null;

    botonProgramar.disabled = true;

    // VALIDAR ID DE SOLICITUD

    if (!idSolicitud || !/^\d+$/.test(idSolicitud) || Number(idSolicitud) <= 0) {
        mostrarMensaje("El código de solicitud no es válido.", "danger");
        botonComprobar.disabled = true;
        return;
    }

    // CANCELAR

    botonCancelar.addEventListener("click", () => {
        window.location.href = "/pages/solicitud/gestionarSolicitudesPagoTotal.html";
    });

    // CARGAR SOLICITUD

    cargarSolicitud();

    async function cargarSolicitud() {

        try {

            const respuesta = await fetchAutenticado(
                `${API_SOLICITUD}/buscar/${idSolicitud}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo obtener la solicitud."
                );
            }

            mostrarSolicitud(resultado.data);

            solicitudCargada = true;
            botonProgramar.disabled = false;

            // RECUPERAR FECHA Y PÁGINA SI SE REGRESA DESDE EL DETALLE

            const fechaGuardada = parametros.get("fecha");

            if (fechaGuardada && validarFecha(fechaGuardada)) {

                campoFecha.value = fechaGuardada;

                await comprobarFecha(paginaActual);

            }

        } catch (error) {

            mostrarMensaje(error.message, "danger");
            botonProgramar.disabled = true;

        }

    }

    function mostrarSolicitud(solicitud) {

        document.getElementById("id-solicitud").textContent =
            solicitud.idSolicitud ?? "-";

        document.getElementById("titulo-solicitud").textContent =
            solicitud.titulo ?? "-";

        document.getElementById("descripcion-solicitud").textContent =
            solicitud.descripcion ?? "-";

        document.getElementById("cantidad-unidades").textContent =
            solicitud.cantidadUnidades ?? "-";

        document.getElementById("razon-cantidad-unidades").textContent =
            solicitud.razonCantidadUnidades || "-";

        document.getElementById("ubicacion-solicitud").textContent =
            solicitud.ubicacion ?? "-";

        document.getElementById("fecha-solicitud").textContent =
            formatearFecha(solicitud.fechaRegistro);

        const estadoSolicitud = document.getElementById("estado-solicitud");
        estadoSolicitud.textContent = formatearEstado(solicitud.estado);
        estadoSolicitud.className = "badge estado-badge";
        estadoSolicitud.dataset.estado = solicitud.estado || "";

    }

    // COMPROBAR FECHA

    botonComprobar.addEventListener("click", () => {
        comprobarFecha(0);
    });

    async function comprobarFecha(pagina) {

        const fecha = campoFecha.value;

        if (!fecha) {
            mostrarMensaje("Selecciona una fecha de ejecución.", "warning");
            return;
        }

        if (!validarFecha(fecha)) {
            mostrarMensaje("La fecha debe tener un año de cuatro dígitos.", "warning");
            return;
        }

        fechaConsultada = fecha;
        paginaActual = pagina;

        botonComprobar.disabled = true;

        tablaProgramaciones.innerHTML = `
            <tr>
                <td colspan="3" class="text-center py-4">
                    <div class="spinner-border spinner-border-sm text-danger"></div>
                    <span class="ms-2">Consultando programaciones...</span>
                </td>
            </tr>
        `;

        try {

            const parametrosFecha = `fecha=${encodeURIComponent(fecha)}`;

            const respuestaTotal = await fetchAutenticado(
                `${API_PROGRAMACION}/fecha/total?${parametrosFecha}`
            );

            const resultadoTotal = await respuestaTotal.json();

            if (!respuestaTotal.ok || !resultadoTotal.success) {
                throw new Error(
                    resultadoTotal.message || "No se pudo consultar el total de programaciones."
                );
            }

            const respuestaPaginas = await fetchAutenticado(
                `${API_PROGRAMACION}/fecha/paginas?${parametrosFecha}`
            );

            const resultadoPaginas = await respuestaPaginas.json();

            if (!respuestaPaginas.ok || !resultadoPaginas.success) {
                throw new Error(
                    resultadoPaginas.message || "No se pudo consultar la paginación."
                );
            }

            totalPaginas = resultadoPaginas.data;

            if (totalPaginas === 0) {

                tablaProgramaciones.innerHTML = `
                    <tr>
                        <td colspan="3" class="text-center text-muted py-4">
                            No hay programaciones para esta fecha.
                        </td>
                    </tr>
                `;

                paginacionContainer.innerHTML = "";

                actualizarParametrosURL();

                return;
            }

            if (paginaActual >= totalPaginas) {
                paginaActual = totalPaginas - 1;
            }

            await listarProgramaciones(fecha, paginaActual);

            actualizarParametrosURL();

        } catch (error) {

            tablaProgramaciones.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-danger py-4">
                        ${escaparHTML(error.message)}
                    </td>
                </tr>
            `;

            paginacionContainer.innerHTML = "";

            mostrarMensaje(error.message, "danger");

        } finally {

            botonComprobar.disabled = false;

        }

    }

    // LISTAR PROGRAMACIONES

    async function listarProgramaciones(fecha, pagina) {

        const respuesta = await fetchAutenticado(
            `${API_PROGRAMACION}/fecha/listar?fecha=${encodeURIComponent(fecha)}&pagina=${pagina}`
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(
                resultado.message || "No se pudieron listar las programaciones."
            );
        }

        mostrarProgramaciones(resultado.data);

        mostrarPaginacion();

    }

    function mostrarProgramaciones(programaciones) {

        if (!programaciones || programaciones.length === 0) {

            tablaProgramaciones.innerHTML = `
                <tr>
                    <td colspan="3" class="text-center text-muted py-4">
                        No hay programaciones para esta fecha.
                    </td>
                </tr>
            `;

            return;
        }

        tablaProgramaciones.innerHTML = "";

        programaciones.forEach(programacion => {

            const fila = document.createElement("tr");

            fila.innerHTML = `
                <td class="fw-semibold">
                    ${escaparHTML(programacion.idProgramacion)}
                </td>

                <td>
                    ${escaparHTML(formatearFecha(programacion.fechaEjecucion))}
                </td>

                <td class="text-center">
                    <button
                        type="button"
                        class="btn btn-sm btn-primary btn-accion-consultar"
                        data-id="${escaparHTML(programacion.idProgramacion)}"
                    >
                        <i class="bi bi-eye me-1"></i>
                        Ver programación
                    </button>
                </td>
            `;

            fila.querySelector("button").addEventListener("click", () => {

                const idProgramacion = programacion.idProgramacion;

                const url = new URLSearchParams({
                    id: idProgramacion,
                    solicitud: idSolicitud,
                    fecha: fechaConsultada,
                    pagina: paginaActual
                });

                window.location.href =
                    `/pages/programacion/verProgramacion.html?${url.toString()}`;

            });

            tablaProgramaciones.appendChild(fila);

        });

    }

    // PAGINACIÓN

    function mostrarPaginacion() {

        paginacionContainer.innerHTML = "";

        if (totalPaginas <= 1) return;

        const contenedor = document.createElement("div");
        contenedor.className = "btn-group";

        const botonAnterior = document.createElement("button");
        botonAnterior.type = "button";
        botonAnterior.className = "btn btn-outline-danger";
        botonAnterior.textContent = "Anterior";
        botonAnterior.disabled = paginaActual === 0;

        botonAnterior.addEventListener("click", () => {
            comprobarFecha(paginaActual - 1);
        });

        const indicador = document.createElement("span");
        indicador.className = "btn btn-outline-secondary disabled";
        indicador.textContent = `${paginaActual + 1} / ${totalPaginas}`;

        const botonSiguiente = document.createElement("button");
        botonSiguiente.type = "button";
        botonSiguiente.className = "btn btn-outline-danger";
        botonSiguiente.textContent = "Siguiente";
        botonSiguiente.disabled = paginaActual >= totalPaginas - 1;

        botonSiguiente.addEventListener("click", () => {
            comprobarFecha(paginaActual + 1);
        });

        contenedor.append(
            botonAnterior,
            indicador,
            botonSiguiente
        );

        paginacionContainer.appendChild(contenedor);

    }

    // REGISTRAR PROGRAMACIÓN

    botonProgramar.addEventListener("click", async () => {

        if (!solicitudCargada) {
            mostrarMensaje("No se ha podido cargar la solicitud.", "danger");
            return;
        }

        const fecha = campoFecha.value;

        if (!fecha) {
            mostrarMensaje("Selecciona una fecha de ejecución.", "warning");
            return;
        }

        if (!validarFecha(fecha)) {
            mostrarMensaje("La fecha debe tener un año de cuatro dígitos.", "warning");
            return;
        }

        botonProgramar.disabled = true;

        try {

            const respuesta = await fetchAutenticado(
                `${API_PROGRAMACION}/registrar`,
                {
                    method: "POST",
                    headers: {
                        "Content-Type": "application/json"
                    },
                    body: JSON.stringify({
                        idSolicitud: Number(idSolicitud),
                        fechaEjecucion: fecha
                    })
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo registrar la programación."
                );
            }

            mostrarMensaje(
                "La programación se registró correctamente. Código de programación: " +
                resultado.data,
                "success"
            );

            botonProgramar.disabled = true;

            setTimeout(() => {
                window.location.href = "/pages/solicitud/gestionarSolicitudesPagoTotal.html";
            }, 2500);

        } catch (error) {

            mostrarMensaje(error.message, "danger");
            botonProgramar.disabled = false;

        }

    });

    // ACTUALIZAR PARÁMETROS DE LA URL

    function actualizarParametrosURL() {

        const url = new URL(window.location.href);

        url.searchParams.set("id", idSolicitud);

        if (fechaConsultada) {
            url.searchParams.set("fecha", fechaConsultada);
            url.searchParams.set("pagina", paginaActual);
        }

        window.history.replaceState({}, "", url);

    }

    // VALIDACIONES Y UTILIDADES

    function validarFecha(fecha) {

        if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
            return false;
        }

        const [anio, mes, dia] = fecha.split("-").map(Number);

        const fechaValidada = new Date(anio, mes - 1, dia);

        return fechaValidada.getFullYear() === anio &&
            fechaValidada.getMonth() === mes - 1 &&
            fechaValidada.getDate() === dia;

    }

    function formatearFecha(fecha) {

        if (!fecha) return "-";

        const partes = fecha.split("T")[0].split("-");

        if (partes.length !== 3) return fecha;

        return `${partes[2]}/${partes[1]}/${partes[0]}`;

    }

    function formatearEstado(estado) {

        if (!estado) return "-";

        return estado.replaceAll("_", " ");

    }

    function escaparHTML(valor) {

        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";

        return elemento.innerHTML;

    }

    function mostrarMensaje(mensaje, tipo) {

        const contenedor = document.getElementById("mensaje-container");

        contenedor.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                    aria-label="Cerrar"
                ></button>
            </div>
        `;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

});
