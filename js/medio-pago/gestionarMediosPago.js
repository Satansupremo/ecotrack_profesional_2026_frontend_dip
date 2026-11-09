const API_URL = "http://localhost:8080/api/medio-pago";
const CLAVE_PAGINA = "paginaGestionarMediosPago";

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalPaginas = 0;
let mediosPago = [];
let idMedioPagoEnEdicion = null;
let modalMedioPago;
let modalConfirmarEstado;
let medioPagoPendienteEstado = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!verificarRolPermitido(["ADMINISTRADOR"])) {
        return;
    }

    modalMedioPago = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalMedioPago")
    );
    modalConfirmarEstado = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalConfirmarEstado")
    );

    document.getElementById("btnNuevoMedioPago").addEventListener("click", abrirFormularioNuevo);
    document.getElementById("formMedioPago").addEventListener("submit", guardarMedioPago);
    document.getElementById("btnConfirmarEstado").addEventListener("click", confirmarCambioEstado);
    document.getElementById("buscarMedioPago").addEventListener("input", filtrarMediosPago);
    document.getElementById("btnLimpiarBusqueda").addEventListener("click", limpiarBusqueda);
    document.getElementById("pagina-anterior").addEventListener("click", () => cambiarPagina(paginaActual - 1));
    document.getElementById("pagina-siguiente").addEventListener("click", () => cambiarPagina(paginaActual + 1));
    document.getElementById("tablaMediosPago").addEventListener("click", manejarAccionTabla);
    document.getElementById("modalMedioPago").addEventListener("hidden.bs.modal", limpiarFormulario);
    document.getElementById("modalConfirmarEstado").addEventListener("hidden.bs.modal", () => {
        medioPagoPendienteEstado = null;
    });

    await cargarMediosPago();
    ocultarPantallaCarga();
});

async function cargarMediosPago(limpiarMensaje = true, conservarTabla = false) {
    if (limpiarMensaje) {
        mostrarMensaje("", "");
    }

    const tabla = document.getElementById("tablaMediosPago");
    tabla.classList.toggle("tabla-cargando", conservarTabla);
    tabla.setAttribute("aria-busy", "true");

    if (!conservarTabla) {
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-secondary py-4">
                    <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                    Cargando medios de pago...
                </td>
            </tr>
        `;
    }

    try {
        const respuestaPaginas = await fetchAutenticado(`${API_URL}/paginas`);
        const resultadoPaginas = await respuestaPaginas.json();

        if (!respuestaPaginas.ok || !resultadoPaginas.success) {
            throw new Error(resultadoPaginas.message || "No se pudo obtener la cantidad de páginas.");
        }

        totalPaginas = Number(resultadoPaginas.data) || 0;
        if (totalPaginas === 0) {
            paginaActual = 0;
            mediosPago = [];
            renderizarMediosPago();
            renderizarPaginacion();
            return true;
        }

        if (paginaActual >= totalPaginas) {
            paginaActual = totalPaginas - 1;
        }

        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        const respuestaLista = await fetchAutenticado(
            `${API_URL}/listar-paginado?pagina=${paginaActual}`
        );
        const resultadoLista = await respuestaLista.json();

        if (!respuestaLista.ok || !resultadoLista.success) {
            throw new Error(resultadoLista.message || "No se pudieron cargar los medios de pago.");
        }

        mediosPago = Array.isArray(resultadoLista.data) ? resultadoLista.data : [];
        renderizarMediosPago();
        renderizarPaginacion();
        return true;
    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al cargar los medios de pago.", "danger");
        tabla.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-danger py-4">
                    No se pudieron cargar los medios de pago.
                </td>
            </tr>
        `;
        document.getElementById("totalMediosPago").textContent = "Medios de pago en página: 0";
        return false;
    } finally {
        tabla.classList.remove("tabla-cargando");
        tabla.setAttribute("aria-busy", "false");
    }
}

