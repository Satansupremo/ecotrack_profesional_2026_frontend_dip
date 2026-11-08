
const API_URL_COLA = "http://localhost:8080/api/cola";
const API_URL_CARGA = "http://localhost:8080/api/carga";

const idProgramacion = new URLSearchParams(window.location.search)
    .get("idProgramacion");

let salidas = [];
let cargas = [];

document.addEventListener("DOMContentLoaded", async () => {

    verificarRolPermitido(["OPERARIO", "ADMINISTRADOR"]);

    if (!idProgramacion || !Number.isInteger(Number(idProgramacion)) || Number(idProgramacion) <= 0) {
        mostrarMensaje("No se recibió un código de programación válido.", "danger");

        document.getElementById("tablaSalidas").innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    No se pudo identificar la programación.
                </td>
            </tr>
        `;
        return;
    }

    document.getElementById("codigoProgramacion").textContent =
        `PRG-${idProgramacion}`;

    await cargarSalidas();
});

async function cargarSalidas() {

    const tabla = document.getElementById("tablaSalidas");

    try {

        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center py-4">
                    Cargando salidas...
                </td>
            </tr>
        `;

        const [responseSalidas, responseCargas] = await Promise.all([
            fetchAutenticado(
                `${API_URL_COLA}/programacion/${idProgramacion}/listar`
            ),
            fetchAutenticado(
                `${API_URL_CARGA}/programacion/${idProgramacion}/listar`
            )
        ]);

        const resultadoSalidas = await responseSalidas.json();
        const resultadoCargas = await responseCargas.json();

        if (!resultadoSalidas.success) {
            mostrarMensaje(resultadoSalidas.message, "danger");
            return;
        }

        if (!resultadoCargas.success) {
            mostrarMensaje(resultadoCargas.message, "danger");
            return;
        }

        salidas = resultadoSalidas.data || [];
        cargas = resultadoCargas.data || [];

        actualizarResumen();
        renderizarSalidas();

    } catch (error) {

        mostrarMensaje(
            "No fue posible obtener la información de las salidas.",
            "danger"
        );

        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-danger py-4">
                    Error al cargar las salidas.
                </td>
            </tr>
        `;
    }
}

function obtenerCargaPorSalida(idCola) {

    return cargas.find(
        carga => Number(carga.idCola) === Number(idCola)
    );
}

function actualizarResumen() {

    const pendientes = salidas.filter(
        salida => !obtenerCargaPorSalida(salida.idCola)
    ).length;

    const enProceso = cargas.filter(
        carga => carga.estado === "EN_PROCESO"
    ).length;

    document.getElementById("totalSalidas").textContent = salidas.length;
    document.getElementById("salidasPendientes").textContent = pendientes;
    document.getElementById("cargasEnProceso").textContent = enProceso;
}

function renderizarSalidas() {

    const tabla = document.getElementById("tablaSalidas");

    if (salidas.length === 0) {
        tabla.innerHTML = `
            <tr>
                <td colspan="6" class="text-center text-muted py-4">
                    Esta programación no tiene salidas registradas.
                </td>
            </tr>
        `;
        return;
    }

    tabla.innerHTML = salidas.map(salida => {

        const carga = obtenerCargaPorSalida(salida.idCola);

        let estado;
        let accion;

        if (!carga) {

            estado = `
                <span class="badge bg-warning text-dark">
                    Pendiente de registro
                </span>
            `;

            accion = `
                <button class="btn btn-sm btn-success"
                        onclick="iniciarRegistroCarga(${salida.idCola})">
                    <i class="bi bi-plus-circle me-1"></i>
                    Registrar carga
                </button>
            `;

        } else if (carga.estado === "EN_PROCESO") {

            estado = `
                <span class="badge bg-info text-dark">
                    En proceso
                </span>
            `;

            accion = `
                <button class="btn btn-sm btn-outline-primary"
                        onclick="continuarRegistroCarga(${salida.idCola})">
                    <i class="bi bi-arrow-repeat me-1"></i>
                    Continuar registro
                </button>
            `;

        } else if (carga.estado === "REGISTRADA") {

            estado = `
                <span class="badge bg-success">
                    Registrada
                </span>
            `;

            accion = `
                <button class="btn btn-sm btn-outline-success" disabled>
                    <i class="bi bi-check-circle me-1"></i>
                    Carga registrada
                </button>
            `;

        } else {

            estado = `
                <span class="badge bg-secondary">
                    Estado desconocido
                </span>
            `;

            accion = `
                <button class="btn btn-sm btn-outline-secondary" disabled>
                    No disponible
                </button>
            `;
        }

        return `
            <tr>
                <td>#${salida.idCola}</td>

                <td>
                    ${escaparHTML(salida.nombreTransportista)}
                    ${escaparHTML(salida.apellidoTransportista)}
                </td>

                <td>
                    <strong>${escaparHTML(salida.placaVehiculo)}</strong>
                    <br>
                    <small class="text-muted">
                        ${escaparHTML(salida.tipoVehiculo)}
                    </small>
                </td>

                <td>${formatearFecha(salida.fechaRegistro)}</td>

                <td>${estado}</td>

                <td>${accion}</td>
            </tr>
        `;

    }).join("");
}

function iniciarRegistroCarga(idCola) {

    const salida = salidas.find(
        item => Number(item.idCola) === Number(idCola)
    );

    if (!salida) {
        mostrarMensaje("No se encontró la salida seleccionada.", "danger");
        return;
    }

    const carga = obtenerCargaPorSalida(idCola);

    if (carga) {
        mostrarMensaje(
            "Esta salida ya tiene una carga iniciada.",
            "warning"
        );
        return;
    }

    window.location.href =
        `asignarPesoCarga.html?idCola=${idCola}&idProgramacion=${idProgramacion}`;
}

function continuarRegistroCarga(idCola) {

    const carga = obtenerCargaPorSalida(idCola);

    if (!carga || carga.estado !== "EN_PROCESO") {
        mostrarMensaje(
            "No se encontró una carga pendiente de continuar.",
            "warning"
        );
        return;
    }

    window.location.href =
        `asignarPesoCarga.html?idCola=${idCola}&idProgramacion=${idProgramacion}&idCarga=${carga.idCarga}`;
}

function formatearFecha(fecha) {

    if (!fecha) return "-";

    return new Date(fecha).toLocaleString("es-PE", {
        dateStyle: "short",
        timeStyle: "short"
    });
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

    contenedor.textContent = mensaje;
    contenedor.className = `alert alert-${tipo}`;
}
