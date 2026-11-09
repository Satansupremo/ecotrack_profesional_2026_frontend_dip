const API_URL = "http://localhost:8080/api/usuario";
const CLAVE_PAGINA = "paginaGestionarUsuarios";

const ROLES = {
    USUARIO: "Usuario",
    ADMINISTRADOR: "Administrador",
    COORDINADOR: "Coordinador",
    TRANSPORTISTA: "Transportista",
    OPERARIO: "Operario",
    JEFE_UNIDAD: "Jefe de unidad"
};

const SITUACIONES = {
    NINGUNO: "Ninguna",
    DISPONIBLE: "Disponible",
    ASIGNADO: "Asignado",
    RESERVADO: "Reservado",
    INACTIVO: "Inactivo"
};

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalPaginas = 0;
let usuarios = [];
let idUsuarioEnEdicion = null;
let modalUsuario;
let modalConfirmarEstado;
let usuarioPendienteEstado = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!verificarRolPermitido(["ADMINISTRADOR"])) {
        return;
    }

    modalUsuario = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalUsuario")
    );
    modalConfirmarEstado = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalConfirmarEstado")
    );

    document.getElementById("btnNuevoUsuario").addEventListener("click", abrirFormularioNuevo);
    document.getElementById("formUsuario").addEventListener("submit", guardarUsuario);
    document.getElementById("btnConfirmarEstado").addEventListener("click", confirmarCambioEstado);
    document.getElementById("buscarUsuario").addEventListener("input", filtrarUsuarios);
    document.getElementById("btnLimpiarBusqueda").addEventListener("click", limpiarBusqueda);
    document.getElementById("pagina-anterior").addEventListener("click", () => cambiarPagina(paginaActual - 1));
    document.getElementById("pagina-siguiente").addEventListener("click", () => cambiarPagina(paginaActual + 1));
    document.getElementById("tablaUsuarios").addEventListener("click", manejarAccionTabla);
    document.getElementById("modalUsuario").addEventListener("hidden.bs.modal", limpiarFormulario);
    document.getElementById("modalConfirmarEstado").addEventListener("hidden.bs.modal", () => {
        usuarioPendienteEstado = null;
    });

    await cargarUsuarios();
    ocultarPantallaCarga();
});

async function cargarUsuarios(limpiarMensaje = true, conservarTabla = false) {
    if (limpiarMensaje) {
        mostrarMensaje("", "");
    }

    const tabla = document.getElementById("tablaUsuarios");
    tabla.classList.toggle("tabla-cargando", conservarTabla);
    tabla.setAttribute("aria-busy", "true");

    if (!conservarTabla) {
        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-secondary py-4">
                    <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                    Cargando usuarios...
                </td>
            </tr>
        `;
    }

    try {
        const respuestaPaginas = await fetchAutenticado(`${API_URL}/total-paginas`);
        const resultadoPaginas = await respuestaPaginas.json();

        if (!respuestaPaginas.ok || !resultadoPaginas.success) {
            throw new Error(resultadoPaginas.message || "No se pudo obtener la cantidad de páginas.");
        }

        totalPaginas = Number(resultadoPaginas.data) || 0;
        if (totalPaginas === 0) {
            paginaActual = 0;
            usuarios = [];
            renderizarUsuarios();
            renderizarPaginacion();
            return true;
        }

        if (paginaActual >= totalPaginas) {
            paginaActual = totalPaginas - 1;
        }

        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        const respuestaLista = await fetchAutenticado(`${API_URL}/listar/${paginaActual}`);
        const resultadoLista = await respuestaLista.json();

        if (!respuestaLista.ok || !resultadoLista.success) {
            throw new Error(resultadoLista.message || "No se pudieron cargar los empleados.");
        }

        usuarios = Array.isArray(resultadoLista.data) ? resultadoLista.data : [];
        renderizarUsuarios();
        renderizarPaginacion();
        return true;
    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al cargar los empleados.", "danger");
        tabla.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-danger py-4">
                    No se pudieron cargar los usuarios.
                </td>
            </tr>
        `;
        document.getElementById("totalUsuarios").textContent = "Empleados en página: 0";
        return false;
    } finally {
        tabla.classList.remove("tabla-cargando");
        tabla.setAttribute("aria-busy", "false");
    }
}

