
const API_URL_CARGA = "http://localhost:8080/api/carga";

const parametros = new URLSearchParams(window.location.search);

const idCola = parametros.get("idCola");
const idProgramacion = parametros.get("idProgramacion");
const idCargaParametro = parametros.get("idCarga");

let cargaActual = null;

document.addEventListener("DOMContentLoaded", async () => {

    if (!verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"])) {
        return;
    }

    const modalFinalizacionElemento = document.getElementById("modal-confirmar-finalizacion");
    const modalFinalizacion = bootstrap.Modal.getOrCreateInstance(modalFinalizacionElemento);
    document.getElementById("btn-confirmar-finalizacion")
        .addEventListener("click", async () => {
            modalFinalizacion.hide();
            await confirmarFinalizarCarga();
        });

    if (!idCola || !idProgramacion
        || !Number.isInteger(Number(idCola))
        || !Number.isInteger(Number(idProgramacion))
        || Number(idCola) <= 0
        || Number(idProgramacion) <= 0) {

        mostrarMensaje("No se recibieron los datos válidos de la salida.", "danger");
        document.getElementById("seccionPeso").classList.add("d-none");
        revelarContenido();
        return;
    }

    document.getElementById("codigoProgramacion").textContent =
        `PRG-${idProgramacion}`;

    document.getElementById("codigoSalida").textContent =
        `#${idCola}`;

    document.getElementById("btnVolver").href =
        obtenerUrlRetornoSalidas();

    await recuperarCargaExistente();
    revelarContenido();
});


async function recuperarCargaExistente() {

    try {

        const response = await fetchAutenticado(
            `${API_URL_CARGA}/salida/${idCola}`
        );

        const resultado = await response.json();

        if (!resultado.success) {
            mostrarMensaje(resultado.message, "danger");
            return;
        }

        if (!resultado.data) {
            cargaActual = null;
            mostrarEtapaPeso(false);
            return;
        }

        cargaActual = resultado.data;

        if (idCargaParametro
            && Number(idCargaParametro) !== Number(cargaActual.idCarga)) {

            mostrarMensaje(
                "La carga recuperada no coincide con la carga solicitada.",
                "danger"
            );
            return;
        }

        if (cargaActual.estado === "REGISTRADA") {
            mostrarMensaje(
                "Esta carga ya fue registrada.",
                "warning"
            );

            window.location.href =
                obtenerUrlRetornoSalidas();
            return;
        }

        mostrarEtapaArticulos(false);

    } catch (error) {

        mostrarMensaje(
            "No fue posible consultar la carga de esta salida.",
            "danger"
        );
    }
}


function mostrarEtapaPeso(animar = true) {

    cambiarEtapa("seccionArticulos", "seccionPeso", animar);

    document.getElementById("estadoCarga").textContent =
        "Pendiente de registro";

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-save me-1"></i> Guardar peso y continuar';
}

function mostrarEtapaArticulos(animar = true) {

    cambiarEtapa("seccionPeso", "seccionArticulos", animar);

    document.getElementById("estadoCarga").textContent =
        "En proceso";

    document.getElementById("pesoRegistrado").textContent =
        Number(cargaActual.pesoLibras).toFixed(2);

    document.getElementById("pesoLibras").value =
        cargaActual.pesoLibras;

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-save me-1"></i> Actualizar peso';

    if (document.getElementById("contenedorArticulos").children.length === 0) {
        agregarArticulo();
    }
}

async function guardarPeso() {

    const boton = document.getElementById("btnGuardarPeso");

    const peso = document.getElementById("pesoLibras").value;

    const request = {
        idCola: Number(idCola),
        pesoLibras: peso === "" ? null : Number(peso)
    };

    try {

        boton.disabled = true;

        const response = await fetchAutenticado(
            `${API_URL_CARGA}/iniciar`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            }
        );

        const resultado = await response.json();

        if (!resultado.success) {
            mostrarMensaje(resultado.message, "danger");
            return;
        }

        cargaActual = resultado.data;

        const nuevaUrl = new URL(window.location.href);
        nuevaUrl.searchParams.set("idCarga", cargaActual.idCarga);
        window.history.replaceState({}, "", nuevaUrl);

        mostrarMensaje(resultado.message, "success");
        mostrarEtapaArticulos();

    } catch (error) {

        mostrarMensaje(
            "No fue posible guardar el peso de la carga.",
            "danger"
        );

    } finally {

        boton.disabled = false;
    }
}

