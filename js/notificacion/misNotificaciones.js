
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
    } finally {
        ocultarCargaCambioPagina();
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
        const esBuenaNoticia = !notificacion.estado
            && (notificacion.descripcion?.includes("¡Buenas noticias!") ?? false);

        boton.type = "button";
        boton.className = `
            notificacion-item
            w-100
            text-start
            p-3
            ${esBuenaNoticia
                ? "bg-warning-subtle border border-warning rounded-3 my-2"
                : `border-0 border-bottom ${notificacion.estado ? "bg-light" : "bg-white"}`}
        `;

        const fila = document.createElement("div");
        fila.className = "d-flex align-items-center gap-3";

        const icono = document.createElement("i");
        icono.className = `
            bi
            ${esBuenaNoticia
                ? "bi-stars texto-dorado"
                : notificacion.estado
                    ? "bi-envelope-open text-danger"
                    : "bi-envelope-fill text-danger"}
            fs-4
        `;

        const contenido = document.createElement("div");
        contenido.className = "flex-grow-1 overflow-hidden";

        const descripcion = document.createElement("p");
        descripcion.className = `
            mb-0
            ${esBuenaNoticia
                ? "text-warning-emphasis fw-bold"
                : notificacion.estado
                    ? "text-secondary fw-normal"
                    : "text-dark fw-semibold"}
        `;

        descripcion.textContent = notificacion.descripcion;

        descripcion.style.overflow = "hidden";
        descripcion.style.whiteSpace = "nowrap";
        descripcion.style.textOverflow = "ellipsis";

        contenido.appendChild(descripcion);

        fila.appendChild(icono);
        fila.appendChild(contenido);

        if (esBuenaNoticia) {
            const badge = document.createElement("span");
            badge.className = "badge text-bg-warning";
            badge.textContent = "Buena noticia";
            fila.appendChild(badge);
        }

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
    ).textContent = notificacion.descripcion;

    const modal = bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modal-notificacion")
    );

    modal.show();
}

function renderizarPaginacion() {

    const paginacion = document.getElementById(
        "paginacion-notificaciones"
    );
    const informacion = document.getElementById(
        "informacion-paginacion-notificaciones"
    );

    paginacion.innerHTML = "";
    informacion.textContent =
        `Página ${totalPaginas === 0 ? 0 : paginaActual + 1} de ${totalPaginas}`;

    agregarBotonPaginacion(
        paginacion,
        "Anterior",
        paginaActual - 1,
        totalPaginas <= 1 || paginaActual === 0
    );

    agregarBotonPaginacion(
        paginacion,
        "Siguiente",
        paginaActual + 1,
        totalPaginas <= 1 || paginaActual >= totalPaginas - 1
    );
}

function agregarBotonPaginacion(
    contenedor,
    texto,
    pagina,
    deshabilitado
) {

    const elemento = document.createElement("li");

    elemento.className = `
        page-item
        ${deshabilitado ? "disabled" : ""}
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

    mostrarCargaCambioPagina();
    await new Promise(resolve => requestAnimationFrame(resolve));
    await cargarNotificaciones();
}

function mostrarCargaCambioPagina() {
    if (document.getElementById("pantalla-carga")) {
        return;
    }

    const pantalla = document.createElement("div");
    pantalla.id = "pantalla-carga";

    const indicador = document.createElement("div");
    indicador.className = "spinner-border text-danger";
    indicador.setAttribute("role", "status");

    const textoAccesible = document.createElement("span");
    textoAccesible.className = "visually-hidden";
    textoAccesible.textContent = "Cargando...";
    indicador.appendChild(textoAccesible);

    const mensaje = document.createElement("p");
    mensaje.className = "mt-3 text-secondary fw-semibold";
    mensaje.textContent = "Cargando...";

    pantalla.append(indicador, mensaje);
    document.body.appendChild(pantalla);
}

function ocultarCargaCambioPagina() {
    const pantalla = document.getElementById("pantalla-carga");

    if (!pantalla) {
        return;
    }

    pantalla.classList.add("oculto");
    setTimeout(() => pantalla.remove(), 300);
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