function renderizarUsuarios() {
    const tbody = document.getElementById("tablaUsuarios");
    const busqueda = document.getElementById("buscarUsuario").value.trim().toLowerCase();
    const esBusquedaPorCodigo = /^\d+$/.test(busqueda);
    const filtrados = usuarios.filter(usuario => {
        if (esBusquedaPorCodigo) {
            return String(usuario.idUsuario) === busqueda;
        }

        return [
            usuario.nombre,
            usuario.apellido,
            usuario.username,
            usuario.correo,
            usuario.dni,
            ROLES[usuario.rol] || usuario.rol,
            SITUACIONES[usuario.situacion] || usuario.situacion
        ].some(valor => String(valor ?? "").toLowerCase().includes(busqueda));
    });

    document.getElementById("totalUsuarios").textContent =
        `Empleados en página: ${filtrados.length}`;

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="8" class="text-center text-muted py-5">
                    ${usuarios.length === 0
                        ? "No hay empleados registrados."
                        : "No se encontraron empleados con esa búsqueda."}
                </td>
            </tr>
        `;
        animarResultadoTabla(tbody);
        return;
    }

    tbody.innerHTML = filtrados.map(usuario => `
        <tr>
            <td class="fw-semibold catalogo-codigo">${Number(usuario.idUsuario)}</td>
            <td class="usuario-identificador">
                <span class="fw-semibold usuario-nombre">${escaparHTML(usuario.nombre)} ${escaparHTML(usuario.apellido)}</span>
                <span class="text-secondary small d-block usuario-celular">${escaparHTML(usuario.celular || "")}</span>
            </td>
            <td class="usuario-identificador">
                <span class="fw-semibold usuario-username">${escaparHTML(usuario.username)}</span>
                <span class="text-secondary small d-block usuario-correo">${escaparHTML(usuario.correo)}</span>
            </td>
            <td class="usuario-dni">${escaparHTML(usuario.dni)}</td>
            <td class="usuario-rol">${escaparHTML(ROLES[usuario.rol] || usuario.rol)}</td>
            <td>
                <span class="badge text-bg-light border usuario-situacion">
                    ${escaparHTML(SITUACIONES[usuario.situacion] || usuario.situacion || "Ninguna")}
                </span>
            </td>
            <td>
                <span class="badge transicion-estado-vehiculo
                    ${usuario.estado ? "text-bg-success" : "text-bg-secondary"}"
                    data-usuario-estado>
                    ${usuario.estado ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary"
                        data-accion="editar" data-id="${Number(usuario.idUsuario)}"
                        aria-label="Editar empleado ${escaparHTML(usuario.username)}" title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button type="button"
                        class="btn btn-sm ${usuario.estado ? "btn-outline-danger" : "btn-outline-success"}"
                        data-accion="estado" data-id="${Number(usuario.idUsuario)}"
                        data-estado="${usuario.estado ? "true" : "false"}"
                        aria-label="${usuario.estado ? "Desactivar" : "Activar"} empleado ${escaparHTML(usuario.username)}"
                        title="${usuario.estado ? "Desactivar" : "Activar"}">
                        <i class="bi ${usuario.estado ? "bi-toggle-on" : "bi-toggle-off"}"></i>
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

    if (!await cargarUsuarios(true, true)) {
        paginaActual = paginaAnterior;
        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        renderizarPaginacion();
    }
}

function filtrarUsuarios() {
    renderizarUsuarios();
}

function limpiarBusqueda() {
    document.getElementById("buscarUsuario").value = "";
    renderizarUsuarios();
}

function manejarAccionTabla(event) {
    const boton = event.target.closest("[data-accion]");
    if (!boton || boton.disabled) {
        return;
    }

    const id = Number(boton.dataset.id);
    const usuario = usuarios.find(item => Number(item.idUsuario) === id);
    if (!usuario) {
        return;
    }

    if (boton.dataset.accion === "editar") {
        abrirFormularioEdicion(usuario);
    } else if (boton.dataset.accion === "estado") {
        abrirConfirmacionEstado(usuario, boton.dataset.estado !== "true");
    }
}

function abrirFormularioNuevo() {
    limpiarFormulario();
    idUsuarioEnEdicion = null;
    document.getElementById("tituloModalUsuario").textContent = "Crear empleado";
    document.getElementById("ayudaPassword").textContent = "Debe tener al menos 8 caracteres.";
    document.getElementById("btnGuardarUsuario").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Crear empleado';
    modalUsuario.show();
}

function abrirFormularioEdicion(usuario) {
    limpiarFormulario();
    idUsuarioEnEdicion = Number(usuario.idUsuario);
    document.getElementById("tituloModalUsuario").textContent = "Editar empleado";
    document.getElementById("ayudaPassword").textContent =
        "Ingresa una contraseña nueva para este empleado (mínimo 8 caracteres).";
    document.getElementById("btnGuardarUsuario").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Guardar cambios';
    document.getElementById("nombre").value = usuario.nombre || "";
    document.getElementById("apellido").value = usuario.apellido || "";
    document.getElementById("correo").value = usuario.correo || "";
    document.getElementById("celular").value = usuario.celular || "";
    document.getElementById("username").value = usuario.username || "";
    document.getElementById("dni").value = usuario.dni || "";
    document.getElementById("rol").value = usuario.rol || "";
    modalUsuario.show();
}

async function guardarUsuario(event) {
    event.preventDefault();
    const boton = document.getElementById("btnGuardarUsuario");
    boton.disabled = true;

    const solicitud = {
        nombre: document.getElementById("nombre").value.trim(),
        apellido: document.getElementById("apellido").value.trim(),
        correo: document.getElementById("correo").value.trim(),
        celular: document.getElementById("celular").value.trim(),
        username: document.getElementById("username").value.trim(),
        password: document.getElementById("password").value,
        dni: document.getElementById("dni").value.trim(),
        rol: document.getElementById("rol").value
    };

    try {
        const esEdicion = idUsuarioEnEdicion !== null;
        const idEditado = idUsuarioEnEdicion;
        const respuesta = await fetchAutenticado(
            esEdicion
                ? `${API_URL}/actualizar/${idEditado}`
                : `${API_URL}/crear-superusuario`,
            {
                method: esEdicion ? "PUT" : "POST",
                body: JSON.stringify(solicitud)
            }
        );
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message || "No se pudo guardar el empleado.");
        }

        if (esEdicion) {
            actualizarUsuarioEnListado(idEditado, {
                nombre: solicitud.nombre,
                apellido: solicitud.apellido,
                correo: solicitud.correo,
                celular: solicitud.celular,
                username: solicitud.username,
                dni: solicitud.dni,
                rol: solicitud.rol
            });
        }

        modalUsuario.hide();
        mostrarMensaje(
            resultado.message || (esEdicion
                ? "Empleado actualizado correctamente."
                : "Empleado creado correctamente."),
            "success"
        );

        if (!esEdicion) {
            await cargarUsuarios(false, true);
        }
    } catch (error) {
        mostrarMensajeFormulario(error.message || "Ocurrió un error al guardar el empleado.", "danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarUsuarioEnListado(id, cambios) {
    const usuario = usuarios.find(item => Number(item.idUsuario) === Number(id));
    if (!usuario) {
        return;
    }

    Object.assign(usuario, cambios);
    const busqueda = document.getElementById("buscarUsuario").value.trim().toLowerCase();
    const coincide = [
        usuario.nombre,
        usuario.apellido,
        usuario.username,
        usuario.correo,
        usuario.dni,
        ROLES[usuario.rol] || usuario.rol,
        SITUACIONES[usuario.situacion] || usuario.situacion
    ].some(valor => String(valor ?? "").toLowerCase().includes(busqueda));

    if (busqueda && !/^\d+$/.test(busqueda) && !coincide) {
        renderizarUsuarios();
        return;
    }

    const boton = document.querySelector(
        `#tablaUsuarios [data-accion="editar"][data-id="${Number(id)}"]`
    );
    const fila = boton?.closest("tr");
    if (!fila) {
        return;
    }

    fila.querySelector(".usuario-nombre").textContent = `${usuario.nombre} ${usuario.apellido}`;
    fila.querySelector(".usuario-celular").textContent = usuario.celular || "";
    fila.querySelector(".usuario-username").textContent = usuario.username;
    fila.querySelector(".usuario-correo").textContent = usuario.correo;
    fila.querySelector(".usuario-dni").textContent = usuario.dni;
    fila.querySelector(".usuario-rol").textContent = ROLES[usuario.rol] || usuario.rol;
    fila.querySelector('[data-accion="editar"]').setAttribute(
        "aria-label",
        `Editar empleado ${usuario.username}`
    );
    fila.querySelector('[data-accion="estado"]').setAttribute(
        "aria-label",
        `${usuario.estado ? "Desactivar" : "Activar"} empleado ${usuario.username}`
    );
    animarFilaActualizada(fila);
}

function abrirConfirmacionEstado(usuario, nuevoEstado) {
    usuarioPendienteEstado = {
        id: Number(usuario.idUsuario),
        username: usuario.username,
        nuevoEstado
    };

    const accion = nuevoEstado ? "activar" : "desactivar";
    document.getElementById("tituloModalEstado").textContent =
        `${nuevoEstado ? "Activar" : "Desactivar"} empleado`;
    document.getElementById("mensajeConfirmarEstado").textContent =
        `¿Deseas ${accion} al empleado ${usuario.username}?`;
    document.getElementById("detalleConfirmarEstado").textContent = nuevoEstado
        ? "El empleado podrá volver a acceder al sistema."
        : "El empleado perderá el acceso al sistema hasta que se active nuevamente.";
    document.getElementById("detalleConfirmarEstado").classList.remove("text-danger");

    const boton = document.getElementById("btnConfirmarEstado");
    boton.className = `btn ${nuevoEstado ? "btn-success" : "btn-danger"}`;
    boton.textContent = nuevoEstado ? "Sí, activar" : "Sí, desactivar";
    modalConfirmarEstado.show();
}

async function confirmarCambioEstado() {
    const pendiente = usuarioPendienteEstado;
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
            throw new Error(resultado.message || `No se pudo ${accion} al empleado.`);
        }

        modalConfirmarEstado.hide();
        actualizarEstadoEnListado(pendiente);
        mostrarMensaje(
            resultado.message || `Empleado ${pendiente.nuevoEstado ? "activado" : "desactivado"} correctamente.`,
            "success"
        );
    } catch (error) {
        const detalle = document.getElementById("detalleConfirmarEstado");
        detalle.textContent = error.message || `Ocurrió un error al ${accion} al empleado.`;
        detalle.classList.add("text-danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarEstadoEnListado(pendiente) {
    const usuario = usuarios.find(item => Number(item.idUsuario) === pendiente.id);
    if (!usuario) {
        return;
    }

    usuario.estado = pendiente.nuevoEstado;
    const boton = document.querySelector(
        `#tablaUsuarios [data-accion="estado"][data-id="${pendiente.id}"]`
    );
    const fila = boton?.closest("tr");
    const indicador = fila?.querySelector("[data-usuario-estado]");
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
        boton.setAttribute("aria-label", `${accion} empleado ${usuario.username}`);
    }

    if (icono) {
        icono.classList.toggle("bi-toggle-on", pendiente.nuevoEstado);
        icono.classList.toggle("bi-toggle-off", !pendiente.nuevoEstado);
    }
}

function limpiarFormulario() {
    document.getElementById("formUsuario").reset();
    document.getElementById("mensajeFormulario").innerHTML = "";
    idUsuarioEnEdicion = null;
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
