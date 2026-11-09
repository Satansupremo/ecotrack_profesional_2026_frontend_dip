const API_URL = "http://localhost:8080/api/programacion/mis-programaciones";
const PROGRAMACION_URL = "http://localhost:8080/api/programacion";

let programacionActual = null;
let unidadesActuales = [];
let salidasPendientes = [];
let rolActual = null;
let idDetalleSalidaPendiente = null;
let modalConfirmarSalida = null;
let modalConfirmarFinalizacion = null;

document.addEventListener("DOMContentLoaded", async () => {
    verificarRolPermitido(["JEFE_UNIDAD", "ADMINISTRADOR", "TRANSPORTISTA"]);

    const idProgramacion = obtenerIdProgramacion();

    if (!idProgramacion) {
        mostrarMensaje("El código de programación no es válido.", "danger");
        return;
    }

    rolActual = obtenerRolDesdeToken();

    configurarEventos();
    await cargarInformacion(idProgramacion);
});

function configurarEventos() {
    document.getElementById("volver").addEventListener("click", volverAProgramaciones);
    document.getElementById("generar-reporte").addEventListener("click", generarReporte);

    const elementoModalSalida = document.getElementById("modal-confirmar-salida");
    modalConfirmarSalida = bootstrap.Modal.getOrCreateInstance(elementoModalSalida);
    const elementoModalFinalizacion = document.getElementById("modal-confirmar-finalizacion");
    modalConfirmarFinalizacion = bootstrap.Modal.getOrCreateInstance(elementoModalFinalizacion);

    document.getElementById("tabla-unidades").addEventListener("click", event => {
        const boton = event.target.closest("[data-registrar-salida]");

        if (!boton || boton.disabled) {
            return;
        }

        idDetalleSalidaPendiente = Number(boton.dataset.registrarSalida);

        if (Number.isInteger(idDetalleSalidaPendiente) && idDetalleSalidaPendiente > 0) {
            modalConfirmarSalida.show();
        }
    });

    document.getElementById("btn-confirmar-salida").addEventListener("click", async () => {
        const idDetalle = idDetalleSalidaPendiente;
        idDetalleSalidaPendiente = null;
        modalConfirmarSalida.hide();

        if (idDetalle) {
            await registrarSalida(idDetalle);
        }
    });

    elementoModalSalida.addEventListener("hidden.bs.modal", () => {
        idDetalleSalidaPendiente = null;
    });

    const botonFinalizar = document.getElementById("finalizar-programacion");

    if (botonFinalizar) {
        botonFinalizar.addEventListener("click", solicitarFinalizacionProgramacion);
    }

    document.getElementById("btn-confirmar-finalizacion")
        .addEventListener("click", async () => {
            modalConfirmarFinalizacion.hide();
            await finalizarProgramacion();
        });
}

function obtenerIdProgramacion() {
    const parametros = new URLSearchParams(window.location.search);
    const id = parametros.get("id");

    if (!id || !/^[1-9]\d*$/.test(id)) {
        return null;
    }

    return Number(id);
}

function obtenerRolDesdeToken() {
    const token = sessionStorage.getItem("token");

    if (!token) {
        return null;
    }

    try {
        const parteToken = token.split(".")[1];
        const base64 = parteToken
            .replace(/-/g, "+")
            .replace(/_/g, "/")
            .padEnd(Math.ceil(parteToken.length / 4) * 4, "=");

        const payload = JSON.parse(atob(base64));
        const valores = [];

        function recorrer(objeto) {
            if (typeof objeto === "string") {
                valores.push(objeto);
                return;
            }

            if (Array.isArray(objeto)) {
                objeto.forEach(recorrer);
                return;
            }

            if (objeto && typeof objeto === "object") {
                Object.values(objeto).forEach(recorrer);
            }
        }

        recorrer(payload);

        const rolesPermitidos = [
            "ADMINISTRADOR",
            "JEFE_UNIDAD",
            "TRANSPORTISTA"
        ];

        for (const valor of valores) {
            const rol = valor.replace(/^ROLE_/, "").toUpperCase();

            if (rolesPermitidos.includes(rol)) {
                return rol;
            }
        }

        return null;

    } catch {
        return null;
    }
}

function tienePermisoGestion() {
    return rolActual === "JEFE_UNIDAD" || rolActual === "ADMINISTRADOR";
}