function agregarArticulo() {

    const contenedor = document.getElementById("contenedorArticulos");

    const fila = document.createElement("div");

    fila.className = "row g-2 align-items-end p-3 bg-light rounded-3 mb-3 mx-0";

    fila.innerHTML = `
        <div class="col-md-7">
            <label class="form-label">Artículo recuperado</label>
            <input type="text"
                   class="form-control articulo-nombre"
                   placeholder="Ej. Cartón">
        </div>

        <div class="col-md-3">
            <label class="form-label">Cantidad</label>
            <input type="number"
                   class="form-control articulo-cantidad"
                   placeholder="Ej. 25">
        </div>

        <div class="col-md-2">
            <button type="button"
                    class="btn btn-outline-danger w-100 btn-accion-eliminar"
                    onclick="eliminarArticulo(this)">
                <i class="bi bi-trash"></i>
                Eliminar
            </button>
        </div>
    `;

    contenedor.appendChild(fila);
}

function eliminarArticulo(boton) {

    boton.closest(".row").remove();
}

function finalizarCarga() {
    bootstrap.Modal.getOrCreateInstance(
        document.getElementById("modal-confirmar-finalizacion")
    ).show();
}

async function confirmarFinalizarCarga() {

    if (!cargaActual) {
        mostrarMensaje(
            "No se encontró una carga en proceso.",
            "danger"
        );
        return;
    }

    const filas = document.querySelectorAll("#contenedorArticulos .row");

    const articulos = Array.from(filas).map(fila => {

        const articulo = fila.querySelector(".articulo-nombre").value;
        const cantidad = fila.querySelector(".articulo-cantidad").value;

        return {
            articulo: articulo,
            cantidad: cantidad === "" ? null : Number(cantidad)
        };
    });

    const request = {
        idCarga: cargaActual.idCarga,
        articulos: articulos
    };

    const boton = document.getElementById("btnFinalizarCarga");

    try {

        boton.disabled = true;

        const response = await fetchAutenticado(
            `${API_URL_CARGA}/finalizar`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(request)
            }
        );

        const resultado = await response.json();

        if (!resultado.success) {
            mostrarMensaje(resultado.message, "danger");
            return;
        }

        document.getElementById("estadoCarga").textContent =
            "Registrada";

        mostrarMensaje(resultado.message, "success");

        setTimeout(() => {
            window.location.href =
                obtenerUrlRetornoSalidas();
        }, 1200);

    } catch (error) {

        mostrarMensaje(
            "No fue posible finalizar el registro de la carga.",
            "danger"
        );

    } finally {

        boton.disabled = false;
    }

}

function obtenerUrlRetornoSalidas() {
    const parametrosRetorno = new URLSearchParams({
        idProgramacion,
        pagina: parametros.get("pagina") || "0",
        buscar: parametros.get("buscar") || ""
    });

    return `gestionarSalidasProgramacion.html?${parametrosRetorno.toString()}`;
}

function mostrarMensaje(mensaje, tipo) {

    const contenedor = document.getElementById("mensaje");

    contenedor.textContent = mensaje;
    contenedor.className = `alert alert-${tipo}`;
}

function editarPeso() {

    cambiarEtapa("seccionArticulos", "seccionPeso");

    document.getElementById("pesoLibras").value =
        cargaActual.pesoLibras;

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-pencil-square me-1"></i> Actualizar peso';

    document.getElementById("estadoCarga").textContent =
        "Edición del peso";
}

function cambiarEtapa(idEtapaActual, idEtapaSiguiente, animar = true) {
    const etapaActual = document.getElementById(idEtapaActual);
    const etapaSiguiente = document.getElementById(idEtapaSiguiente);
    const reducirMovimiento = !animar || window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    ).matches;

    if (typeof etapaActual.getAnimations === "function") {
        etapaActual.getAnimations().forEach(animacion => animacion.cancel());
        etapaSiguiente.getAnimations().forEach(animacion => animacion.cancel());
    }

    etapaActual.classList.add("d-none");
    etapaSiguiente.classList.remove("d-none");

    if (!reducirMovimiento && typeof etapaSiguiente.animate === "function") {
        etapaSiguiente.animate(
            [
                { opacity: 0, transform: "translateY(8px)" },
                { opacity: 1, transform: "translateY(0)" }
            ],
            { duration: 220, easing: "ease-out" }
        );
    }
}

function revelarContenido() {
    const contenido = document.getElementById("contenido-principal");
    contenido.classList.remove("opacity-0");

    if (
        window.matchMedia("(prefers-reduced-motion: reduce)").matches ||
        typeof contenido.animate !== "function"
    ) {
        return;
    }

    contenido.animate(
        [
            { opacity: 0, transform: "translateY(10px)" },
            { opacity: 1, transform: "translateY(0)" }
        ],
        { duration: 260, easing: "ease-out" }
    );
}