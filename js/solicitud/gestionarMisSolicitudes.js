
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

    let paginaActual = Number(sessionStorage.getItem("paginaMisSolicitudes")) || 0;
    let totalPaginas = 0;

    botonAnterior.addEventListener("click", () => {
        if (paginaActual > 0) {
            paginaActual--;
            sessionStorage.setItem("paginaMisSolicitudes", paginaActual);
            cargarSolicitudes();
        }
    });

    botonSiguiente.addEventListener("click", () => {
        if (paginaActual < totalPaginas - 1) {
            paginaActual++;
            sessionStorage.setItem("paginaMisSolicitudes", paginaActual);
            cargarSolicitudes();
        }
    });

    await cargarSolicitudes();

    async function cargarSolicitudes() {
        try {
            mensajeContainer.innerHTML = "";

            const [respuestaTotal, respuestaPaginas, respuestaLista] =
                await Promise.all([
                    fetchAutenticado(`${API_URL}/total`),
                    fetchAutenticado(`${API_URL}/paginas`),
                    fetchAutenticado(`${API_URL}/listar?pagina=${paginaActual}`)
                ]);

            async function leerRespuesta(respuesta, nombre) {
                const contenido = await respuesta.text();

                try {
                    return JSON.parse(contenido);
                } catch (error) {
                    throw new Error(
                        `${nombre} no devolvió JSON. Revisa la URL y la respuesta del servidor.`
                    );
                }
            }

            const total = await leerRespuesta(respuestaTotal, "Total");
            const paginas = await leerRespuesta(respuestaPaginas, "Páginas");
            const listado = await leerRespuesta(respuestaLista, "Listado");

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

            sessionStorage.setItem("paginaMisSolicitudes", paginaActual);

            renderizarSolicitudes(listado.data || []);
            actualizarPaginacion();

        } catch (error) {
            tabla.innerHTML = `
                <tr>
                    <td colspan="5" class="text-center text-danger py-4">
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
                <td colspan="5" class="text-center py-5">
                    <i class="bi bi-inbox display-5 text-secondary"></i>
                    <p class="text-secondary mt-3 mb-0">
                        Todavía no tienes solicitudes registradas.
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

            const botonPagoInicial =
                solicitud.estado === "PAGO_INICIAL_PENDIENTE"
                    ? `
                    <a href="/pages/solicitud/registrarPagoInicial.html?id=${solicitud.idSolicitud}"
                       class="btn btn-sm btn-outline-warning    ">
                        <i class="bi bi-credit-card me-1"></i>
                        Registrar pago inicial
                    </a>
                `
                    : "";
            const botonPagoTotal =
                solicitud.estado === "PAGO_TOTAL_PENDIENTE"
                    ? `
                    <a href="/pages/solicitud/registrarPagoTotal.html?id=${solicitud.idSolicitud}"
                    class="btn btn-sm btn-outline-dark">
                        <i class="bi bi-credit-card me-1"></i>
                        Registrar pago total
                    </a>
                `
                    : "";

            fila.innerHTML = `
            <td class="fw-semibold">#${solicitud.idSolicitud}</td>
            <td>${escaparHTML(solicitud.titulo)}</td>
            <td>${fecha}</td>
            <td>
                <span class="badge rounded-pill ${obtenerClaseEstado(solicitud.estado)}">
                    ${escaparHTML(solicitud.estado)}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2 flex-wrap">
                    <a href="/pages/solicitud/verSolicitud.html?id=${solicitud.idSolicitud}"
                       class="btn btn-sm btn-outline-danger">
                        <i class="bi bi-eye me-1"></i>
                        Ver
                    </a>
                    ${botonPagoInicial}
                    ${botonPagoTotal}
                </div>
            </td>
        `;


            tabla.appendChild(fila);
        });
    }


    function obtenerClaseEstado(estado) {
        const estados = {
            PENDIENTE: "text-bg-success",
            PAGO_INICIAL_PENDIENTE: "text-bg-warning",
            PAGO_INICIAL_EFECTUADO: "text-bg-warning",
            PAGO_INICIAL_CONFIRMADO: "text-bg-warning",

            PAGO_TOTAL_PENDIENTE: "text-bg-dark",
            PAGO_TOTAL_EFECTUADO: "text-bg-dark",
            PAGO_TOTAL_CONFIRMADO: "text-bg-dark",
            PROGRAMADO: "text-bg-primary",
            FINALIZADO: "text-bg-success",
            CANCELADO: "text-bg-danger"
        };

        return estados[estado] || "text-bg-secondary";
    }


    function actualizarPaginacion() {
        const totalVisible = totalPaginas > 0 ? totalPaginas : 0;

        informacionPaginacion.textContent =
            `Página ${totalVisible === 0 ? 0 : paginaActual + 1} de ${totalVisible}`;

        botonAnterior.parentElement.classList.toggle("disabled", paginaActual <= 0);

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
