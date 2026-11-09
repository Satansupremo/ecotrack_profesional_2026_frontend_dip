const API_URL = "http://localhost:8080/api/vehiculo";
const CLAVE_PAGINA = "paginaGestionarVehiculos";

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalPaginas = 0;
let vehiculos = [];
let idVehiculoEnEdicion = null;
let modalVehiculo;
let modalConfirmarEstado;
let vehiculoPendienteEstado = null;

document.addEventListener("DOMContentLoaded", async () => {
    if (!verificarRolPermitido(["ADMINISTRADOR"])) {
        return;
    }

    modalVehiculo = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalVehiculo")
    );
    modalConfirmarEstado = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modalConfirmarEstado")
    );

    document.getElementById("btnNuevoVehiculo").addEventListener("click", abrirFormularioNuevo);
    document.getElementById("formVehiculo").addEventListener("submit", guardarVehiculo);
    document.getElementById("btnConfirmarEstado").addEventListener("click", confirmarCambioEstado);
    document.getElementById("buscarVehiculo").addEventListener("input", filtrarVehiculos);
    document.getElementById("btnLimpiarBusqueda").addEventListener("click", limpiarBusqueda);
    document.getElementById("pagina-anterior").addEventListener("click", () => cambiarPagina(paginaActual - 1));
    document.getElementById("pagina-siguiente").addEventListener("click", () => cambiarPagina(paginaActual + 1));
    document.getElementById("tablaVehiculos").addEventListener("click", manejarAccionTabla);
    document.getElementById("modalVehiculo").addEventListener("hidden.bs.modal", limpiarFormulario);
    document.getElementById("modalConfirmarEstado").addEventListener("hidden.bs.modal", () => {
        vehiculoPendienteEstado = null;
    });

    await cargarVehiculos();
    ocultarPantallaCarga();
});

async function cargarVehiculos(limpiarMensaje = true, conservarTabla = false) {
    if (limpiarMensaje) {
        mostrarMensaje("", "");
    }
    const tabla = document.getElementById("tablaVehiculos");
    tabla.classList.toggle("tabla-cargando", conservarTabla);
    tabla.setAttribute("aria-busy", "true");

    if (!conservarTabla) {
        tabla.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-secondary py-4">
                    <div class="spinner-border spinner-border-sm text-danger me-2" role="status"></div>
                    Cargando vehículos...
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
            vehiculos = [];
            renderizarVehiculos();
            renderizarPaginacion();
            return true;
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
            throw new Error(resultadoLista.message || "No se pudieron cargar los vehículos.");
        }

        vehiculos = Array.isArray(resultadoLista.data) ? resultadoLista.data : [];
        renderizarVehiculos();
        renderizarPaginacion();
        return true;
    } catch (error) {
        mostrarMensaje(error.message || "Ocurrió un error al cargar los vehículos.", "danger");
        tabla.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-danger py-4">
                    No se pudieron cargar los vehículos.
                </td>
            </tr>
        `;
        document.getElementById("totalVehiculos").textContent = "Vehículos en página: 0";
        return false;
    } finally {
        tabla.classList.remove("tabla-cargando");
        tabla.setAttribute("aria-busy", "false");
    }
}

function renderizarVehiculos() {
    const tbody = document.getElementById("tablaVehiculos");
    const busqueda = document.getElementById("buscarVehiculo").value.trim().toLowerCase();
    const esBusquedaPorCodigo = /^\d+$/.test(busqueda);
    const filtrados = vehiculos.filter(vehiculo => {
        if (esBusquedaPorCodigo) {
            return String(vehiculo.idVehiculo) === busqueda;
        }

        return [vehiculo.placa, vehiculo.marca, vehiculo.modelo, vehiculo.tipo]
            .some(valor => String(valor ?? "").toLowerCase().includes(busqueda));
    });

    document.getElementById("totalVehiculos").textContent =
        `Vehículos en página: ${filtrados.length}`;

    if (filtrados.length === 0) {
        tbody.innerHTML = `
            <tr>
                <td colspan="7" class="text-center text-muted py-5">
                    ${vehiculos.length === 0
                        ? "No hay vehículos registrados."
                        : "No se encontraron vehículos con esa búsqueda."}
                </td>
            </tr>
        `;
        animarResultadoTabla(tbody);
        return;
    }

    tbody.innerHTML = filtrados.map(vehiculo => `
        <tr>
            <td class="fw-semibold catalogo-codigo">${Number(vehiculo.idVehiculo)}</td>
            <td class="vehiculo-placa">${escaparHTML(vehiculo.placa)}</td>
            <td class="vehiculo-descripcion">
                <span class="fw-semibold">${escaparHTML(vehiculo.marca)}</span>
                <span class="text-secondary">${escaparHTML(vehiculo.modelo)}</span>
            </td>
            <td class="vehiculo-tipo">${escaparHTML(formatearTipoVehiculo(vehiculo.tipo))}</td>
            <td class="catalogo-capacidad">${escaparHTML(vehiculo.capacidadLibras)}</td>
            <td>
                <span class="badge transicion-estado-vehiculo
                    ${vehiculo.estado ? "text-bg-success" : "text-bg-secondary"}"
                    data-vehiculo-estado>
                    ${vehiculo.estado ? "Activo" : "Inactivo"}
                </span>
            </td>
            <td class="text-center">
                <div class="d-flex justify-content-center gap-2">
                    <button type="button" class="btn btn-sm btn-outline-primary"
                        data-accion="editar" data-id="${Number(vehiculo.idVehiculo)}"
                        aria-label="Editar vehículo ${escaparHTML(vehiculo.placa)}"
                        title="Editar">
                        <i class="bi bi-pencil-square"></i>
                    </button>
                    <button type="button"
                        class="btn btn-sm ${vehiculo.estado ? "btn-outline-danger" : "btn-outline-success"}"
                        data-accion="estado" data-id="${Number(vehiculo.idVehiculo)}"
                        data-estado="${vehiculo.estado ? "true" : "false"}"
                        aria-label="${vehiculo.estado ? "Desactivar" : "Activar"} vehículo ${escaparHTML(vehiculo.placa)}"
                        title="${vehiculo.estado ? "Desactivar" : "Activar"}">
                        <i class="bi ${vehiculo.estado ? "bi-toggle-on" : "bi-toggle-off"}"></i>
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
    const cargaCorrecta = await cargarVehiculos(true, true);

    if (!cargaCorrecta) {
        paginaActual = paginaAnterior;
        sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        renderizarPaginacion();
    }
}

