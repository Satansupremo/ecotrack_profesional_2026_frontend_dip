
document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_URL = "http://localhost:8080/api/solicitud";

    const tabla = document.getElementById("tabla-solicitudes");
    const totalLabel = document.getElementById("total-solicitudes");
    const mensajeContainer = document.getElementById("mensaje-container");
    const informacionPaginacion = document.getElementById("informacion-paginacion");

    const botonAnterior = document.getElementById("pagina-anterior");
    const botonSiguiente = document.getElementById("pagina-siguiente");
    const botonActualizar = document.getElementById("actualizar-listado");

    let paginaActual = Number(sessionStorage.getItem("paginaSolicitudesPagoTotal")) || 0;
    let totalPaginas = 0;

    botonAnterior.addEventListener("click", () => {

        if (paginaActual > 0) {
            paginaActual--;
            sessionStorage.setItem("paginaSolicitudesPagoTotal", paginaActual);
            cargarSolicitudes();
        }
    });

    botonSiguiente.addEventListener("click", () => {

        if (paginaActual < totalPaginas - 1) {
            paginaActual++;
            sessionStorage.setItem("paginaSolicitudesPagoTotal", paginaActual);
            cargarSolicitudes();
        }
    });

    botonActualizar.addEventListener("click", () => {

        paginaActual = 0;
        sessionStorage.setItem("paginaSolicitudesPagoTotal", paginaActual);
        cargarSolicitudes();
    });

    tabla.addEventListener("click", event => {

        const boton = event.target.closest("[data-accion]");

        if (!boton) {
            return;
        }

        const idSolicitud = boton.dataset.id;
        const accion = boton.dataset.accion;

        if (boton.disabled || !idSolicitud) {
            return;
        }

        if (accion === "confirmar") {

            window.location.href =
                `/pages/solicitud/confirmarPTE.html?id=${idSolicitud}`;

        } else if (accion === "rechazar") {

            window.location.href =
                `/pages/solicitud/rechazarPTE.html?id=${idSolicitud}`;
        }
    });

    await cargarSolicitudes();

    async function cargarSolicitudes() {

        try {

            mensajeContainer.innerHTML = "";

            const [respuestaTotal, respuestaPaginas, respuestaLista] =
                await Promise.all([
                    fetchAutenticado(`${API_URL}/pago-total/total`),
                    fetchAutenticado(`${API_URL}/pago-total/paginas`),
                    fetchAutenticado(`${API_URL}/pago-total/listar?pagina=${paginaActual}`)
                ]);

            const total = await leerRespuesta(
                respuestaTotal,
                "Total de solicitudes"
            );

            const paginas = await leerRespuesta(
                respuestaPaginas,
                "Páginas de solicitudes"
            );

            const listado = await leerRespuesta(
                respuestaLista,
                "Listado de solicitudes"
            );

            if (!respuestaTotal.ok || !total.success) {
                throw new Error(total.message || "No se pudo obtener el total.");
            }

            if (!respuestaPaginas.ok || !paginas.success) {
                throw new Error(paginas.message || "No se pudieron obtener las páginas.");
            }

            if (!respuestaLista.ok || !listado.success) {
                throw new Error(listado.message || "No se pudieron cargar las solicitudes.");
            }

            totalLabel.textContent = total.data;
            totalPaginas = paginas.data;

            if (totalPaginas === 0) {
                paginaActual = 0;

            } else if (paginaActual >= totalPaginas) {
                paginaActual = totalPaginas - 1;
            }

            sessionStorage.setItem(
                "paginaSolicitudesPagoTotal",
                paginaActual
            );

            renderizarSolicitudes(listado.data || []);
            actualizarPaginacion();

        } catch (error) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        No se pudieron cargar las solicitudes.
                    </td>
                </tr>
            `;

            mostrarMensaje(error.message, "danger");
        }
    }

    function renderizarSolicitudes(solicitudes) {

        tabla.innerHTML = "";

        if (solicitudes.length === 0) {

            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center py-5">
                        <i class="bi bi-inbox display-5 text-secondary"></i>

                        <p class="text-secondary mt-3 mb-0">
                            No hay solicitudes pendientes de gestión de pago total.
                        </p>
                    </td>
                </tr>
            `;

            return;
        }

        solicitudes.forEach(solicitud => {

            const fila = document.createElement("tr");

            const fecha = solicitud.fechaRegistro
                ? new Date(solicitud.fechaRegistro).toLocaleDateString("es-PE")
                : "-";

            let acciones = "";
            let colorEstado = "text-bg-secondary";

            if (solicitud.estado === "PAGO_TOTAL_EFECTUADO") {

                colorEstado = "text-bg-warning";

                acciones = `
                    <button type="button"
                        class="btn btn-success btn-sm"
                        data-accion="confirmar"
                        data-id="${solicitud.idSolicitud}">
                        <i class="bi bi-check-circle me-1"></i>
                        Confirmar pago
                    </button>

                    <button type="button"
                        class="btn btn-outline-danger btn-sm"
                        data-accion="rechazar"
                        data-id="${solicitud.idSolicitud}">
                        <i class="bi bi-x-circle me-1"></i>
                        Rechazar pago
                    </button>
                `;

            } else if (solicitud.estado === "PAGO_TOTAL_CONFIRMADO") {

                colorEstado = "text-bg-success";

                acciones = `
                    <a href="/pages/programacion/registrarProgramacion.html?id=${solicitud.idSolicitud}"
                        class="btn btn-primary btn-sm">
                        <i class="bi bi-calendar-check me-1"></i>
                        Programar recojo
                    </a>
                `;
            }

            fila.innerHTML = `
                <td class="fw-semibold">
                    #${solicitud.idSolicitud}
                </td>

                <td>
                    ${escaparHTML(solicitud.titulo)}
                </td>

                <td>
                    ${escaparHTML(solicitud.ubicacion)}
                </td>

                <td>
                    ${fecha}
                </td>

                <td>
                    <span class="badge rounded-pill ${colorEstado}">
                        ${escaparHTML(solicitud.estado)}
                    </span>
                </td>

                <td>
                    <div class="d-flex justify-content-center align-items-center flex-wrap gap-2">
                        ${acciones}
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
        botonSiguiente.disabled = paginaActual >= totalPaginas - 1;
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
