const API_URL_COLA = "http://localhost:8080/api/cola";
const API_URL_CARGA = "http://localhost:8080/api/carga";
const parametros = new URLSearchParams(window.location.search);
const idProgramacion = parametros.get("idProgramacion");
const CLAVE_PAGINA = `paginaSalidas_${idProgramacion || "invalida"}`;
const CLAVE_BUSQUEDA = `busquedaSalidas_${idProgramacion || "invalida"}`;
const TAMANO_PAGINA = 5;

let paginaActual = obtenerPaginaInicial();
let salidas = [];
let cargas = [];
let salidasFiltradas = [];

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"])) {
        ocultarPantallaCarga();
        return;
    }

    document.getElementById("buscarSalida").value =
        parametros.get("buscar") ?? sessionStorage.getItem(CLAVE_BUSQUEDA) ?? "";

    document.getElementById("buscarSalida")
        .addEventListener("input", filtrarSalidas);
    document.getElementById("btnLimpiarBusqueda")
        .addEventListener("click", limpiarBusqueda);
    document.getElementById("btnActualizar")
        .addEventListener("click", cargarSalidas);
    document.getElementById("pagina-anterior")
        .addEventListener("click", () => cambiarPagina(paginaActual - 1));
    document.getElementById("pagina-siguiente")
        .addEventListener("click", () => cambiarPagina(paginaActual + 1));
    document.getElementById("tablaSalidas")
        .addEventListener("click", manejarAccionSalida);

    if (!idProgramacion || !Number.isInteger(Number(idProgramacion)) || Number(idProgramacion) <= 0) {
        mostrarMensaje("No se recibió un código de programación válido.", "danger");
        document.getElementById("tablaSalidas").innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    No se pudo identificar la programación.
                </td>
            </tr>
        `;
        actualizarPaginacion(0);
        ocultarPantallaCarga();
        return;
    }

    document.getElementById("codigoProgramacion").textContent =
        `PRG-${idProgramacion}`;

    await cargarSalidas();
});

function obtenerPaginaInicial() {
    const paginaUrl = Number(parametros.get("pagina"));
    if (parametros.has("pagina") && Number.isInteger(paginaUrl) && paginaUrl >= 0) {
        return paginaUrl;
    }

    const paginaGuardada = Number(sessionStorage.getItem(CLAVE_PAGINA));
    return Number.isInteger(paginaGuardada) && paginaGuardada >= 0
        ? paginaGuardada
        : 0;
}

async function cargarSalidas() {

    const tabla = document.getElementById("tablaSalidas");
    mostrarPantallaCarga();
    mostrarMensaje("", "");
    tabla.innerHTML = `
        <tr>
            <td colspan="6" class="text-center py-4 text-secondary">
                <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                Cargando salidas...
            </td>
        </tr>
    `;

    try {
        const [responseSalidas, responseCargas] = await Promise.all([
            fetchAutenticado(`${API_URL_COLA}/programacion/${idProgramacion}/listar`),
            fetchAutenticado(`${API_URL_CARGA}/programacion/${idProgramacion}/listar`)
        ]);

        const [resultadoSalidas, resultadoCargas] = await Promise.all([
            responseSalidas.json(),
            responseCargas.json()
        ]);

        if (!responseSalidas.ok || !resultadoSalidas.success) {
            throw new Error(resultadoSalidas.message || "No se pudieron cargar las salidas.");
        }

        if (!responseCargas.ok || !resultadoCargas.success) {
            throw new Error(resultadoCargas.message || "No se pudieron cargar las cargas.");
        }

        salidas = Array.isArray(resultadoSalidas.data) ? resultadoSalidas.data : [];
        cargas = Array.isArray(resultadoCargas.data) ? resultadoCargas.data : [];

        actualizarResumen();
        filtrarSalidas(false);
    } catch (error) {
        mostrarMensaje(error.message || "No fue posible obtener la información de las salidas.", "danger");
        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    No fue posible cargar las salidas.
                </td>
            </tr>
        `;
        document.getElementById("totalSalidasFiltradas").textContent = "0";
        actualizarPaginacion(0);
    } finally {
        ocultarPantallaCarga();
    }
}

function obtenerCargaPorSalida(idCola) {
    return cargas.find(carga => Number(carga.idCola) === Number(idCola));
}

function actualizarResumen() {
    const pendientes = salidas.filter(salida => !obtenerCargaPorSalida(salida.idCola)).length;
    const enProceso = cargas.filter(carga => carga.estado === "EN_PROCESO").length;

    document.getElementById("totalSalidas").textContent = salidas.length;
    document.getElementById("salidasPendientes").textContent = pendientes;
    document.getElementById("cargasEnProceso").textContent = enProceso;
}

function filtrarSalidas(restablecerPagina = true) {
    const codigo = document.getElementById("buscarSalida").value.trim();
    sessionStorage.setItem(CLAVE_BUSQUEDA, codigo);

    if (restablecerPagina) {
        paginaActual = 0;
    }

    salidasFiltradas = codigo === ""
        ? salidas
        : salidas.filter(salida => String(salida.idCola).includes(codigo));

    const totalPaginas = Math.ceil(salidasFiltradas.length / TAMANO_PAGINA);
    if (totalPaginas === 0) {
        paginaActual = 0;
    } else if (paginaActual >= totalPaginas) {
        paginaActual = totalPaginas - 1;
    }

    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
    renderizarSalidas();
    actualizarPaginacion(totalPaginas);
}

function limpiarBusqueda() {
    document.getElementById("buscarSalida").value = "";
    filtrarSalidas();
}