function filtrarVehiculos() {
    renderizarVehiculos();
}

function limpiarBusqueda() {
    document.getElementById("buscarVehiculo").value = "";
    renderizarVehiculos();
}

function manejarAccionTabla(event) {
    const boton = event.target.closest("[data-accion]");
    if (!boton || boton.disabled) {
        return;
    }

    const id = Number(boton.dataset.id);
    const vehiculo = vehiculos.find(item => Number(item.idVehiculo) === id);
    if (!vehiculo) {
        return;
    }

    if (boton.dataset.accion === "editar") {
        abrirFormularioEdicion(vehiculo);
    } else if (boton.dataset.accion === "estado") {
        abrirConfirmacionEstado(vehiculo, boton.dataset.estado !== "true");
    }
}

function abrirFormularioNuevo() {
    limpiarFormulario();
    idVehiculoEnEdicion = null;
    document.getElementById("tituloModalVehiculo").textContent = "Añadir vehículo";
    document.getElementById("btnGuardarVehiculo").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Guardar vehículo';
    modalVehiculo.show();
}

function abrirFormularioEdicion(vehiculo) {
    limpiarFormulario();
    idVehiculoEnEdicion = Number(vehiculo.idVehiculo);
    document.getElementById("tituloModalVehiculo").textContent = "Editar vehículo";
    document.getElementById("btnGuardarVehiculo").innerHTML =
        '<i class="bi bi-check-circle me-1"></i> Guardar cambios';
    document.getElementById("placa").value = vehiculo.placa || "";
    document.getElementById("marca").value = vehiculo.marca || "";
    document.getElementById("modelo").value = vehiculo.modelo || "";
    document.getElementById("capacidadLibras").value = vehiculo.capacidadLibras ?? "";
    document.getElementById("tipo").value = vehiculo.tipo || "";
    modalVehiculo.show();
}