async function cargarInformacion(idProgramacion) {
    try {
        mostrarPantallaCarga(true);

        const [respuestaDetalle, respuestaUnidades] = await Promise.all([
            fetchAutenticado(`${API_URL}/${idProgramacion}/detalle`),
            fetchAutenticado(`${API_URL}/${idProgramacion}/unidades`)
        ]);

        const detalle = await leerRespuesta(respuestaDetalle);
        const unidades = await leerRespuesta(respuestaUnidades);

        if (!detalle.success) {
            throw new Error(detalle.message || "No se pudo obtener la programación.");
        }

        if (!unidades.success) {
            throw new Error(unidades.message || "No se pudieron obtener las unidades.");
        }

        programacionActual = detalle.data;
        unidadesActuales = Array.isArray(unidades.data) ? unidades.data : [];

        renderizarProgramacion(programacionActual);
        renderizarRecomendaciones(programacionActual);

        if (tienePermisoGestion()) {
            await cargarSalidasPendientes(idProgramacion);
        } else {
            ocultarControlEjecucion();
        }

        renderizarUnidades(unidadesActuales);

        document.getElementById("volver").disabled = false;

    } catch (error) {
        mostrarMensaje(
            error.message || "Ocurrió un error al cargar la programación.",
            "danger"
        );
    } finally {
        mostrarPantallaCarga(false);
    }
}

async function cargarSalidasPendientes(idProgramacion) {
    const tbody = document.getElementById("tabla-salidas-pendientes");

    if (tbody) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    <span class="spinner-border spinner-border-sm me-2"></span>
                    Actualizando salidas pendientes...
                </td>
            </tr>
        `;
    }

    try {
        const respuesta = await fetchAutenticado(
            `${PROGRAMACION_URL}/${idProgramacion}/cola/pendientes`
        );

        const resultado = await leerRespuesta(respuesta);

        if (!resultado.success) {
            throw new Error(resultado.message || "No se pudieron obtener las salidas pendientes.");
        }

        salidasPendientes = Array.isArray(resultado.data)
            ? resultado.data
            : [];

        renderizarSalidasPendientes();
        actualizarControlEjecucion();

    } catch (error) {
        salidasPendientes = [];

        if (tbody) {
            tbody.innerHTML = `
                <tr>
                    <td colspan="6" class="text-center text-danger py-4">
                        ${escaparHTML(error.message)}
                    </td>
                </tr>
            `;
        }

        actualizarControlEjecucion();
    }
}

function renderizarSalidasPendientes() {
    const tbody = document.getElementById("tabla-salidas-pendientes");
    const total = document.getElementById("total-salidas-pendientes");

    if (!tbody || !total) {
        return;
    }

    total.textContent = salidasPendientes.length;

    if (salidasPendientes.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    No hay salidas pendientes de recepción.
                </td>
            </tr>
        `;
        return;
    }

    tbody.innerHTML = salidasPendientes.map(salida => `
        <tr>
            <td>${escaparHTML(salida.idCola)}</td>
            <td>${escaparHTML(formatearTipoVehiculo(salida.tipoVehiculo))}</td>
            <td>${escaparHTML(salida.placaVehiculo || "No disponible")}</td>
            <td>${escaparHTML(
                `${salida.nombreTransportista || ""} ${salida.apellidoTransportista || ""}`.trim() || "No disponible"
            )}</td>
            <td>${formatearFechaHora(salida.fechaRegistro)}</td>
            <td>
                <span class="badge bg-warning text-dark">En camino</span>
            </td>
        </tr>
    `).join("");
}