function renderizarSalidas() {
    const tabla = document.getElementById("tablaSalidas");
    const inicio = paginaActual * TAMANO_PAGINA;
    const salidasPagina = salidasFiltradas.slice(inicio, inicio + TAMANO_PAGINA);

    const animarEntrada = !window.matchMedia("(prefers-reduced-motion: reduce)").matches
        && typeof tabla.animate === "function";

    document.getElementById("totalSalidasFiltradas").textContent =
        salidasFiltradas.length;

    if (salidasFiltradas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-secondary py-5">
                    <i class="bi bi-inbox display-5 d-block mb-2"></i>
                    No se encontraron salidas para este código.
                </td>
            </tr>
        `;
        animarSalidas(tabla, animarEntrada);
        return;
    }

    tabla.innerHTML = salidasPagina.map(salida => {
        const carga = obtenerCargaPorSalida(salida.idCola);
        let estado;
        let accion;

        if (!carga) {
            estado = '<span class="badge text-bg-warning">Pendiente de registro</span>';
            accion = `
                <button type="button" class="btn btn-sm btn-accion-registrar"
                    data-accion-salida="registrar" data-id="${Number(salida.idCola)}">
                    <i class="bi bi-plus-circle me-1"></i>
                    Registrar carga
                </button>
            `;
        } else if (carga.estado === "EN_PROCESO") {
            estado = '<span class="badge text-bg-info">En proceso</span>';
            accion = `
                <button type="button" class="btn btn-sm btn-accion-consultar"
                    data-accion-salida="continuar" data-id="${Number(salida.idCola)}">
                    <i class="bi bi-arrow-repeat me-1"></i>
                    Continuar registro
                </button>
            `;
        } else if (carga.estado === "REGISTRADA") {
            estado = '<span class="badge text-bg-success">Registrada</span>';
            accion = `
                <span class="badge text-bg-success">
                    <i class="bi bi-check-circle me-1"></i>
                    Carga registrada
                </span>
            `;
        } else {
            estado = '<span class="badge text-bg-secondary">Estado desconocido</span>';
            accion = '<span class="text-secondary small">No disponible</span>';
        }

        return `
            <tr>
                <td class="fw-semibold">#${escaparHTML(salida.idCola)}</td>
                <td>${escaparHTML(`${salida.nombreTransportista || ""} ${salida.apellidoTransportista || ""}`.trim() || "-")}</td>
                <td>
                    <span class="fw-semibold">${escaparHTML(salida.placaVehiculo || "-")}</span>
                    <span class="text-secondary small d-block">${escaparHTML(salida.tipoVehiculo || "-")}</span>
                </td>
                <td>${formatearFecha(salida.fechaRegistro)}</td>
                <td>${estado}</td>
                <td class="text-center">${accion}</td>
            </tr>
        `;
    }).join("");

    animarSalidas(tabla, animarEntrada);
}

function animarSalidas(tabla, animar) {
    if (!animar) {
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

function actualizarPaginacion(totalPaginas) {
    document.getElementById("informacionPagina").textContent =
        `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;

    const anteriorDeshabilitado = totalPaginas <= 1 || paginaActual === 0;
    const siguienteDeshabilitado = totalPaginas <= 1 || paginaActual >= totalPaginas - 1;

    document.getElementById("item-anterior").classList.toggle("disabled", anteriorDeshabilitado);
    document.getElementById("item-siguiente").classList.toggle("disabled", siguienteDeshabilitado);
    document.getElementById("pagina-anterior").disabled = anteriorDeshabilitado;
    document.getElementById("pagina-siguiente").disabled = siguienteDeshabilitado;
}

async function cambiarPagina(pagina) {
    const totalPaginas = Math.ceil(salidasFiltradas.length / TAMANO_PAGINA);
    if (pagina < 0 || pagina >= totalPaginas || pagina === paginaActual) {
        return;
    }

    paginaActual = pagina;
    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
    mostrarPantallaCarga();
    await new Promise(resolve => requestAnimationFrame(resolve));
    renderizarSalidas();
    actualizarPaginacion(totalPaginas);
    ocultarPantallaCarga();
}

function manejarAccionSalida(event) {
    const boton = event.target.closest("[data-accion-salida]");
    if (!boton || boton.disabled) {
        return;
    }

    const idCola = Number(boton.dataset.id);
    if (!Number.isInteger(idCola) || idCola <= 0) {
        mostrarMensaje("El código de salida no es válido.", "danger");
        return;
    }

    const parametrosCarga = new URLSearchParams({
        idCola: String(idCola),
        idProgramacion: String(idProgramacion),
        pagina: String(paginaActual),
        buscar: document.getElementById("buscarSalida").value.trim()
    });

    if (boton.dataset.accionSalida === "continuar") {
        const carga = obtenerCargaPorSalida(idCola);
        if (!carga || carga.estado !== "EN_PROCESO") {
            mostrarMensaje("No se encontró una carga pendiente de continuar.", "warning");
            return;
        }
        parametrosCarga.set("idCarga", carga.idCarga);
    } else if (obtenerCargaPorSalida(idCola)) {
        mostrarMensaje("Esta salida ya tiene una carga iniciada.", "warning");
        return;
    }

    window.location.href = `asignarPesoCarga.html?${parametrosCarga.toString()}`;
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
    if (!fecha) return "-";

    const fechaObjeto = new Date(fecha);
    if (Number.isNaN(fechaObjeto.getTime())) {
        return escaparHTML(fecha);
    }

    return fechaObjeto.toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short"
    });
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
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
        contenedor.className = "mb-3";
        return;
    }

    contenedor.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${escaparHTML(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>
    `;
    contenedor.className = "mb-3";
    contenedor.scrollIntoView({ behavior: "smooth", block: "start" });
}
