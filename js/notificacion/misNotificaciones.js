
const API_NOTIFICACIONES = "http://localhost:8080/api/notificacion";
const CLAVE_PAGINA = "paginaNotificaciones";

let paginaActual = Number(sessionStorage.getItem(CLAVE_PAGINA)) || 0;
let totalPaginas = 0;
let notificacionesActuales = [];

document.addEventListener("DOMContentLoaded", async () => {
    verificarAutenticacion();
    await cargarNotificaciones();
});

async function cargarNotificaciones() {

    const lista = document.getElementById("lista-notificaciones");

    lista.innerHTML = `
        <div class="text-center py-5">
            <div class="spinner-border text-success" role="status"></div>
            <p class="text-muted mt-3 mb-0">
                Cargando notificaciones...
            </p>
        </div>
    `;

    try {
        const respuestaPaginas = await fetchAutenticado(
            `${API_NOTIFICACIONES}/paginas`
        );

        const resultadoPaginas = await respuestaPaginas.json();

        if (!respuestaPaginas.ok || !resultadoPaginas.success) {
            throw new Error(resultadoPaginas.message);
        }

        totalPaginas = resultadoPaginas.data;

        if (totalPaginas === 0) {
            paginaActual = 0;
            sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
            notificacionesActuales = [];
            renderizarNotificaciones();
            renderizarPaginacion();
            await actualizarContadorNotificaciones();
            return;
        }

        if (paginaActual >= totalPaginas) {
            paginaActual = totalPaginas - 1;
            sessionStorage.setItem(CLAVE_PAGINA, paginaActual);
        }

        const respuesta = await fetchAutenticado(
            `${API_NOTIFICACIONES}/mis-notificaciones?pagina=${paginaActual}`
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message);
        }

        notificacionesActuales = resultado.data || [];

        renderizarNotificaciones();
        renderizarPaginacion();

        await actualizarContadorNotificaciones();

    } catch (error) {
        lista.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-exclamation-circle text-danger fs-1"></i>
                <p class="text-danger mt-3 mb-0">
                    No se pudieron cargar las notificaciones.
                </p>
            </div>
        `;

        document.getElementById(
            "paginacion-notificaciones"
        ).innerHTML = "";
    }
}

function renderizarNotificaciones() {

    const lista = document.getElementById("lista-notificaciones");

    lista.innerHTML = "";

    if (notificacionesActuales.length === 0) {
        lista.innerHTML = `
            <div class="text-center py-5">
                <i class="bi bi-bell-slash text-muted fs-1"></i>
                <p class="text-muted mt-3 mb-0">
                    No tienes notificaciones.
                </p>
            </div>
        `;
        return;
    }

    notificacionesActuales.forEach(notificacion => {

        const boton = document.createElement("button");

        boton.type = "button";
        boton.className = `
            notificacion-item
            w-100
            text-start
            border-0
            border-bottom
            p-3
            ${notificacion.estado ? "bg-light" : "bg-white"}
        `;

        const fila = document.createElement("div");
        fila.className = "d-flex align-items-center gap-3";

        const icono = document.createElement("i");
        icono.className = `
            bi
            ${notificacion.estado
                ? "bi-envelope-open text-secondary"
                : "bi-envelope-fill text-success"}
            fs-4
        `;

        const contenido = document.createElement("div");
        contenido.className = "flex-grow-1 overflow-hidden";

        const descripcion = document.createElement("p");
        descripcion.className = `
            mb-0
            ${notificacion.estado
                ? "text-secondary fw-normal"
                : "text-dark fw-semibold"}
        `;

        descripcion.innerHTML = notificacion.descripcion;

        descripcion.style.overflow = "hidden";
        descripcion.style.whiteSpace = "nowrap";
        descripcion.style.textOverflow = "ellipsis";

        contenido.appendChild(descripcion);

        fila.appendChild(icono);
        fila.appendChild(contenido);

        if (!notificacion.estado) {
            const badge = document.createElement("span");
            badge.className = "badge bg-success";
            badge.textContent = "Nueva";
            fila.appendChild(badge);
        }

        boton.appendChild(fila);

        boton.addEventListener("click", () => {
            verNotificacion(notificacion.idNotificacion);
        });

        lista.appendChild(boton);
    });
}

async function verNotificacion(idNotificacion) {

    const notificacion = notificacionesActuales.find(
        n => n.idNotificacion === idNotificacion
    );

    if (!notificacion) {
        return;
    }

    if (!notificacion.estado) {

        try {
            const respuesta = await fetchAutenticado(
                `${API_NOTIFICACIONES}/${idNotificacion}/leer`,
                {
                    method: "PUT"
                }
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(resultado.message);
            }

            notificacion.estado = true;

            renderizarNotificaciones();

            await actualizarContadorNotificaciones();

        } catch (error) {
            alert("No se pudo marcar la notificación como leída.");
            return;
        }
    }

    document.getElementById(
        "descripcion-notificacion"
    ).innerHTML = notificacion.descripcion;

    const modal = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modal-notificacion")
    );

    modal.show();
}

function renderizarPaginacion() {

    const paginacion = document.getElementById(
        "paginacion-notificaciones"
    );

    paginacion.innerHTML = "";

    if (totalPaginas <= 1) {
        return;
    }

    agregarBotonPaginacion(
        paginacion,
        "Anterior",
        paginaActual - 1,
        paginaActual === 0
    );

    for (let i = 0; i < totalPaginas; i++) {

        agregarBotonPaginacion(
            paginacion,
            i + 1,
            i,
            false,
            paginaActual === i
        );
    }

    agregarBotonPaginacion(
        paginacion,
        "Siguiente",
        paginaActual + 1,
        paginaActual >= totalPaginas - 1
    );
}

function agregarBotonPaginacion(
    contenedor,
    texto,
    pagina,
    deshabilitado,
    activo = false
) {

    const elemento = document.createElement("li");

    elemento.className = `
        page-item
        ${deshabilitado ? "disabled" : ""}
        ${activo ? "active" : ""}
    `;

    const boton = document.createElement("button");
    boton.type = "button";
    boton.className = "page-link";
    boton.textContent = texto;
    boton.disabled = deshabilitado;

    boton.addEventListener("click", () => {
        cambiarPagina(pagina);
    });

    elemento.appendChild(boton);
    contenedor.appendChild(elemento);
}

async function cambiarPagina(nuevaPagina) {

    if (
        nuevaPagina < 0 ||
        nuevaPagina >= totalPaginas ||
        nuevaPagina === paginaActual
    ) {
        return;
    }

    paginaActual = nuevaPagina;

    sessionStorage.setItem(CLAVE_PAGINA, paginaActual);

    await cargarNotificaciones();
}

async function actualizarContadorNotificaciones() {

    const contador = document.getElementById(
        "contador-notificaciones"
    );

    if (!contador) {
        return;
    }

    try {
        const respuesta = await fetchAutenticado(
            `${API_NOTIFICACIONES}/no-leidas/total`
        );

        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message);
        }

        const cantidad = Number(resultado.data);

        contador.textContent = cantidad;
        contador.classList.toggle("d-none", cantidad <= 0);

    } catch (error) {
    }
}