function actualizarControlEjecucion() {
    const seccion = document.getElementById("seccion-control-ejecucion");
    const estadoControl = document.getElementById("estado-control-ejecucion");
    const botonFinalizar = document.getElementById("finalizar-programacion");

    if (!seccion || !estadoControl || !botonFinalizar || !programacionActual) {
        return;
    }

    seccion.style.display = "block";

    const estado = programacionActual.estado;

    if (estado === "EJECUTANDO") {
        estadoControl.textContent = "La programación se encuentra en ejecución.";
        estadoControl.className = "alert alert-success";

        botonFinalizar.disabled = false;
        botonFinalizar.className =
            "btn btn-danger btn-lg fw-bold shadow-sm px-4 flex-shrink-0";
        botonFinalizar.innerHTML =
            '<i class="bi bi-flag-fill me-2"></i>Solicitar finalización';

    } else if (estado === "POR_FINALIZAR") {
        estadoControl.textContent =
            `La programación está pendiente de finalizar. Quedan ${salidasPendientes.length} salidas por recibir.`;

        estadoControl.className = "alert alert-warning";

        botonFinalizar.disabled = true;
        botonFinalizar.className =
            "btn btn-outline-warning btn-lg fw-bold px-4 flex-shrink-0";
        botonFinalizar.innerHTML =
            '<i class="bi bi-hourglass-split me-2"></i>Finalización solicitada';

    } else if (estado === "FINALIZADO") {
        estadoControl.textContent = "La programación ha finalizado correctamente.";

        estadoControl.className = "alert alert-secondary";

        botonFinalizar.disabled = true;
        botonFinalizar.className =
            "btn btn-outline-success btn-lg fw-bold px-4 flex-shrink-0";
        botonFinalizar.innerHTML =
            '<i class="bi bi-check-circle me-2"></i>Programación finalizada';
    } else {
        estadoControl.textContent = `Estado actual: ${formatearEstado(estado)}`;
        estadoControl.className = "alert alert-info";

        botonFinalizar.disabled = true;
        botonFinalizar.className =
            "btn btn-outline-secondary btn-lg fw-bold px-4 flex-shrink-0";
        botonFinalizar.innerHTML =
            '<i class="bi bi-slash-circle me-2"></i>No disponible';
    }
}

function ocultarControlEjecucion() {
    const seccion = document.getElementById("seccion-control-ejecucion");

    if (seccion) {
        seccion.style.display = "none";
    }
}

function renderizarProgramacion(programacion) {
    const contenedor = document.getElementById("informacion-programacion");

    const estado = formatearEstado(programacion.estado);

    contenedor.innerHTML = `
        <div class="row g-3">
            <div class="col-sm-6 col-xl-3">
                <div class="bg-light rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Código de programación</span>
                    <span class="fw-bold">#${escaparHTML(programacion.idProgramacion)}</span>
                </div>
            </div>

            <div class="col-sm-6 col-xl-3">
                <div class="bg-light rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Código de solicitud</span>
                    <span class="fw-bold">#${escaparHTML(programacion.idSolicitud)}</span>
                </div>
            </div>

            <div class="col-sm-6 col-xl-3">
                <div class="bg-light rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Estado</span>
                    <span class="badge estado-badge" data-estado="${escaparHTML(programacion.estado)}">
                        ${escaparHTML(estado)}
                    </span>
                </div>
            </div>

            <div class="col-sm-6 col-xl-3">
                <div class="bg-light rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Fecha de ejecución</span>
                    <span class="fw-semibold">${formatearFecha(programacion.fechaEjecucion)}</span>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Título de la solicitud</span>
                    <span class="fw-semibold">${escaparHTML(programacion.tituloSolicitud || "No disponible")}</span>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Ubicación</span>
                    <span class="fw-semibold">${escaparHTML(programacion.ubicacionSolicitud || "No disponible")}</span>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Jefe de unidad</span>
                    <span class="fw-semibold">${escaparHTML(
                        `${programacion.nombreJefeUnidad || ""} ${programacion.apellidoJefeUnidad || ""}`.trim() || "No disponible"
                    )}</span>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small d-block">Fecha de registro</span>
                    <span class="fw-semibold">${formatearFechaHora(programacion.fechaRegistro)}</span>
                </div>
            </div>

            <div class="col-12">
                <div class="border rounded-3 p-3">
                    <span class="text-secondary small d-block">Descripción</span>
                    <p class="mb-0">${escaparHTML(programacion.descripcionSolicitud || "No disponible")}</p>
                </div>
            </div>
        </div>
    `;
}

function renderizarRecomendaciones(programacion) {
    const contenedor = document.getElementById("informacion-recomendaciones");

    contenedor.innerHTML = `
        <div class="row g-3">
            <div class="col-md-4">
                <div class="bg-danger-subtle rounded-3 p-3 h-100">
                    <span class="text-danger-emphasis small fw-semibold d-block">Cantidad de unidades recomendadas</span>
                    <span class="fs-3 text-danger-emphasis fw-bold">${escaparHTML(programacion.cantidadUnidades ?? "No especificada")}</span>
                </div>
            </div>

            <div class="col-md-8">
                <div class="bg-light rounded-3 p-3 h-100">
                    <span class="text-secondary small fw-semibold d-block">Razón de la cantidad de unidades</span>
                    <p class="mb-0">${escaparHTML(programacion.razonCantidadUnidades || "Sin recomendaciones")}</p>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small fw-semibold d-block">Equipos de seguridad</span>
                    <p class="mb-0">${escaparHTML(programacion.equipoSeguridad || "Sin recomendaciones")}</p>
                </div>
            </div>

            <div class="col-md-6">
                <div class="border rounded-3 p-3 h-100">
                    <span class="text-secondary small fw-semibold d-block">Otras recomendaciones</span>
                    <p class="mb-0">${escaparHTML(programacion.otrasRecomendaciones || "Sin recomendaciones")}</p>
                </div>
            </div>
        </div>
    `;
}

