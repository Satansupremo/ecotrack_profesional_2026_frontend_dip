
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["JEFE_UNIDAD", "ADMINISTRADOR"])) {
        return;
    }

    const API_URL = "http://localhost:8080/api/programacion/mis-programaciones";

    const tabla = document.getElementById("tabla-programaciones");
    const totalLabel = document.getElementById("total-programaciones");
    const mensajeContainer = document.getElementById("mensaje-container");
    const informacionPaginacion = document.getElementById("informacion-paginacion");

    const botonAnterior = document.getElementById("pagina-anterior");
    const botonSiguiente = document.getElementById("pagina-siguiente");
    const botonActualizar = document.getElementById("actualizar-listado");

    const CLAVE_PAGINA = "paginaMisProgramaciones";

    let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
    let totalPaginas = 0;

    botonAnterior.addEventListener("click", () => {

        if (paginaActual > 0) {
            paginaActual--;

            sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

            cargarProgramaciones();
        }
    });

    botonSiguiente.addEventListener("click", () => {

        if (paginaActual < totalPaginas - 1) {
            paginaActual++;

            sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

            cargarProgramaciones();
        }
    });

    botonActualizar.addEventListener("click", () => {

        paginaActual = 0;

        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

        cargarProgramaciones();
    });

    tabla.addEventListener("click", event => {

        const boton = event.target.closest("[data-accion]");

        if (!boton) {
            return;
        }

        const idProgramacion = boton.dataset.id;
        const accion = boton.dataset.accion;

        if (boton.disabled || !idProgramacion) {
            return;
        }

        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

        if (accion === "ejecutar") {

            window.location.href =
                `/pages/programacion/ejecutarProgramacion.html?id=${idProgramacion}`;

        } else if (accion === "emergencia") {

            window.location.href =
                `/pages/programacion/agregarUnidadesEmergencia.html?id=${idProgramacion}`;

        } else if (accion === "ver") {

            window.location.href =
                `/pages/programacion/verMiProgramacion.html?id=${idProgramacion}`;
        }
    });

    await cargarProgramaciones();

    async function cargarProgramaciones() {

        try {

            mensajeContainer.innerHTML = "";

            const [respuestaTotal, respuestaPaginas] = await Promise.all([
                fetchAutenticado(`${API_URL}/total`),
                fetchAutenticado(`${API_URL}/paginas`)
            ]);

            const total = await leerRespuesta(
                respuestaTotal,
                "Total de programaciones"
            );

            const paginas = await leerRespuesta(
                respuestaPaginas,
                "Páginas de programaciones"
            );

            if (!respuestaTotal.ok || !total.success) {
                throw new Error(
                    total.message || "No se pudo obtener el total de programaciones."
                );
            }

            if (!respuestaPaginas.ok || !paginas.success) {
                throw new Error(
                    paginas.message || "No se pudieron obtener las páginas."
                );
            }

            totalLabel.textContent = total.data;

            totalPaginas = paginas.data;

            if (totalPaginas === 0) {

                paginaActual = 0;

            } else if (paginaActual >= totalPaginas) {

                paginaActual = totalPaginas - 1;
            }

            sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

            const respuestaLista = await fetchAutenticado(
                `${API_URL}/listar?pagina=${paginaActual}`
            );

            const listado = await leerRespuesta(
                respuestaLista,
                "Listado de programaciones"
            );

            if (!respuestaLista.ok || !listado.success) {
                throw new Error(
                    listado.message || "No se pudieron cargar las programaciones."
                );
            }

            renderizarProgramaciones(listado.data || []);

            actualizarPaginacion();

        } catch (error) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center text-danger py-4">
                        No se pudieron cargar las programaciones.
                    </td>
                </tr>
            `;

            mostrarMensaje(error.message, "danger");

        }
    }

    function renderizarProgramaciones(programaciones) {

        tabla.innerHTML = "";

        if (programaciones.length === 0) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="8" class="text-center py-5">

                        <i class="bi bi-calendar-x display-5 text-secondary"></i>

                        <p class="text-secondary mt-3 mb-0">
                            No tienes programaciones registradas.
                        </p>

                    </td>
                </tr>
            `;

            return;
        }

        programaciones.forEach(programacion => {

            const fila = document.createElement("tr");

            const fechaEjecucion = formatearFecha(
                programacion.fechaEjecucion
            );

            const nombreJefeUnidad = [
                programacion.nombreJefeUnidad,
                programacion.apellidoJefeUnidad
            ].filter(Boolean).join(" ");

            let colorEstado = "text-bg-secondary";
            let accionPrincipal = "";

            if (programacion.estado === "ASIGNADO") {

                colorEstado = "text-bg-primary";

                accionPrincipal = `
                    <button type="button"
                        class="btn btn-success btn-sm"
                        data-accion="ejecutar"
                        data-id="${programacion.idProgramacion}">

                        <i class="bi bi-play-circle me-1"></i>
                        Ejecutar programación

                    </button>
                `;

            } else if (programacion.estado === "EJECUTANDO") {

                colorEstado = "text-bg-warning";

                accionPrincipal = `
                    <button type="button"
                        class="btn btn-outline-primary btn-sm"
                        data-accion="emergencia"
                        data-id="${programacion.idProgramacion}">

                        <i class="bi bi-plus-circle me-1"></i>
                        Añadir unidades de emergencia

                    </button>
                `;

            } else if (programacion.estado === "FINALIZADO") {

                colorEstado = "text-bg-success";

                accionPrincipal = `
                    <span class="text-secondary small">
                        Sin acciones pendientes
                    </span>
                `;
            }

            fila.innerHTML = `
                <td class="fw-semibold">
                    #${programacion.idProgramacion}
                </td>

                <td>
                    #${programacion.idSolicitud}
                </td>

                <td>
                    ${escaparHTML(programacion.tituloSolicitud)}
                </td>

                <td>
                    ${escaparHTML(programacion.ubicacionSolicitud)}
                </td>

                <td>
                    ${escaparHTML(nombreJefeUnidad || "-")}
                </td>

                <td>
                    ${fechaEjecucion}
                </td>

                <td>
                    <span class="badge rounded-pill ${colorEstado}">
                        ${escaparHTML(programacion.estado)}
                    </span>
                </td>

                <td>
                    <div class="d-flex justify-content-center align-items-center flex-wrap gap-2">

                        ${accionPrincipal}

                        <button type="button"
                            class="btn btn-outline-secondary btn-sm"
                            data-accion="ver"
                            data-id="${programacion.idProgramacion}">

                            <i class="bi bi-eye me-1"></i>
                            Ver mi programación

                        </button>

                    </div>
                </td>
            `;

            tabla.appendChild(fila);
        });
    }

    function actualizarPaginacion() {

        informacionPaginacion.textContent =
            `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;

        botonAnterior.parentElement.classList.toggle(
            "disabled",
            paginaActual <= 0
        );

        botonSiguiente.parentElement.classList.toggle(
            "disabled",
            paginaActual >= totalPaginas - 1
        );

        botonAnterior.disabled = paginaActual <= 0;

        botonSiguiente.disabled =
            totalPaginas === 0 || paginaActual >= totalPaginas - 1;
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
