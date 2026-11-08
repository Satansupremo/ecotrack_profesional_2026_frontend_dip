
const API_URL_CARGA = "http://localhost:8080/api/carga";

const parametros = new URLSearchParams(window.location.search);

const idCola = parametros.get("idCola");
const idProgramacion = parametros.get("idProgramacion");
const idCargaParametro = parametros.get("idCarga");

let cargaActual = null;

document.addEventListener("DOMContentLoaded", async () => {

    verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"]);

    if (!idCola || !idProgramacion
        || !Number.isInteger(Number(idCola))
        || !Number.isInteger(Number(idProgramacion))
        || Number(idCola) <= 0
        || Number(idProgramacion) <= 0) {

        mostrarMensaje("No se recibieron los datos válidos de la salida.", "danger");
        document.getElementById("seccionPeso").classList.add("d-none");
        return;
    }

    document.getElementById("codigoProgramacion").textContent =
        `PRG-${idProgramacion}`;

    document.getElementById("codigoSalida").textContent =
        `#${idCola}`;

    document.getElementById("btnVolver").href =
        `gestionarSalidasProgramacion.html?idProgramacion=${idProgramacion}`;

    await recuperarCargaExistente();
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
            mostrarEtapaPeso();
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
                `gestionarSalidasProgramacion.html?idProgramacion=${idProgramacion}`;
            return;
        }

        mostrarEtapaArticulos();

    } catch (error) {

        mostrarMensaje(
            "No fue posible consultar la carga de esta salida.",
            "danger"
        );
    }
}


function mostrarEtapaPeso() {

    document.getElementById("seccionPeso").classList.remove("d-none");
    document.getElementById("seccionArticulos").classList.add("d-none");

    document.getElementById("estadoCarga").textContent =
        "Pendiente de registro";

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-save me-1"></i> Guardar peso';
}

function mostrarEtapaArticulos() {

    document.getElementById("seccionPeso").classList.add("d-none");
    document.getElementById("seccionArticulos").classList.remove("d-none");

    document.getElementById("estadoCarga").textContent =
        "En proceso";

    document.getElementById("pesoRegistrado").textContent =
        Number(cargaActual.pesoLibras).toFixed(2);

    document.getElementById("pesoLibras").value =
        cargaActual.pesoLibras;

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-save me-1"></i> Guardar peso';

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

    fila.className = "row g-2 align-items-end mb-3";

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
                    class="btn btn-outline-danger w-100"
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

async function finalizarCarga() {

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
                `gestionarSalidasProgramacion.html?idProgramacion=${idProgramacion}`;
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

function mostrarMensaje(mensaje, tipo) {

    const contenedor = document.getElementById("mensaje");

    contenedor.textContent = mensaje;
    contenedor.className = `alert alert-${tipo}`;
}

function editarPeso() {

    document.getElementById("seccionArticulos").classList.add("d-none");
    document.getElementById("seccionPeso").classList.remove("d-none");

    document.getElementById("pesoLibras").value =
        cargaActual.pesoLibras;

    document.getElementById("btnGuardarPeso").innerHTML =
        '<i class="bi bi-pencil-square me-1"></i> Actualizar peso';

    document.getElementById("estadoCarga").textContent =
        "Edición del peso";
}