function renderizarUnidades(unidades) {
    const tbody = document.getElementById("tabla-unidades");
    const total = document.getElementById("total-unidades");

    total.textContent = unidades.length;

    const detallesConSalidaPendiente = new Set(
        salidasPendientes.map(salida => Number(salida.idDetalle))
    );

    if (unidades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="9" class="text-center py-4">
                    No hay unidades asignadas a esta programación.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = unidades.map(unidad => {
            const tieneSalidaPendiente = detallesConSalidaPendiente.has(
                Number(unidad.idDetalle)
            );
            const esVolquete = String(unidad.tipoVehiculo || "").trim().toUpperCase() === "VOLQUETE";

            let accion = "";

            if (tienePermisoGestion() && programacionActual?.estado === "EJECUTANDO") {
                accion = tieneSalidaPendiente
                    ? `<span class="badge bg-warning text-dark">En camino</span>`
                    : esVolquete
                        ? `
                        <button type="button"
                                class="btn btn-sm btn-outline-danger rounded-pill px-3"
                                data-registrar-salida="${Number(unidad.idDetalle)}">
                            <i class="bi bi-box-arrow-up-right me-1"></i>
                            Registrar salida
                        </button>
                    `
                        : `<span class="text-secondary small">No requiere registrar salida</span>`;
            } else if (tieneSalidaPendiente) {
                accion = `<span class="badge bg-warning text-dark">En camino</span>`;
            } else {
                accion = `<span class="text-muted">No disponible</span>`;
            }

            return `
                <tr>
                    <td>${escaparHTML(unidad.idDetalle)}</td>
                    <td>${escaparHTML(formatearTipoVehiculo(unidad.tipoVehiculo))}</td>
                    <td>${escaparHTML(unidad.placa || "No disponible")}</td>
                    <td>${escaparHTML(unidad.marca || "No disponible")}</td>
                    <td>${escaparHTML(unidad.modelo || "No disponible")}</td>
                    <td>${escaparHTML(unidad.capacidadLibras ?? "No disponible")}</td>
                    <td>${escaparHTML(
                        `${unidad.nombreTransportista || ""} ${unidad.apellidoTransportista || ""}`.trim() || "No disponible"
                    )}</td>
                    <td>${escaparHTML(unidad.celular || "No disponible")}</td>
                    <td>${accion}</td>
                </tr>
            `;
        }).join("");
    }

    document.getElementById("generar-reporte").disabled = unidades.length === 0;
}

async function registrarSalida(idDetalle) {
    if (!tienePermisoGestion()) {
        mostrarMensaje("No tienes permisos para registrar salidas.", "danger");
        return;
    }

    if (!programacionActual || programacionActual.estado !== "EJECUTANDO") {
        mostrarMensaje("Solo se pueden registrar salidas en programaciones en ejecución.", "warning");
        return;
    }

    try {
        mostrarPantallaCarga(true);

        const respuesta = await fetchAutenticado(
            `${API_URL}/${programacionActual.idProgramacion}/cola/${idDetalle}`,
            {
                method: "POST"
            }
        );

        const resultado = await leerRespuesta(respuesta);

        if (!resultado.success) {
            throw new Error(resultado.message || "No se pudo registrar la salida.");
        }

        mostrarMensaje(
            resultado.message || "Salida registrada correctamente.",
            "success"
        );

        await cargarInformacion(programacionActual.idProgramacion);

    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al registrar la salida.", "danger");
    } finally {
        mostrarPantallaCarga(false);
    }
}