async function guardarVehiculo(event) {
    event.preventDefault();
    const boton = document.getElementById("btnGuardarVehiculo");
    boton.disabled = true;

    const solicitud = {
        placa: document.getElementById("placa").value.trim(),
        marca: document.getElementById("marca").value.trim(),
        modelo: document.getElementById("modelo").value.trim(),
        capacidadLibras: Number(document.getElementById("capacidadLibras").value),
        tipo: document.getElementById("tipo").value
    };

    try {
        const esEdicion = idVehiculoEnEdicion !== null;
        const respuesta = await fetchAutenticado(
            esEdicion
                ? `${API_URL}/actualizar/${idVehiculoEnEdicion}`
                : `${API_URL}/registrar`,
            {
                method: esEdicion ? "PUT" : "POST",
                body: JSON.stringify(solicitud)
            }
        );
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message || "No se pudo guardar el vehículo.");
        }

        if (esEdicion) {
            actualizarVehiculoEnListado(idVehiculoEnEdicion, solicitud);
        }

        modalVehiculo.hide();
        mostrarMensaje(
            resultado.message || (esEdicion ? "Vehículo actualizado correctamente." : "Vehículo registrado correctamente."),
            "success"
        );

        if (!esEdicion) {
            await cargarVehiculos(false);
        }
    } catch (error) {
        mostrarMensajeFormulario(error.message || "Ocurrió un error al guardar el vehículo.", "danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarVehiculoEnListado(id, cambios) {
    const vehiculo = vehiculos.find(item => Number(item.idVehiculo) === Number(id));
    if (!vehiculo) {
        return;
    }

    Object.assign(vehiculo, cambios);
    const busqueda = document.getElementById("buscarVehiculo").value.trim().toLowerCase();
    const coincide = [vehiculo.placa, vehiculo.marca, vehiculo.modelo, vehiculo.tipo]
        .some(valor => String(valor ?? "").toLowerCase().includes(busqueda));

    if (busqueda && !/^\d+$/.test(busqueda) && !coincide) {
        renderizarVehiculos();
        return;
    }

    const fila = document.querySelector(
        `#tablaVehiculos tr:has([data-accion="editar"][data-id="${Number(id)}"])`
    );
    if (!fila) {
        return;
    }

    fila.querySelector(".vehiculo-placa").textContent = vehiculo.placa;
    const descripcion = fila.querySelector(".vehiculo-descripcion");
    descripcion.children[0].textContent = vehiculo.marca;
    descripcion.children[1].textContent = vehiculo.modelo;
    fila.querySelector(".vehiculo-tipo").textContent = formatearTipoVehiculo(vehiculo.tipo);
    fila.querySelector(".catalogo-capacidad").textContent = vehiculo.capacidadLibras;

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

function abrirConfirmacionEstado(vehiculo, nuevoEstado) {
    vehiculoPendienteEstado = {
        id: Number(vehiculo.idVehiculo),
        placa: vehiculo.placa,
        nuevoEstado
    };

    const accion = nuevoEstado ? "activar" : "desactivar";
    document.getElementById("tituloModalEstado").textContent =
        `${nuevoEstado ? "Activar" : "Desactivar"} vehículo`;
    document.getElementById("mensajeConfirmarEstado").textContent =
        `¿Deseas ${accion} el vehículo ${vehiculo.placa}?`;
    document.getElementById("detalleConfirmarEstado").textContent = nuevoEstado
        ? "El vehículo volverá a estar disponible para su uso."
        : "El vehículo dejará de estar disponible hasta que se active nuevamente.";
    document.getElementById("detalleConfirmarEstado").classList.remove("text-danger");

    const boton = document.getElementById("btnConfirmarEstado");
    boton.className = `btn ${nuevoEstado ? "btn-success" : "btn-danger"}`;
    boton.textContent = nuevoEstado ? "Sí, activar" : "Sí, desactivar";
    modalConfirmarEstado.show();
}

async function confirmarCambioEstado() {
    const pendiente = vehiculoPendienteEstado;
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
            throw new Error(resultado.message || `No se pudo ${accion} el vehículo.`);
        }

        modalConfirmarEstado.hide();
        actualizarEstadoEnListado(pendiente);
        mostrarMensaje(
            resultado.message || `Vehículo ${pendiente.nuevoEstado ? "activado" : "desactivado"} correctamente.`,
            "success"
        );
    } catch (error) {
        const detalle = document.getElementById("detalleConfirmarEstado");
        detalle.textContent = error.message || `Ocurrió un error al ${accion} el vehículo.`;
        detalle.classList.add("text-danger");
    } finally {
        boton.disabled = false;
    }
}

function actualizarEstadoEnListado(pendiente) {
    const vehiculo = vehiculos.find(item =>
        Number(item.idVehiculo) === pendiente.id
    );
    if (!vehiculo) {
        return;
    }

    vehiculo.estado = pendiente.nuevoEstado;

    const boton = document.querySelector(
        `#tablaVehiculos [data-accion="estado"][data-id="${pendiente.id}"]`
    );
    const fila = boton?.closest("tr");
    const indicador = fila?.querySelector("[data-vehiculo-estado]");
    const icono = boton?.querySelector("i");
    const placa = vehiculo.placa;
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
        boton.setAttribute("aria-label", `${accion} vehículo ${placa}`);
    }

    if (icono) {
        icono.classList.toggle("bi-toggle-on", pendiente.nuevoEstado);
        icono.classList.toggle("bi-toggle-off", !pendiente.nuevoEstado);
    }
}

function limpiarFormulario() {
    document.getElementById("formVehiculo").reset();
    document.getElementById("mensajeFormulario").innerHTML = "";
    idVehiculoEnEdicion = null;
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

function formatearTipoVehiculo(tipo) {
    const nombres = {
        VOLQUETE: "Volquete",
        EXCAVADORA: "Excavadora",
        RETROEXCAVADORA: "Retroexcavadora",
        CARGADOR_FRONTAL: "Cargador frontal",
        TRACTOR_DE_ORUGAS: "Tractor de orugas"
    };

    return nombres[tipo] || tipo || "No especificado";
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
        {
            duration: 180,
            easing: "ease-out"
        }
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
