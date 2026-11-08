
const API_URL = "http://localhost:8080/api/programacion/ejecutadas";

const CLAVE_PAGINA = "paginaProgramacionesEjecutadas";

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalProgramaciones = 0;
let totalPaginas = 0;
let programaciones = [];

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"])) {
        return;
    }

    document.getElementById("buscarProgramacion")
        .addEventListener("input", filtrarProgramaciones);

    document.getElementById("btnLimpiarBusqueda")
        .addEventListener("click", limpiarBusqueda);

    document.getElementById("pagina-anterior")
        .addEventListener("click", () => cambiarPagina(paginaActual - 1));

    document.getElementById("pagina-siguiente")
        .addEventListener("click", () => cambiarPagina(paginaActual + 1));

    document.getElementById("tablaProgramaciones")
        .addEventListener("click", event => {
            const boton = event.target.closest("[data-programacion]");

            if (boton && !boton.disabled) {
                verSalidas(boton.dataset.programacion);
            }
        });

    await cargarProgramaciones();
    ocultarPantallaCarga();
});

async function cargarProgramaciones() {

    mostrarMensaje("", "");
    const tabla = document.getElementById("tablaProgramaciones");
    tabla.innerHTML = `
        <tr>
            <td colspan="8" class="text-center text-secondary py-4">
                <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                Cargando programaciones...
            </td>
        </tr>
    `;

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

        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    No se pudieron cargar las programaciones.
                </td>
            </tr>
        `;
        renderizarPaginacion();
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
                    <span class="badge estado-badge" data-estado="${escaparHTML(programacion.estado)}">
                        ${escaparHTML(programacion.estado)}
                    </span>
                </td>

                <td>
                    <button type="button"
                        class="btn btn-sm btn-accion-consultar"
                        data-programacion="${Number(programacion.idProgramacion)}">
                        <i class="bi bi-eye me-1"></i>
                        Ver salidas
                    </button>
                </td>
            </tr>
        `;
    }).join("");
}

function renderizarPaginacion() {

    document.getElementById("informacionPagina").textContent =
        `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;

    const anteriorDeshabilitado = totalPaginas <= 1 || paginaActual === 0;
    const siguienteDeshabilitado =
        totalPaginas <= 1 || paginaActual >= totalPaginas - 1;

    document.getElementById("item-anterior")
        .classList.toggle("disabled", anteriorDeshabilitado);
    document.getElementById("item-siguiente")
        .classList.toggle("disabled", siguienteDeshabilitado);
    document.getElementById("pagina-anterior").disabled = anteriorDeshabilitado;
    document.getElementById("pagina-siguiente").disabled = siguienteDeshabilitado;
}

async function cambiarPagina(pagina) {

    if (pagina < 0 || pagina >= totalPaginas || pagina === paginaActual) {
        return;
    }

    paginaActual = pagina;
    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

    mostrarPantallaCarga();
    await cargarProgramaciones();
    ocultarPantallaCarga();
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
    animarResultadoFiltro();
}

function limpiarBusqueda() {

    document.getElementById("buscarProgramacion").value = "";

    filtrarProgramaciones();
}

function animarResultadoFiltro() {
    const tabla = document.getElementById("tablaProgramaciones");

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof tabla.animate !== "function"
    ) {
        return;
    }

    tabla.animate(
        [
            { opacity: 0, transform: "translateY(6px)" },
            { opacity: 1, transform: "translateY(0)" }
        ],
        {
            duration: 180,
            easing: "ease-out"
        }
    );
}

function verSalidas(idProgramacion) {

    window.location.href =
        `gestionarSalidasProgramacion.html?idProgramacion=${idProgramacion}`;
}

function mostrarPantallaCarga() {
    let pantalla = document.getElementById("pantalla-carga");

    if (!pantalla) {
        pantalla = document.createElement("div");
        pantalla.id = "pantalla-carga";
        pantalla.innerHTML = `
            <div class="spinner-border text-danger" role="status">
                <span class="visually-hidden">Cargando...</span>
            </div>
            <p class="mt-3 text-secondary fw-semibold">Cargando...</p>
        `;
        document.body.appendChild(pantalla);
    }

    pantalla.classList.remove("oculto");
}

function ocultarPantallaCarga() {
    const pantalla = document.getElementById("pantalla-carga");

    if (!pantalla) {
        return;
    }

    pantalla.classList.add("oculto");
    setTimeout(() => pantalla.remove(), 300);
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