async function finalizarProgramacion() {
    if (!tienePermisoGestion()) {
        mostrarMensaje("No tienes permisos para finalizar esta programación.", "danger");
        return;
    }

    if (!programacionActual || programacionActual.estado !== "EJECUTANDO") {
        mostrarMensaje("La programación no se encuentra en ejecución.", "warning");
        return;
    }

    try {
        mostrarPantallaCarga(true);

        const respuesta = await fetchAutenticado(
            `${API_URL}/${programacionActual.idProgramacion}/finalizar`,
            {
                method: "PUT"
            }
        );

        const resultado = await leerRespuesta(respuesta);

        if (!resultado.success) {
            throw new Error(resultado.message || "No se pudo finalizar la programación.");
        }

        mostrarMensaje(
            resultado.message || "Se procesó la solicitud de finalización.",
            "success"
        );

        await cargarInformacion(programacionActual.idProgramacion);

    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al finalizar la programación.", "danger");
    } finally {
        mostrarPantallaCarga(false);
    }
}

function solicitarFinalizacionProgramacion() {
    if (!tienePermisoGestion()) {
        mostrarMensaje("No tienes permisos para finalizar esta programación.", "danger");
        return;
    }

    if (!programacionActual || programacionActual.estado !== "EJECUTANDO") {
        mostrarMensaje("La programación no se encuentra en ejecución.", "warning");
        return;
    }

    modalConfirmarFinalizacion.show();
}

function volverAProgramaciones() {
    window.location.href = "/pages/programacion/gestionarMisProgramaciones.html";
}

async function fetchAutenticado(url, opciones = {}) {
    const token = sessionStorage.getItem("token");

    if (!token) {
        throw new Error("La sesión ha expirado. Inicia sesión nuevamente.");
    }

    return fetch(url, {
        ...opciones,
        headers: {
            ...(opciones.headers || {}),
            "Authorization": `Bearer ${token}`,
            "Content-Type": "application/json"
        }
    });
}

async function leerRespuesta(respuesta) {
    const texto = await respuesta.text();
    let resultado = {};

    if (texto) {
        try {
            resultado = JSON.parse(texto);
        } catch {
            throw new Error("El servidor devolvió una respuesta no válida.");
        }
    }

    if (!respuesta.ok) {
        throw new Error(
            resultado.message || `No se pudo completar la solicitud. Código HTTP: ${respuesta.status}`
        );
    }

    return resultado;
}

function mostrarMensaje(mensaje, tipo = "info") {
    const contenedor = document.getElementById("mensaje-container");

    contenedor.innerHTML = `
        <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${escaparHTML(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert"
                    aria-label="Cerrar"></button>
        </div>
    `;
}

function mostrarPantallaCarga(mostrar) {
    const pantalla = document.getElementById("pantalla-carga");

    if (pantalla) {
        pantalla.style.display = mostrar ? "flex" : "none";
    }
}

function escaparHTML(valor) {
    return String(valor ?? "").replace(/[&<>"']/g, caracter => {
        const caracteres = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#039;"
        };

        return caracteres[caracter];
    });
}

function formatearFecha(fecha) {
    if (!fecha) return "No disponible";

    const [anio, mes, dia] = String(fecha).split("-");
    return `${dia}/${mes}/${anio}`;
}

function formatearFechaHora(fecha) {
    if (!fecha) return "No disponible";

    const fechaObjeto = new Date(fecha);

    if (Number.isNaN(fechaObjeto.getTime())) {
        return "No disponible";
    }

    return fechaObjeto.toLocaleString("es-PE");
}

function formatearEstado(estado) {
    const estados = {
        ASIGNADO: "Asignado",
        EJECUTANDO: "En ejecución",
        POR_FINALIZAR: "Pendiente de finalización",
        FINALIZADO: "Finalizado"
    };

    return estados[estado] || estado || "No disponible";
}

function formatearTipoVehiculo(tipo) {
    const tipos = {
        VOLQUETE: "Volquete",
        EXCAVADORA: "Excavadora",
        RETROEXCAVADORA: "Retroexcavadora",
        CARGADOR_FRONTAL: "Cargador frontal",
        TRACTOR_DE_ORUGAS: "Tractor de orugas"
    };

    return tipos[tipo] || tipo || "No disponible";
}

