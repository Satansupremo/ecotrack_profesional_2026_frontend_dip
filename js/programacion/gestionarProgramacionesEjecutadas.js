
const API_URL = "http://localhost:8080/api/programacion/ejecutadas";

const CLAVE_PAGINA = "paginaProgramacionesEjecutadas";

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalProgramaciones = 0;
let totalPaginas = 0;
let programaciones = [];

document.addEventListener("DOMContentLoaded", async () => {

    verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"]);

    document.getElementById("buscarProgramacion")
        .addEventListener("input", filtrarProgramaciones);

    document.getElementById("btnLimpiarBusqueda")
        .addEventListener("click", limpiarBusqueda);

    await cargarProgramaciones();
});

async function cargarProgramaciones() {

    mostrarMensaje("", "");

    try {

        const [respuestaTotal, respuestaPaginas] = await Promise.all([
            fetchAutenticado(`${API_URL}/total`),
            fetchAutenticado(`${API_URL}/paginas`)
        ]);

        const resultadoTotal = await respuestaTotal.json();
        const resultadoPaginas = await respuestaPaginas.json();

        if (!respuestaTotal.ok || !resultadoTotal.success) {
            throw new Error(resultadoTotal.message || "No se pudo obtener el total de programaciones.");
        }

        if (!respuestaPaginas.ok || !resultadoPaginas.success) {
            throw new Error(resultadoPaginas.message || "No se pudo obtener la cantidad de páginas.");
        }

        totalProgramaciones = resultadoTotal.data;
        totalPaginas = resultadoPaginas.data;

        document.getElementById("totalProgramaciones").textContent =
            `Total: ${totalProgramaciones}`;

        if (totalPaginas === 0) {
            programaciones = [];
            renderizarProgramaciones();
            renderizarPaginacion();
            return;
        }

        if (paginaActual >= totalPaginas) {
            paginaActual = totalPaginas - 1;
        }

        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

        const respuestaLista = await fetchAutenticado(
            `${API_URL}/listar?pagina=${paginaActual}`
        );

        const resultadoLista = await respuestaLista.json();

        if (!respuestaLista.ok || !resultadoLista.success) {
            throw new Error(resultadoLista.message || "No se pudieron obtener las programaciones.");
        }

        programaciones = resultadoLista.data || [];

        renderizarProgramaciones();
        renderizarPaginacion();

    } catch (error) {

        mostrarMensaje(error.message, "danger");

        document.getElementById("tablaProgramaciones").innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    No se pudieron cargar las programaciones.
                </td>
            </tr>
        `;
    }
}

function renderizarProgramaciones() {

    const tbody = document.getElementById("tablaProgramaciones");

    if (programaciones.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-4">
                    No hay programaciones registradas en esta página.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = programaciones.map(programacion => {

        const estadoClase = programacion.estado === "EJECUTANDO"
            ? "bg-primary"
            : "bg-warning text-dark";

        return `
            <tr>
                <td class="fw-semibold">
                    ${programacion.idProgramacion}
                </td>

                <td>
                    <div class="fw-semibold">
                        ${escaparHTML(programacion.tituloSolicitud || "Sin título")}
                    </div>
                    <small class="text-muted">
                        Solicitud #${programacion.idSolicitud ?? "-"}
                    </small>
                </td>

                <td>
                    ${escaparHTML(programacion.ubicacionSolicitud || "No especificada")}
                </td>

                <td>
                    ${formatearFecha(programacion.fechaEjecucion)}
                </td>

                <td>
                    ${programacion.cantidadUnidades ?? 0}
                </td>

                <td>
                    <span class="badge bg-secondary">
                        ${programacion.cantidadSalidasPendientes ?? 0}
                    </span>
                </td>

                <td>
                    <span class="badge ${estadoClase}">
                        ${escaparHTML(programacion.estado)}
                    </span>
                </td>

                <td>
                    <button
                        class="btn btn-sm btn-primary"
                        onclick="verSalidas(${programacion.idProgramacion})"
                    >
                        <i class="bi bi-eye"></i>
                        Ver salidas
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarPaginacion() {

    const paginacion = document.getElementById("paginacion");

    document.getElementById("informacionPagina").textContent =
        `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;

    if (totalPaginas <= 1) {
        paginacion.innerHTML = "";
        return;
    }

    let html = `
        <li class="page-item ${paginaActual === 0 ? "disabled" : ""}">
            <button class="page-link" onclick="cambiarPagina(${paginaActual - 1})">
                Anterior
            </button>
        </li>
    `;

    for (let i = 0; i < totalPaginas; i++) {

        html += `
            <li class="page-item ${paginaActual === i ? "active" : ""}">
                <button class="page-link" onclick="cambiarPagina(${i})">
                    ${i + 1}
                </button>
            </li>
        `;
    }

    html += `
        <li class="page-item ${paginaActual === totalPaginas - 1 ? "disabled" : ""}">
            <button class="page-link" onclick="cambiarPagina(${paginaActual + 1})">
                Siguiente
            </button>
        </li>
    `;

    paginacion.innerHTML = html;
}

async function cambiarPagina(pagina) {

    if (pagina < 0 || pagina >= totalPaginas || pagina === paginaActual) {
        return;
    }

    paginaActual = pagina;
    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

    await cargarProgramaciones();
}

function filtrarProgramaciones() {

    const codigo = document.getElementById("buscarProgramacion").value.trim();

    const filtradas = codigo === ""
        ? programaciones
        : programaciones.filter(programacion =>
            String(programacion.idProgramacion).includes(codigo)
        );

    const listaOriginal = programaciones;

    programaciones = filtradas;
    renderizarProgramaciones();
    programaciones = listaOriginal;
}

function limpiarBusqueda() {

    document.getElementById("buscarProgramacion").value = "";

    renderizarProgramaciones();
}

function verSalidas(idProgramacion) {

    window.location.href =
        `gestionarSalidasProgramacion.html?idProgramacion=${idProgramacion}`;
}

function formatearFecha(fecha) {

    if (!fecha) {
        return "No especificada";
    }

    const partes = fecha.split("-");

    if (partes.length !== 3) {
        return fecha;
    }

    return `${partes[2]}/${partes[1]}/${partes[0]}`;
}

function escaparHTML(valor) {

    return String(valor).replace(/[&<>"']/g, caracter => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
    })[caracter]);
}

function mostrarMensaje(mensaje, tipo) {

    const contenedor = document.getElementById("mensaje");

    if (!mensaje) {
        contenedor.innerHTML = "";
        return;
    }

    contenedor.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${escaparHTML(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
        </div>
    `;
}
