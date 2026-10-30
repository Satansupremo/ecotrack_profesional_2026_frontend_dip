
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

    let paginaActual = Number(sessionStorage.getItem("paginaSolicitudesPIE")) || 0;
    let totalPaginas = 0;

    botonAnterior.addEventListener("click", () => {
        if (paginaActual > 0) {
            paginaActual--;
            sessionStorage.setItem("paginaSolicitudesPIE", paginaActual);
            cargarSolicitudes();
        }
    });

    botonSiguiente.addEventListener("click", () => {
        if (paginaActual < totalPaginas - 1) {
            paginaActual++;
            sessionStorage.setItem("paginaSolicitudesPIE", paginaActual);
            cargarSolicitudes();
        }
    });

    botonActualizar.addEventListener("click", () => {
        paginaActual = 0;
        sessionStorage.setItem("paginaSolicitudesPIE", paginaActual);
        cargarSolicitudes();
    });

    await cargarSolicitudes();

    async function cargarSolicitudes() {
        try {
            mensajeContainer.innerHTML = "";

            const [respuestaTotal, respuestaPaginas, respuestaLista] =
                await Promise.all([
                    fetchAutenticado(`${API_URL}/pie/total`),
                    fetchAutenticado(`${API_URL}/pie/paginas`),
                    fetchAutenticado(`${API_URL}/pie/listar?pagina=${paginaActual}`)
                ]);

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

            const total = await leerRespuesta(respuestaTotal, "Total PIE");
            const paginas = await leerRespuesta(respuestaPaginas, "Páginas PIE");
            const listado = await leerRespuesta(respuestaLista, "Listado PIE");

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

            sessionStorage.setItem("paginaSolicitudesPIE", paginaActual);

            renderizarSolicitudes(listado.data || []);
            actualizarPaginacion();

        } catch (error) {
            console.error("Error al cargar solicitudes PIE:", error);

            tabla.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        No se pudieron cargar las solicitudes PIE.
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
                            No hay solicitudes pendientes de revisión de pago inicial.
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
                    <span class="badge rounded-pill text-bg-warning">
                        ${escaparHTML(solicitud.estado)}
                    </span>
                </td>

                <td>
                    <div class="d-flex justify-content-center gap-2">
                        <a href="/pages/solicitud/confirmarPIE.html?id=${solicitud.idSolicitud}"
                            class="btn btn-success btn-sm">
                            <i class="bi bi-check-circle me-1"></i>
                            Confirmar PIE
                        </a>

                        <a href="/pages/solicitud/rechazarPIE.html?id=${solicitud.idSolicitud}"
                            class="btn btn-danger btn-sm">
                            <i class="bi bi-x-circle me-1"></i>
                            Rechazar PIE
                        </a>
                    </div>
                </td>
            `;

            tabla.appendChild(fila);
        });
    }

    function actualizarPaginacion() {
        const totalVisible = totalPaginas > 0 ? totalPaginas : 0;

        informacionPaginacion.textContent =
            `Página ${totalVisible === 0 ? 0 : paginaActual + 1} de ${totalVisible}`;

        botonAnterior.parentElement.classList.toggle(
            "disabled",
            paginaActual <= 0
        );

        botonSiguiente.parentElement.classList.toggle(
            "disabled",
            paginaActual >= totalPaginas - 1
        );
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
