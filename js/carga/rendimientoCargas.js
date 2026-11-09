const API_URL = "http://localhost:8080/api/carga/rendimiento";

let paginaActual = 0;
let totalPaginas = 0;
let filtrosAplicados = null;
let cargando = false;

document.addEventListener("DOMContentLoaded", async () => {
    if (!verificarRolPermitido(["ADMINISTRADOR"])) {
        return;
    }

    const hoy = new Date();
    const primerDiaMes = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
    document.getElementById("fechaInicio").value = formatearFecha(primerDiaMes);
    document.getElementById("fechaFin").value = formatearFecha(hoy);

    document.getElementById("formFiltros").addEventListener("submit", aplicarFiltros);
    document.getElementById("pagina-anterior")
        .addEventListener("click", () => cambiarPagina(paginaActual - 1));
    document.getElementById("pagina-siguiente")
        .addEventListener("click", () => cambiarPagina(paginaActual + 1));

    filtrosAplicados = leerFiltrosFormulario();
    await cargarRendimiento();
    ocultarPantallaCarga();
});

async function aplicarFiltros(event) {
    event.preventDefault();

    const filtros = leerFiltrosFormulario();
    if (!filtros) {
        mostrarMensaje("La fecha de inicio no puede ser posterior a la fecha de fin.", "warning");
        return;
    }

    filtrosAplicados = filtros;
    paginaActual = 0;
    await cargarRendimiento();
}

function leerFiltrosFormulario() {
    const fechaInicio = document.getElementById("fechaInicio").value;
    const fechaFin = document.getElementById("fechaFin").value;

    if (!fechaInicio || !fechaFin || fechaInicio > fechaFin) {
        return null;
    }

    return {
        fechaInicio: `${fechaInicio}T00:00:00`,
        fechaFin: `${fechaFin}T23:59:59.999999999`
    };
}

async function cargarRendimiento() {
    if (!filtrosAplicados || cargando) {
        return;
    }

    cargando = true;
    const tbody = document.getElementById("tablaRendimiento");
    const botonFiltrar = document.getElementById("btnFiltrar");
    const botonAnterior = document.getElementById("pagina-anterior");
    const botonSiguiente = document.getElementById("pagina-siguiente");
    botonFiltrar.disabled = true;
    botonAnterior.disabled = true;
    botonSiguiente.disabled = true;
    mostrarMensaje("", "");
    tbody.setAttribute("aria-busy", "true");
    tbody.innerHTML = `
        <tr>
            <td colspan="5" class="text-center text-secondary py-4">
                <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                Consultando rendimiento...
            </td>
        </tr>
    `;

    try {
        const parametros = new URLSearchParams(filtrosAplicados);
        const respuestaPaginas = await fetchAutenticado(
            `${API_URL}/paginas?${parametros.toString()}`
        );
        const resultadoPaginas = await respuestaPaginas.json();

        if (!respuestaPaginas.ok || !resultadoPaginas.success) {
            throw new Error(resultadoPaginas.message || "No se pudo obtener la cantidad de páginas.");
        }

        totalPaginas = Number(resultadoPaginas.data) || 0;
        if (totalPaginas === 0) {
            paginaActual = 0;
            renderizarRendimiento([]);
            renderizarPaginacion();
            return;
        }

        if (paginaActual >= totalPaginas) {
            paginaActual = totalPaginas - 1;
        }

        const parametrosLista = new URLSearchParams(filtrosAplicados);
        const respuestaLista = await fetchAutenticado(
            `${API_URL}/listar/${paginaActual}?${parametrosLista.toString()}`
        );
        const resultadoLista = await respuestaLista.json();

        if (!respuestaLista.ok || !resultadoLista.success) {
            throw new Error(resultadoLista.message || "No se pudo cargar el rendimiento de cargas.");
        }

        renderizarRendimiento(Array.isArray(resultadoLista.data) ? resultadoLista.data : []);
        renderizarPaginacion();
    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al consultar el rendimiento.", "danger");
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-4">
                    No se pudo cargar el rendimiento de cargas.
                </td>
            </tr>
        `;
        document.getElementById("totalEmpleados").textContent = "Empleados: 0";
        totalPaginas = 0;
        renderizarPaginacion();
    } finally {
        cargando = false;
        botonFiltrar.disabled = false;
        tbody.setAttribute("aria-busy", "false");
        renderizarPaginacion();
    }
}

function renderizarRendimiento(empleados) {
    const tbody = document.getElementById("tablaRendimiento");
    document.getElementById("totalEmpleados").textContent =
        `Empleados en página: ${empleados.length}`;

    if (empleados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    No hay cargas registradas para el rango de fechas seleccionado.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = empleados.map(empleado => `
        <tr>
            <td class="fw-semibold">${Number(empleado.idEmpleado)}</td>
            <td>${escaparHTML(empleado.nombreCompleto)}</td>
            <td>${escaparHTML(empleado.dni)}</td>
            <td>${escaparHTML(formatearRol(empleado.rol))}</td>
            <td class="text-end fw-semibold">${Number(empleado.totalCargas) || 0}</td>
        </tr>
    `).join("");
}

function renderizarPaginacion() {
    document.getElementById("informacionPagina").textContent =
        `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;
    document.getElementById("pagina-anterior").disabled =
        cargando || totalPaginas <= 1 || paginaActual === 0;
    document.getElementById("pagina-siguiente").disabled =
        cargando || totalPaginas <= 1 || paginaActual >= totalPaginas - 1;
}

async function cambiarPagina(pagina) {
    if (pagina < 0 || pagina >= totalPaginas || pagina === paginaActual || cargando) {
        return;
    }

    paginaActual = pagina;
    await cargarRendimiento();
}

function formatearFecha(fecha) {
    const anio = fecha.getFullYear();
    const mes = String(fecha.getMonth() + 1).padStart(2, "0");
    const dia = String(fecha.getDate()).padStart(2, "0");
    return `${anio}-${mes}-${dia}`;
}

function formatearRol(rol) {
    return String(rol || "")
        .toLowerCase()
        .replaceAll("_", " ")
        .replace(/\b\p{L}/gu, letra => letra.toUpperCase());
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

function mostrarMensaje(mensaje, tipo) {
    const contenedor = document.getElementById("mensaje");
    contenedor.innerHTML = mensaje
        ? `<div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${escaparHTML(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>`
        : "";
}
