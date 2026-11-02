
const API_URL = "http://localhost:8080/api/programacion/mis-programaciones";

let programacionActual = null;
let unidadesActuales = [];

document.addEventListener("DOMContentLoaded", async () => {
    verificarRolPermitido(["JEFE_UNIDAD", "ADMINISTRADOR"]);

    const idProgramacion = obtenerIdProgramacion();

    if (!idProgramacion) {
        mostrarMensaje("El código de programación no es válido.", "danger");
        return;
    }

    configurarEventos();
    await cargarInformacion(idProgramacion);
});

// =====================================================
// CONFIGURACIÓN
// =====================================================

function configurarEventos() {
    document.getElementById("volver").addEventListener("click", volverAProgramaciones);
    document.getElementById("generar-reporte").addEventListener("click", generarReporte);
}

function obtenerIdProgramacion() {
    const parametros = new URLSearchParams(window.location.search);
    const id = parametros.get("id");

    if (!id || !/^[1-9]\d*$/.test(id)) {
        return null;
    }

    return Number(id);
}

// =====================================================
// CARGA DE INFORMACIÓN
// =====================================================

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
        renderizarUnidades(unidadesActuales);

        document.getElementById("volver").disabled = false;

    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al cargar la programación.", "danger");
    } finally {
        mostrarPantallaCarga(false);
    }
}

// =====================================================
// INFORMACIÓN DE LA PROGRAMACIÓN
// =====================================================

function renderizarProgramacion(programacion) {
    const contenedor = document.getElementById("informacion-programacion");

    const estado = formatearEstado(programacion.estado);

    contenedor.innerHTML = `
        <div class="row g-3">
            <div class="col-md-4">
                <strong>Código de programación:</strong>
                <p>${escaparHTML(programacion.idProgramacion)}</p>
            </div>

            <div class="col-md-4">
                <strong>Código de solicitud:</strong>
                <p>${escaparHTML(programacion.idSolicitud)}</p>
            </div>

            <div class="col-md-4">
                <strong>Estado:</strong>
                <p>${escaparHTML(estado)}</p>
            </div>

            <div class="col-md-4">
                <strong>Fecha de ejecución:</strong>
                <p>${formatearFecha(programacion.fechaEjecucion)}</p>
            </div>

            <div class="col-md-4">
                <strong>Jefe de unidad:</strong>
                <p>${escaparHTML(
                    `${programacion.nombreJefeUnidad || ""} ${programacion.apellidoJefeUnidad || ""}`.trim() || "No disponible"
                )}</p>
            </div>

            <div class="col-md-4">
                <strong>Fecha de registro:</strong>
                <p>${formatearFechaHora(programacion.fechaRegistro)}</p>
            </div>

            <div class="col-md-6">
                <strong>Título de la solicitud:</strong>
                <p>${escaparHTML(programacion.tituloSolicitud || "No disponible")}</p>
            </div>

            <div class="col-md-6">
                <strong>Ubicación:</strong>
                <p>${escaparHTML(programacion.ubicacionSolicitud || "No disponible")}</p>
            </div>

            <div class="col-12">
                <strong>Descripción:</strong>
                <p>${escaparHTML(programacion.descripcionSolicitud || "No disponible")}</p>
            </div>
        </div>
    `;

    renderizarRecomendaciones(programacion);
}

// =====================================================
// RECOMENDACIONES
// =====================================================

function renderizarRecomendaciones(programacion) {
    const contenedor = document.getElementById("informacion-recomendaciones");

    contenedor.innerHTML = `
        <div class="row g-3">
            <div class="col-md-4">
                <strong>Cantidad de unidades recomendadas:</strong>
                <p>${escaparHTML(programacion.cantidadUnidades ?? "No especificada")}</p>
            </div>

            <div class="col-12">
                <strong>Razón de la cantidad de unidades:</strong>
                <p>${escaparHTML(programacion.razonCantidadUnidades || "Sin recomendaciones")}</p>
            </div>

            <div class="col-12">
                <strong>Equipos de seguridad:</strong>
                <p>${escaparHTML(programacion.equipoSeguridad || "Sin recomendaciones")}</p>
            </div>

            <div class="col-12">
                <strong>Otras recomendaciones:</strong>
                <p>${escaparHTML(programacion.otrasRecomendaciones || "Sin recomendaciones")}</p>
            </div>
        </div>
    `;
}

// =====================================================
// UNIDADES ASIGNADAS
// =====================================================

function renderizarUnidades(unidades) {
    const tbody = document.getElementById("tabla-unidades");
    const total = document.getElementById("total-unidades");

    total.textContent = unidades.length;

    if (unidades.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center py-4">
                    No hay unidades asignadas a esta programación.
                </td>
            </tr>
        `;
    } else {
        tbody.innerHTML = unidades.map(unidad => `
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
            </tr>
        `).join("");
    }

    // El reporte requiere al menos una unidad activa.
    document.getElementById("generar-reporte").disabled = unidades.length === 0;
}

// =====================================================
// NAVEGACIÓN
// =====================================================

function volverAProgramaciones() {
    window.location.href = "/pages/programacion/gestionarMisProgramaciones.html";
}

// =====================================================
// PETICIONES HTTP
// =====================================================

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
    let resultado;

    try {
        resultado = await respuesta.json();
    } catch {
        throw new Error("El servidor devolvió una respuesta no válida.");
    }

    if (!respuesta.ok) {
        throw new Error(resultado.message || "No se pudo completar la solicitud.");
    }

    return resultado;
}

// =====================================================
// UTILIDADES
// =====================================================

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

    // =================================================
    // PÁGINA 1: DATOS DE LA PROGRAMACIÓN
    // =================================================

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

    // Descripción de la solicitud
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

    // Recomendaciones
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

    // =================================================
    // PÁGINA 2: UNIDADES ASIGNADAS
    // =================================================

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

    // Pie de página de la primera página
    documento.setPage(1);
    dibujarPieReporte(documento, fechaGeneracion);

    // Descargar PDF
    documento.save(
        `Reporte_Programacion_${programacionActual.idProgramacion}.pdf`
    );
}


// =====================================================
// ENCABEZADO DEL REPORTE
// =====================================================

function dibujarEncabezadoReporte(documento, titulo, subtitulo) {
    const rojo = [255, 49, 49];
    const gris = [90, 90, 90];

    documento.setFillColor(...rojo);
    documento.rect(0, 0, documento.internal.pageSize.getWidth(), 5, "F");

    documento.setFont("helvetica", "bold");
    documento.setFontSize(22);
    documento.setTextColor(...rojo);
    documento.text("EcoTrack", 15, 20);

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

// =====================================================
// TEXTO CON AJUSTE AUTOMÁTICO
// =====================================================

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

// =====================================================
// PIE DE PÁGINA
// =====================================================

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
        `EcoTrack | Generado: ${fechaGeneracion}`,
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
