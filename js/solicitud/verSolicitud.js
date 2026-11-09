
const API_URL = "http://localhost:8080/api/solicitud";

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const detalleContainer = document.getElementById("detalle-solicitud");
    const mensajeContainer = document.getElementById("mensaje-container");

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    if (!idSolicitud || !/^\d+$/.test(idSolicitud)) {
        mostrarMensaje("El código de solicitud no es válido.", "warning");
        detalleContainer.innerHTML = "";
        return;
    }

    await cargarSolicitud();

    async function cargarSolicitud() {
        try {
            const response = await fetchAutenticado(
                `${API_URL}/buscar/${idSolicitud}`
            );

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                detalleContainer.innerHTML = "";
                return;
            }

            if (!resultado.data || typeof resultado.data !== "object") {
                throw new Error("El servidor devolvió un detalle de solicitud no válido.");
            }

            renderizarSolicitud(resultado.data);

        } catch (error) {
            detalleContainer.innerHTML = "";

            mostrarMensaje(
                error.message || "No se pudo obtener una respuesta del servidor.",
                "danger"
            );
        }
    }

    function renderizarSolicitud(solicitud) {
        const secciones = [
            {
                titulo: "Información de la solicitud",
                icono: "bi-file-earmark-text",
                color: "primary",
                resumen: "Datos principales y ubicación del servicio",
                campos: [
                    "idSolicitud",
                    "titulo",
                    "descripcion",
                    "ubicacion",
                    "fechaRegistro",
                    "fechaFinalizacion",
                    "estado"
                ]
            },
            {
                titulo: "Datos del solicitante",
                icono: "bi-person",
                color: "info",
                resumen: "Información de contacto de la persona solicitante",
                campos: [
                    "nombreUsuario",
                    "apellidoUsuario",
                    "correo",
                    "celular"
                ]
            },
            {
                titulo: "Unidades y recomendaciones",
                icono: "bi-box-seam",
                color: "success",
                resumen: "Recursos y medidas recomendadas para la atención",
                campos: [
                    "cantidadUnidades",
                    "razonCantidadUnidades",
                    "equipoSeguridad",
                    "otrasRecomendaciones"
                ]
            },
            {
                titulo: "Fases y seguimiento",
                icono: "bi-list-check",
                color: "dark",
                resumen: "Avance y actividades relacionadas a la solicitud",
                campos: []
            }
        ];

        detalleContainer.innerHTML = `
            <div class="d-flex flex-wrap justify-content-between align-items-start gap-3 mb-4">
                <div>
                    <span class="text-secondary small">Código de solicitud</span>
                    <h2 class="h3 fw-bold mb-0">
                        #${escaparHTML(solicitud.idSolicitud ?? "-")}
                    </h2>
                </div>

                <span class="badge rounded-pill fs-6 estado-badge"
                    data-estado="${escaparHTML(solicitud.estado ?? "")}">
                    ${escaparHTML(solicitud.estado || "SIN ESTADO")}
                </span>
            </div>

            <hr class="text-secondary opacity-25">

            ${secciones.map(seccion => `
                <section class="card border-0 shadow-sm rounded-4 overflow-hidden mb-4">
                    <div class="card-header bg-${seccion.color}-subtle border-0 border-start border-4 border-${seccion.color} px-3 px-md-4 py-3">
                        <div class="d-flex align-items-center gap-3">
                            <span class="d-inline-flex align-items-center justify-content-center rounded-3 bg-white text-${seccion.color} shadow-sm flex-shrink-0"
                                  style="width: 2.75rem; height: 2.75rem;">
                                <i class="bi ${seccion.icono} fs-5"></i>
                            </span>
                            <div>
                                <h3 class="h5 fw-bold mb-1">${seccion.titulo}</h3>
                                <p class="small text-secondary mb-0">${seccion.resumen}</p>
                            </div>
                        </div>
                    </div>
                    <div class="card-body p-3 p-md-4">
                        ${seccion.titulo === "Fases y seguimiento"
                            ? renderizarSeguimiento(solicitud)
                            : `<div class="row g-3">
                                ${seccion.campos.map(campo =>
                                    renderizarCampo(campo, solicitud[campo], solicitud.fases)
                                ).join("")}
                            </div>`}
                    </div>
                </section>
            `).join("")}

            <div class="d-flex justify-content-end mt-4">
                <a href="/pages/solicitud/gestionarMisSolicitudes.html"
                   class="btn btn-outline-secondary btn-accion-cancelar">
                    <i class="bi bi-arrow-left me-2"></i>
                    Volver al listado
                </a>
            </div>
        `;
    }

    function renderizarCampo(nombre, valor, fases = []) {
        const etiqueta = escaparHTML(formatearEtiqueta(nombre));

        if (Array.isArray(valor)) {
            if (["unidades", "materiales"].includes(nombre)) {
                return `
                    <div class="col-12">
                        ${renderizarTabla(nombre, valor)}
                    </div>
                `;
            }

            const contenido = valor.length
                ? valor.map((elemento, indice) => `
                    <div class="border rounded-3 bg-white p-3 ${indice < valor.length - 1 ? "mb-2" : ""}">
                        ${valor.length > 1
                            ? `<h4 class="h6 fw-semibold mb-3">${etiqueta} ${indice + 1}</h4>`
                            : ""}
                        ${renderizarContenido(elemento, nombre)}
                    </div>
                `).join("")
                : '<p class="text-secondary mb-0">Sin registros</p>';

            return `
                <div class="col-12">
                    <div class="bg-light rounded-3 p-3 h-100">
                        <span class="text-secondary small fw-semibold">${etiqueta}</span>
                        <div class="mt-2">${contenido}</div>
                    </div>
                </div>
            `;
        }

        if (valor && typeof valor === "object") {
            const estilo = obtenerEstiloDetalle(nombre, fases);

            return `
                <div class="col-12">
                    <div class="rounded-3 border border-start border-4 border-${estilo.color} bg-${estilo.color}-subtle p-3 p-md-4">
                        <div class="d-flex align-items-center gap-2 mb-3">
                            <i class="bi ${estilo.icono} text-${estilo.color} fs-5"></i>
                            <h4 class="h6 fw-bold mb-0">${etiqueta}</h4>
                        </div>
                        ${renderizarContenido(valor, nombre, estilo)}
                    </div>
                </div>
            `;
        }

        const valorFormateado = valor == null
            ? (nombre === "fechaFinalizacion" ? "Pendiente" : "No disponible")
            : escaparHTML(formatearValor(valor, nombre));
        const textoLargo = ["descripcion", "observacion"].includes(nombre);
        const ubicacion = nombre === "ubicacion";
        const esFecha = nombre === "fechaRegistro";
        const esTitulo = nombre === "titulo";
        const claseColumna = textoLargo || esTitulo
            ? "col-12"
            : nombre === "cantidadUnidades"
                ? "col-12 col-md-4 col-xl-3"
                : "col-12 col-md-6 col-xl-4";
        const iconoCampo = obtenerIconoCampo(nombre);
        const estiloEspecial = ubicacion
            ? {
                contenedor: "border-danger-subtle bg-danger-subtle",
                icono: "bg-white text-danger",
                texto: "text-danger-emphasis"
            }
            : esFecha
                ? {
                    contenedor: "border-primary-subtle bg-primary-subtle",
                    icono: "bg-white text-primary",
                    texto: "text-primary-emphasis"
                }
                : null;

        return `
            <div class="${claseColumna}">
                <div class="rounded-3 border ${estiloEspecial?.contenedor || `bg-${esTitulo ? "primary-subtle" : "white"}`} p-3 h-100">
                    <div class="d-flex align-items-center gap-2 mb-2">
                        ${estiloEspecial
                            ? `<span class="d-inline-flex align-items-center justify-content-center rounded-circle ${estiloEspecial.icono} flex-shrink-0" style="width: 2rem; height: 2rem;"><i class="bi ${iconoCampo}"></i></span>`
                            : `<i class="bi ${iconoCampo} text-${esTitulo ? "primary" : "secondary"}"></i>`}
                        <span class="small text-secondary fw-semibold text-break">${etiqueta}</span>
                    </div>
                    <p class="${esTitulo ? "fs-5" : ""} ${estiloEspecial?.texto || ""} fw-semibold mb-0 text-break"
                       ${textoLargo ? 'style="white-space: pre-line;"' : ""}>
                        ${valorFormateado}
                    </p>
                </div>
            </div>
        `;
    }

    function obtenerIconoCampo(nombre) {
        const iconos = {
            idSolicitud: "bi-hash",
            titulo: "bi-card-heading",
            descripcion: "bi-text-paragraph",
            ubicacion: "bi-geo-alt",
            fechaRegistro: "bi-calendar-event",
            fechaFinalizacion: "bi-calendar-check",
            estado: "bi-activity",
            nombreUsuario: "bi-person",
            apellidoUsuario: "bi-person",
            correo: "bi-envelope",
            celular: "bi-telephone",
            cantidadUnidades: "bi-box-seam",
            razonCantidadUnidades: "bi-chat-left-text",
            equipoSeguridad: "bi-shield-check",
            otrasRecomendaciones: "bi-lightbulb"
        };

        return iconos[nombre] || "bi-info-circle";
    }

    function renderizarSeguimiento(solicitud) {
        const fases = Array.isArray(solicitud.fases) ? solicitud.fases : [];

        if (fases.length === 0) {
            return `
                <div class="alert alert-light border d-flex align-items-center gap-3 mb-0" role="status">
                    <i class="bi bi-info-circle fs-4 text-secondary"></i>
                    <div>
                        <p class="fw-semibold mb-1">Aún no hay fases registradas</p>
                        <p class="small text-secondary mb-0">El seguimiento aparecerá aquí cuando avance la solicitud.</p>
                    </div>
                </div>
            `;
        }

        return `
            <div class="d-flex flex-column gap-3">
                ${fases.map((fase, indice) => {
                    const estilo = obtenerEstiloFase(indice);
                    const componente = obtenerComponenteFase(fase, indice);
                    const estado = fase.estado
                        ? escaparHTML(formatearValor(fase.estado, "estado"))
                        : "Sin estado";
                    const fechaInicio = fase.fechaInicio
                        ? escaparHTML(formatearValor(fase.fechaInicio, "fechaInicio"))
                        : "Pendiente";
                    const mostrarFechaFin = faseTieneFechaFinalizacion(fase, indice);
                    const fechaFin = mostrarFechaFin && fase.fechaFinalizacion
                        ? escaparHTML(formatearValor(fase.fechaFinalizacion, "fechaFinalizacion"))
                        : "Pendiente";

                    return `
                        <article class="card border border-2 border-${estilo.color} bg-${estilo.color}-subtle shadow-sm overflow-hidden">
                            <div class="card-header bg-${estilo.color}-subtle border-0 px-3 px-md-4 py-3">
                                <div class="d-flex flex-wrap justify-content-between align-items-center gap-3">
                                    <div class="d-flex align-items-center gap-3">
                                        <span class="d-inline-flex align-items-center justify-content-center rounded-circle bg-white text-${estilo.color} shadow-sm flex-shrink-0"
                                              style="width: 2.75rem; height: 2.75rem;">
                                            <i class="bi ${estilo.icono} fs-5"></i>
                                        </span>
                                        <div>
                                            <span class="small text-secondary">Fase ${indice + 1}</span>
                                            <h4 class="h6 fw-bold mb-0 text-break">
                                                ${escaparHTML(fase.nombreFase || "Fase sin nombre")}
                                            </h4>
                                        </div>
                                    </div>
                                    <span class="badge rounded-pill bg-${estilo.color}-subtle text-${estilo.color} border border-${estilo.color}-subtle px-3 py-2">${estado}</span>
                                </div>
                            </div>
                            <div class="card-body bg-${estilo.color}-subtle p-3 p-md-4">
                                ${fase.descripcion
                                    ? `<p class="text-secondary mb-3 text-break" style="white-space: pre-line;">${escaparHTML(fase.descripcion)}</p>`
                                    : ""}

                                <div class="row g-2 mb-${componente && solicitud[componente] ? "4" : "0"}">
                                    <div class="col-12 ${mostrarFechaFin ? "col-sm-6" : ""}">
                                        <div class="bg-white border border-${estilo.color}-subtle rounded-3 px-3 py-2 h-100">
                                            <span class="d-block text-secondary small mb-1">
                                                <i class="bi bi-play-circle me-1"></i>Fecha de inicio
                                            </span>
                                            <span class="small fw-semibold text-break">${fechaInicio}</span>
                                        </div>
                                    </div>
                                    ${mostrarFechaFin ? `
                                        <div class="col-12 col-sm-6">
                                            <div class="bg-white border border-${estilo.color}-subtle rounded-3 px-3 py-2 h-100">
                                                <span class="d-block text-secondary small mb-1">
                                                    <i class="bi bi-flag me-1"></i>Fecha de finalización
                                                </span>
                                                <span class="small fw-semibold text-break">${fechaFin}</span>
                                            </div>
                                        </div>
                                    ` : ""}
                                </div>

                                ${componente && solicitud[componente]
                                    ? renderizarDetalleFase(componente, solicitud[componente], estilo)
                                    : ""}
                            </div>
                        </article>
                    `;
                }).join("")}
            </div>
        `;
    }

    function renderizarDetalleFase(nombre, detalle, estilo) {
        if (!detalle || typeof detalle !== "object") {
            return "";
        }

        return `
            <section class="rounded-3 border border-${estilo.color} bg-white overflow-hidden">
                <div class="d-flex align-items-center gap-2 bg-${estilo.color}-subtle border-bottom border-${estilo.color}-subtle px-3 px-md-4 py-2">
                    <i class="bi ${estilo.icono} text-${estilo.color}"></i>
                    <h5 class="h6 fw-bold mb-0 text-${estilo.color}">${escaparHTML(formatearEtiqueta(nombre))}</h5>
                </div>
                <div class="p-3 p-md-4">
                    ${renderizarContenido(detalle, nombre, estilo)}
                </div>
            </section>
        `;
    }

    function obtenerComponenteFase(fase, indice) {
        const nombre = normalizarTexto(fase?.nombreFase);
        const componentes = [
            { nombre: "pagoInicial", alias: ["pago inicial"] },
            { nombre: "pagoTotal", alias: ["pago total"] },
            { nombre: "programacion", alias: ["programacion", "asignacion de unidades"] },
            { nombre: "ejecucion", alias: ["ejecucion", "recojo", "recoleccion"] },
            { nombre: "finalizacion", alias: ["finalizacion", "cierre"] }
        ];
        const componenteCoincidente = componentes.find(componente =>
            componente.alias.some(alias => nombre.includes(normalizarTexto(alias)))
        );

        if (componenteCoincidente) {
            return componenteCoincidente.nombre;
        }

        return {
            1: "pagoInicial",
            2: "pagoTotal",
            3: "programacion",
            4: "ejecucion",
            5: "finalizacion"
        }[indice] || null;
    }

    function renderizarTabla(nombre, filas, estilo = { color: "secondary" }) {
        const columnas = filas.length && filas[0] && typeof filas[0] === "object"
            ? Object.keys(filas[0])
            : [];
        const etiqueta = escaparHTML(formatearEtiqueta(nombre));

        if (!filas.length || !columnas.length) {
            return `
                <div class="rounded-3 border bg-white p-3 p-md-4 h-100">
                    <h4 class="h6 fw-bold mb-3">${etiqueta}</h4>
                    <p class="text-secondary mb-0">No hay registros disponibles.</p>
                </div>
            `;
        }

        return `
            <div class="rounded-3 border border-start border-4 border-${estilo.color} bg-white p-3 p-md-4">
                <div class="d-flex flex-wrap justify-content-between align-items-center gap-2 mb-3">
                    <div>
                        <h4 class="h6 fw-bold mb-1">${etiqueta}</h4>
                        <p class="small text-secondary mb-0">${filas.length} ${filas.length === 1 ? "registro" : "registros"}</p>
                    </div>
                    <span class="badge rounded-pill bg-${estilo.color}-subtle text-${estilo.color}">
                        <i class="bi bi-table me-1"></i>Detalle
                    </span>
                </div>
                <div class="table-responsive rounded-3 border">
                    <table class="table table-hover table-striped align-middle mb-0">
                        <thead class="table-light">
                            <tr>
                                ${columnas.map(columna => `
                                    <th scope="col" class="text-nowrap">${escaparHTML(formatearEtiqueta(columna))}</th>
                                `).join("")}
                            </tr>
                        </thead>
                        <tbody>
                            ${filas.map(fila => `
                                <tr>
                                    ${columnas.map(columna => `
                                        <td class="text-break">
                                            ${escaparHTML(
                                                fila[columna] == null
                                                    ? "No disponible"
                                                    : formatearValor(fila[columna], columna)
                                            )}
                                        </td>
                                    `).join("")}
                                </tr>
                            `).join("")}
                        </tbody>
                    </table>
                </div>
            </div>
        `;
    }

    function obtenerEstiloFase(indice) {
        const estilos = [
            { color: "primary", icono: "bi-file-earmark-text" },
            { color: "info", icono: "bi-credit-card" },
            { color: "warning", icono: "bi-patch-check" },
            { color: "success", icono: "bi-truck" },
            { color: "danger", icono: "bi-recycle" },
            { color: "secondary", icono: "bi-cash-coin" },
            { color: "dark", icono: "bi-flag" }
        ];

        return estilos[indice % estilos.length];
    }

    function obtenerEstiloDetalle(nombre, fases) {
        const aliasPorDetalle = {
            pagoInicial: ["pago inicial"],
            programacion: ["programacion", "asignacion de unidades"],
            ejecucion: ["ejecucion", "recojo", "recoleccion"],
            pagoTotal: ["pago total"],
            finalizacion: ["finalizacion", "cierre"]
        };
        const alias = aliasPorDetalle[nombre] || [];
        const indiceFase = Array.isArray(fases)
            ? fases.findIndex(fase => {
                const nombreFase = normalizarTexto(fase?.nombreFase);
                return alias.some(nombreRelacionado =>
                    nombreFase.includes(normalizarTexto(nombreRelacionado))
                );
            })
            : -1;

        return indiceFase >= 0
            ? obtenerEstiloFase(indiceFase)
            : { color: "secondary", icono: "bi-info-circle" };
    }

    function normalizarTexto(valor) {
        return String(valor || "")
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .toLowerCase()
            .replace(/[^a-z0-9]+/g, " ")
            .trim();
    }

    function faseTieneFechaFinalizacion(fase, indice) {
        const nombre = normalizarTexto(fase?.nombreFase);

        if (/registro|pago inicial|pago total|ejecucion/.test(nombre)) {
            return false;
        }

        if (/programacion|finalizacion/.test(nombre)) {
            return true;
        }

        return ![0, 1, 2, 4].includes(indice);
    }

    function camposNoDisponibles(componente) {
        const camposPorComponente = {
            pagoInicial: ["fechaConfirmacion"],
            pagoTotal: ["fechaConfirmacion"],
            programacion: ["observacion"],
            ejecucion: ["fechaFinalizacion", "observacion"],
            finalizacion: ["observacion"]
        };

        return camposPorComponente[componente] || [];
    }

    function renderizarContenido(valor, nombre = "", estilo = { color: "secondary" }) {
        if (Array.isArray(valor) && ["unidades", "materiales"].includes(nombre)) {
            return renderizarTabla(nombre, valor, estilo);
        }

        if (Array.isArray(valor)) {
            return valor.length
                ? `<div class="row g-2">${valor.map((elemento, indice) => `
                    <div class="col-12">
                        <div class="rounded-3 bg-light p-2">
                            ${valor.length > 1
                                ? `<span class="small text-secondary fw-semibold d-block mb-2 text-break">${escaparHTML(formatearEtiqueta(nombre))} ${indice + 1}</span>`
                                : ""}
                            ${renderizarContenido(elemento, nombre, estilo)}
                        </div>
                    </div>
                `).join("")}</div>`
                : '<p class="text-secondary mb-0">Sin registros</p>';
        }

        if (valor && typeof valor === "object") {
            const camposExcluir = camposNoDisponibles(nombre);
            const campos = Object.entries(valor).filter(
                ([nombreCampo]) => !camposExcluir.includes(nombreCampo)
            );

            return campos.length
                ? `<div class="row g-2">${campos.map(([nombreCampo, contenido]) => `
                    <div class="${["unidades", "materiales"].includes(nombreCampo) ? "col-12" : "col-12 col-md-6 col-xl-4"}">
                        <div class="bg-light rounded-3 p-3 h-100">
                            <span class="small text-secondary d-block mb-1 text-break">${escaparHTML(formatearEtiqueta(nombreCampo))}</span>
                            <div class="small fw-semibold text-break">${renderizarContenido(contenido, nombreCampo, estilo)}</div>
                        </div>
                    </div>
                `).join("")}</div>`
                : '<p class="text-secondary mb-0">Sin información</p>';
        }

        return `<span class="d-block text-break">${valor == null
            ? "No disponible"
            : escaparHTML(formatearValor(valor, nombre))}</span>`;
    }

    function formatearEtiqueta(nombre) {
        const etiquetas = {
            idSolicitud: "Código de solicitud",
            idProgramacion: "Código de programación",
            idArticuloRecuperado: "Código de material recuperado",
            nombreUsuario: "Nombre",
            apellidoUsuario: "Apellido",
            nombreFase: "Fase",
            estado: "Estado",
            monto: "Monto",
            pesoTotal: "Peso total",
            fechaConfirmacion: "Fecha de confirmación",
            fechaEjecucion: "Fecha de ejecución",
            fechaInicio: "Fecha de inicio",
            fechaRegistro: "Fecha de registro",
            fechaFinalizacion: "Fecha de finalización",
            unidades: "Unidades asignadas",
            materiales: "Materiales recuperados",
            articulo: "Artículo",
            cantidad: "Cantidad",
            cantidadUnidades: "Cantidad de unidades",
            razonCantidadUnidades: "Razón de la cantidad de unidades",
            equipoSeguridad: "Equipo de seguridad",
            otrasRecomendaciones: "Otras recomendaciones",
            observacion: "Observación",
            pagoInicial: "Pago inicial",
            pagoTotal: "Pago total"
        };

        return etiquetas[nombre] || nombre
            .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
            .replace(/_/g, " ")
            .replace(/^./, caracter => caracter.toUpperCase());
    }

    function formatearValor(valor, nombre = "") {
        if (typeof valor === "number" && /monto/i.test(nombre)) {
            return `S/ ${valor.toFixed(2)}`;
        }

        if (typeof valor === "string") {
            if (/^\d{4}-\d{2}-\d{2}$/.test(valor)) {
                const [anio, mes, dia] = valor.split("-").map(Number);
                return new Date(anio, mes - 1, dia).toLocaleDateString("es-PE");
            }

            if (/^\d{4}-\d{2}-\d{2}T/.test(valor)) {
                const fecha = new Date(valor);
                if (!Number.isNaN(fecha.getTime())) {
                    return fecha.toLocaleString("es-PE");
                }
            }

            if (/estado/i.test(nombre)) {
                return valor.replace(/_/g, " ");
            }
        }

        return String(valor);
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