function generarReporte() {
    if (!programacionActual || unidadesActuales.length === 0) {
        mostrarMensaje(
            "No hay unidades asignadas para generar el reporte.",
            "warning"
        );
        return;
    }

    const { jsPDF } = window.jspdf;
    const documento = new jsPDF({
        orientation: "portrait",
        unit: "mm",
        format: "a4"
    });

    const rojo = [255, 49, 49];
    const gris = [90, 90, 90];
    const grisClaro = [245, 245, 245];
    const negro = [35, 35, 35];

    const fechaGeneracion = new Date().toLocaleString("es-PE");

    dibujarEncabezadoReporte(
        documento,
        "REPORTE DE PROGRAMACIÓN",
        "INFORMACIÓN GENERAL"
    );

    let posicionY = 48;

    documento.setFont("helvetica", "bold");
    documento.setFontSize(12);
    documento.setTextColor(...negro);
    documento.text("1. Datos de la programación", 15, posicionY);

    posicionY += 5;

    documento.autoTable({
        startY: posicionY,
        theme: "grid",
        margin: { left: 15, right: 15 },
        head: [["Campo", "Información"]],
        body: [
            ["Código de programación", `PROG-${programacionActual.idProgramacion}`],
            ["Código de solicitud", `SOL-${programacionActual.idSolicitud}`],
            ["Título de la solicitud", programacionActual.tituloSolicitud || "No disponible"],
            ["Ubicación", programacionActual.ubicacionSolicitud || "No disponible"],
            ["Fecha de registro", formatearFechaHora(programacionActual.fechaRegistro)],
            ["Fecha de ejecución", formatearFecha(programacionActual.fechaEjecucion)],
            ["Estado", formatearEstado(programacionActual.estado)],
            [
                "Jefe de unidad",
                `${programacionActual.nombreJefeUnidad || ""} ${programacionActual.apellidoJefeUnidad || ""}`.trim() || "No disponible"
            ]
        ],
        styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 3,
            textColor: negro,
            overflow: "linebreak"
        },
        headStyles: {
            fillColor: rojo,
            textColor: [255, 255, 255],
            fontStyle: "bold"
        },
        alternateRowStyles: {
            fillColor: grisClaro
        },
        columnStyles: {
            0: { cellWidth: 55, fontStyle: "bold" },
            1: { cellWidth: "auto" }
        }
    });

    posicionY = documento.lastAutoTable.finalY + 10;

    documento.setFont("helvetica", "bold");
    documento.setFontSize(12);
    documento.setTextColor(...negro);
    documento.text("2. Descripción de la solicitud", 15, posicionY);

    posicionY += 7;

    posicionY = dibujarTextoReporte(
        documento,
        programacionActual.descripcionSolicitud || "Sin descripción registrada.",
        posicionY
    );

    posicionY += 7;

    documento.setFont("helvetica", "bold");
    documento.setFontSize(12);
    documento.setTextColor(...negro);
    documento.text("3. Recomendaciones", 15, posicionY);

    posicionY += 5;

    documento.autoTable({
        startY: posicionY,
        theme: "grid",
        margin: { left: 15, right: 15 },
        head: [["Recomendación", "Detalle"]],
        body: [
            [
                "Cantidad de unidades recomendadas",
                String(programacionActual.cantidadUnidades ?? "No especificada")
            ],
            [
                "Razón de la cantidad de unidades",
                programacionActual.razonCantidadUnidades || "Sin recomendaciones"
            ],
            [
                "Equipos de seguridad",
                programacionActual.equipoSeguridad || "Sin recomendaciones"
            ],
            [
                "Otras recomendaciones",
                programacionActual.otrasRecomendaciones || "Sin recomendaciones"
            ]
        ],
        styles: {
            font: "helvetica",
            fontSize: 9,
            cellPadding: 3,
            textColor: negro,
            overflow: "linebreak"
        },
        headStyles: {
            fillColor: rojo,
            textColor: [255, 255, 255],
            fontStyle: "bold"
        },
        alternateRowStyles: {
            fillColor: grisClaro
        },
        columnStyles: {
            0: { cellWidth: 65, fontStyle: "bold" },
            1: { cellWidth: "auto" }
        }
    });

    documento.addPage("a4", "landscape");

    dibujarEncabezadoReporte(
        documento,
        "REPORTE DE PROGRAMACIÓN",
        "UNIDADES ASIGNADAS"
    );

    documento.setFont("helvetica", "bold");
    documento.setFontSize(12);
    documento.setTextColor(...negro);
    documento.text("4. Detalle de unidades asignadas", 15, 48);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(9);
    documento.setTextColor(...gris);

    documento.text(
        `Programación: PROG-${programacionActual.idProgramacion}`,
        15,
        55
    );

    documento.text(
        `Total de unidades: ${unidadesActuales.length}`,
        15,
        61
    );

    documento.autoTable({
        startY: 68,
        theme: "grid",
        margin: {
            top: 15,
            left: 10,
            right: 10,
            bottom: 20
        },
        head: [[
            "Código",
            "Tipo de vehículo",
            "Placa",
            "Marca",
            "Modelo",
            "Capacidad (lb)",
            "Transportista",
            "Celular"
        ]],
        body: unidadesActuales.map(unidad => [
            String(unidad.idDetalle),
            formatearTipoVehiculo(unidad.tipoVehiculo),
            unidad.placa || "No disponible",
            unidad.marca || "No disponible",
            unidad.modelo || "No disponible",
            String(unidad.capacidadLibras ?? "No disponible"),
            `${unidad.nombreTransportista || ""} ${unidad.apellidoTransportista || ""}`.trim() || "No disponible",
            unidad.celular || "No disponible"
        ]),
        styles: {
            font: "helvetica",
            fontSize: 8,
            cellPadding: 3,
            textColor: negro,
            overflow: "linebreak",
            valign: "middle"
        },
        headStyles: {
            fillColor: rojo,
            textColor: [255, 255, 255],
            fontStyle: "bold",
            halign: "center"
        },
        alternateRowStyles: {
            fillColor: grisClaro
        },
        columnStyles: {
            0: { cellWidth: 15, halign: "center" },
            1: { cellWidth: 32 },
            2: { cellWidth: 23, halign: "center" },
            3: { cellWidth: 25 },
            4: { cellWidth: 25 },
            5: { cellWidth: 27, halign: "center" },
            6: { cellWidth: 47 },
            7: { cellWidth: "auto", halign: "center" }
        },
        didDrawPage: function () {
            dibujarPieReporte(documento, fechaGeneracion);
        }
    });

    documento.setPage(1);
    dibujarPieReporte(documento, fechaGeneracion);

    documento.save(
        `Reporte_Programacion_${programacionActual.idProgramacion}.pdf`
    );
}