function renderizarMediosPago() {
    const tbody = document.getElementById("tablaMediosPago");
    const busqueda = document.getElementById("buscarMedioPago").value.trim().toLowerCase();
    const esBusquedaPorCodigo = /^\d+$/.test(busqueda);
    const filtrados = mediosPago.filter(medio => {
        if (esBusquedaPorCodigo) {
            return String(medio.idMedioPago) === busqueda;
        }

        return [medio.nombre, medio.descripcion, medio.numeroCuenta]
            .some(valor => String(valor ?? "").toLowerCase().includes(busqueda));
    });

    document.getElementById("totalMediosPago").textContent =
        `Medios de pago en página: ${filtrados.length}`;

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="5" class="text-center text-muted py-5">
                    ${mediosPago.length === 0
                        ? "No hay medios de pago registrados."
                        : "No se encontraron medios de pago con esa búsqueda."}
                </td>
            </tr>
        `;
        animarResultadoTabla(tbody);
        return;
    }

    tbody.innerHTML = filtrados.map(medio => `
        <tr>
            <td class="fw-semibold catalogo-codigo">${Number(medio.idMedioPago)}</td>
            <td class="medio-descripcion">
                <span class="fw-semibold medio-nombre">${escaparHTML(medio.nombre)}</span>
                <span class="text-secondary medio-detalle d-block small">
                    ${escaparHTML(medio.descripcion || "Sin descripción")}
                </span>
            </td>
            <td class="medio-cuenta">${escaparHTML(medio.numeroCuenta || "No especificado")}</td>
            <td>
                <span class="badge transicion-estado-vehiculo
                    ${medio.estado ? "text-bg-success" : "text-bg-secondary"}"
                    data-medio-estado>
                    ${medio.estado ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary"
                        data-accion="editar" data-id="${Number(medio.idMedioPago)}"
                        aria-label="Editar medio de pago ${escaparHTML(medio.nombre)}" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button type="button"
                        class="btn btn-sm ${medio.estado ? "btn-outline-danger" : "btn-outline-success"}"
                        data-accion="estado" data-id="${Number(medio.idMedioPago)}"
                        data-estado="${medio.estado ? "true" : "false"}"
                        aria-label="${medio.estado ? "Desactivar" : "Activar"} medio de pago ${escaparHTML(medio.nombre)}"
                        title="${medio.estado ? "Desactivar" : "Activar"}">
                        <i class="bi ${medio.estado ? "bi-toggle-on" : "bi-toggle-off"}"></i>
                    </button>
                </div>
            </td>
        </tr>
    `).join("");
    animarResultadoTabla(tbody);
}

function renderizarPaginacion() {
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
    if (pagina < 0 || pagina >= totalPaginas || pagina === paginaActual) {
        return;
    }

    const paginaAnterior = paginaActual;
    paginaActual = pagina;
    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
    if (!await cargarMediosPago(true, true)) {
        paginaActual = paginaAnterior;
        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        renderizarPaginacion();
    }
}

function filtrarMediosPago() {
    renderizarMediosPago();
}

function limpiarBusqueda() {
    document.getElementById("buscarMedioPago").value = "";
    renderizarMediosPago();
}

function manejarAccionTabla(event) {
    const boton = event.target.closest("[data-accion]");
    if (!boton || boton.disabled) {
        return;
    }

    const id = Number(boton.dataset.id);
    const medio = mediosPago.find(item => Number(item.idMedioPago) === id);
    if (!medio) {
        return;
    }

    if (boton.dataset.accion === "editar") {
        abrirFormularioEdicion(medio);
    } else if (boton.dataset.accion === "estado") {
        abrirConfirmacionEstado(medio, boton.dataset.estado !== "true");
    }
}

function abrirFormularioNuevo() {
    limpiarFormulario();
    idMedioPagoEnEdicion = null;
    document.getElementById("tituloModalMedioPago").textContent = "Añadir medio de pago";
    document.getElementById("btnGuardarMedioPago").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Guardar medio de pago';
    modalMedioPago.show();
}

function abrirFormularioEdicion(medio) {
    limpiarFormulario();
    idMedioPagoEnEdicion = Number(medio.idMedioPago);
    document.getElementById("tituloModalMedioPago").textContent = "Editar medio de pago";
    document.getElementById("btnGuardarMedioPago").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Guardar cambios';
    document.getElementById("nombre").value = medio.nombre || "";
    document.getElementById("descripcion").value = medio.descripcion || "";
    document.getElementById("numeroCuenta").value = medio.numeroCuenta || "";
    modalMedioPago.show();
}

async function guardarMedioPago(event) {
    event.preventDefault();
    const boton = document.getElementById("btnGuardarMedioPago");
    boton.disabled = true;

    const solicitud = {
        nombre: document.getElementById("nombre").value.trim(),
        descripcion: document.getElementById("descripcion").value.trim(),
        numeroCuenta: document.getElementById("numeroCuenta").value.trim()
    };

    try {
        const esEdicion = idMedioPagoEnEdicion !== null;
        const idEditado = idMedioPagoEnEdicion;
        const respuesta = await fetchAutenticado(
            esEdicion
                ? `${API_URL}/actualizar/${idEditado}`
                : `${API_URL}/registrar`,
            {
                method: esEdicion ? "PUT" : "POST",
                body: JSON.stringify(solicitud)
            }
        );
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message || "No se pudo guardar el medio de pago.");
        }

        if (esEdicion) {
            actualizarMedioPagoEnListado(idEditado, solicitud);
        }

        modalMedioPago.hide();
        mostrarMensaje(
            resultado.message || (esEdicion
                ? "Medio de pago actualizado correctamente."
                : "Medio de pago registrado correctamente."),
            "success"
        );

        if (!esEdicion) {
            await cargarMediosPago(false, true);
        }
    } catch (error) {
        mostrarMensajeFormulario(error.message || "Ocurrió un error al guardar el medio de pago.", "danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarMedioPagoEnListado(id, cambios) {
    const medio = mediosPago.find(item => Number(item.idMedioPago) === Number(id));
    if (!medio) {
        return;
    }

    Object.assign(medio, cambios);
    const busqueda = document.getElementById("buscarMedioPago").value.trim().toLowerCase();
    const coincide = [medio.nombre, medio.descripcion, medio.numeroCuenta]
        .some(valor => String(valor ?? "").toLowerCase().includes(busqueda));

    if (busqueda && !/^\d+$/.test(busqueda) && !coincide) {
        renderizarMediosPago();
        return;
    }

    const boton = document.querySelector(
        `#tablaMediosPago [data-accion="editar"][data-id="${Number(id)}"]`
    );
    const fila = boton?.closest("tr");
    if (!fila) {
        return;
    }

    fila.querySelector(".medio-nombre").textContent = medio.nombre;
    fila.querySelector(".medio-detalle").textContent = medio.descripcion || "Sin descripción";
    fila.querySelector(".medio-cuenta").textContent = medio.numeroCuenta || "No especificado";
    animarFilaActualizada(fila);
}