function dibujarEncabezadoReporte(documento, titulo, subtitulo) {
    const rojo = [255, 49, 49];
    const gris = [90, 90, 90];

    documento.setFillColor(...rojo);
    documento.rect(0, 0, documento.internal.pageSize.getWidth(), 5, "F");

    documento.setFont("helvetica", "bold");
    documento.setFontSize(22);
    documento.setTextColor(...rojo);
    documento.text("Ecotrack", 15, 20);

    documento.setFont("helvetica", "bold");
    documento.setFontSize(14);
    documento.setTextColor(35, 35, 35);
    documento.text(titulo, 15, 30);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(9);
    documento.setTextColor(...gris);
    documento.text("LOGÍSTICA DE RECUPERACIÓN DE RECURSOS", 15, 36);
    documento.text(subtitulo, 15, 42);

    documento.setDrawColor(...rojo);
    documento.setLineWidth(0.4);
    documento.line(
        15,
        45,
        documento.internal.pageSize.getWidth() - 15,
        45
    );
}

function dibujarTextoReporte(documento, texto, posicionY) {
    const margenIzquierdo = 15;
    const anchoMaximo = documento.internal.pageSize.getWidth() - 30;

    documento.setFont("helvetica", "normal");
    documento.setFontSize(9);
    documento.setTextColor(60, 60, 60);

    const lineas = documento.splitTextToSize(
        String(texto),
        anchoMaximo
    );

    documento.text(lineas, margenIzquierdo, posicionY);

    return posicionY + (lineas.length * 4.5);
}

function dibujarPieReporte(documento, fechaGeneracion) {
    const ancho = documento.internal.pageSize.getWidth();
    const alto = documento.internal.pageSize.getHeight();

    documento.setDrawColor(210, 210, 210);
    documento.setLineWidth(0.3);
    documento.line(10, alto - 15, ancho - 10, alto - 15);

    documento.setFont("helvetica", "normal");
    documento.setFontSize(8);
    documento.setTextColor(110, 110, 110);

    documento.text(
        `Ecotrack | Generado: ${fechaGeneracion}`,
        10,
        alto - 9
    );

    documento.text(
        `Página ${documento.internal.getCurrentPageInfo().pageNumber}`,
        ancho - 10,
        alto - 9,
        { align: "right" }
    );
}