function abrirConfirmacionEstado(medio, nuevoEstado) {
    medioPagoPendienteEstado = {
        id: Number(medio.idMedioPago),
        nombre: medio.nombre,
        nuevoEstado
    };

    const accion = nuevoEstado ? "activar" : "desactivar";
    document.getElementById("tituloModalEstado").textContent =
        `${nuevoEstado ? "Activar" : "Desactivar"} medio de pago`;
    document.getElementById("mensajeConfirmarEstado").textContent =
        `¿Deseas ${accion} el medio de pago ${medio.nombre}?`;
    document.getElementById("detalleConfirmarEstado").textContent = nuevoEstado
        ? "El medio de pago volverá a estar disponible."
        : "El medio de pago dejará de estar disponible hasta que se active nuevamente.";
    document.getElementById("detalleConfirmarEstado").classList.remove("text-danger");

    const boton = document.getElementById("btnConfirmarEstado");
    boton.className = `btn ${nuevoEstado ? "btn-success" : "btn-danger"}`;
    boton.textContent = nuevoEstado ? "Sí, activar" : "Sí, desactivar";
    modalConfirmarEstado.show();
}

async function confirmarCambioEstado() {
    const pendiente = medioPagoPendienteEstado;
    if (!pendiente) {
        return;
    }

    const boton = document.getElementById("btnConfirmarEstado");
    boton.disabled = true;
    const accion = pendiente.nuevoEstado ? "activar" : "desactivar";

    try {
        const parametros = new URLSearchParams({
            nuevoEstado: String(pendiente.nuevoEstado)
        });
        const respuesta = await fetchAutenticado(
            `${API_URL}/cambiar-estado/${pendiente.id}?${parametros}`,
            { method: "PATCH" }
        );
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message || `No se pudo ${accion} el medio de pago.`);
        }

        modalConfirmarEstado.hide();
        actualizarEstadoEnListado(pendiente);
        mostrarMensaje(
            resultado.message || `Medio de pago ${pendiente.nuevoEstado ? "activado" : "desactivado"} correctamente.`,
            "success"
        );
    } catch (error) {
        const detalle = document.getElementById("detalleConfirmarEstado");
        detalle.textContent = error.message || `Ocurrió un error al ${accion} el medio de pago.`;
        detalle.classList.add("text-danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarEstadoEnListado(pendiente) {
    const medio = mediosPago.find(item =>
        Number(item.idMedioPago) === pendiente.id
    );
    if (!medio) {
        return;
    }

    medio.estado = pendiente.nuevoEstado;
    const boton = document.querySelector(
        `#tablaMediosPago [data-accion="estado"][data-id="${pendiente.id}"]`
    );
    const fila = boton?.closest("tr");
    const indicador = fila?.querySelector("[data-medio-estado]");
    const icono = boton?.querySelector("i");
    const accion = pendiente.nuevoEstado ? "Desactivar" : "Activar";

    if (indicador) {
        indicador.classList.toggle("text-bg-success", pendiente.nuevoEstado);
        indicador.classList.toggle("text-bg-secondary", !pendiente.nuevoEstado);
        indicador.textContent = pendiente.nuevoEstado ? "Activo" : "Inactivo";
    }

    if (boton) {
        boton.classList.toggle("btn-outline-danger", pendiente.nuevoEstado);
        boton.classList.toggle("btn-outline-success", !pendiente.nuevoEstado);
        boton.dataset.estado = String(pendiente.nuevoEstado);
        boton.title = accion;
        boton.setAttribute("aria-label", `${accion} medio de pago ${medio.nombre}`);
    }

    if (icono) {
        icono.classList.toggle("bi-toggle-on", pendiente.nuevoEstado);
        icono.classList.toggle("bi-toggle-off", !pendiente.nuevoEstado);
    }
}

function limpiarFormulario() {
    document.getElementById("formMedioPago").reset();
    document.getElementById("mensajeFormulario").innerHTML = "";
    idMedioPagoEnEdicion = null;
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
    contenedor.innerHTML = mensaje
        ? `<div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
            ${escaparHTML(mensaje)}
            <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Cerrar"></button>
        </div>`
        : "";
}

function mostrarMensajeFormulario(mensaje, tipo) {
    document.getElementById("mensajeFormulario").innerHTML = `
        <div class="alert alert-${tipo}" role="alert">${escaparHTML(mensaje)}</div>
    `;
}

function animarResultadoTabla(tabla) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof tabla.animate !== "function") {
        return;
    }

    tabla.animate(
        [
            { opacity: 0.55, transform: "translateY(5px)" },
            { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 180, easing: "ease-out" }
    );
}

function animarFilaActualizada(fila) {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof fila.animate !== "function") {
        return;
    }

    fila.animate(
        [
            { backgroundColor: "rgba(25, 135, 84, 0.18)" },
            { backgroundColor: "transparent" }
        ],
        { duration: 650, easing: "ease-out" }
    );
}

function ocultarPantallaCarga() {
    const pantalla = document.getElementById("pantalla-carga");
    if (!pantalla) {
        return;
    }

    pantalla.classList.add("oculto");
    setTimeout(() => pantalla.remove(), 300);
}
