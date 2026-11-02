
document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) return;

    const API_PROGRAMACION = "http://localhost:8080/api/programacion";

    const parametros = new URLSearchParams(window.location.search);

    const idProgramacion = parametros.get("id");
    const idSolicitud = parametros.get("solicitud");
    const fecha = parametros.get("fecha");
    const pagina = parametros.get("pagina");

    const botonVolver = document.getElementById("volver");

    // VALIDAR PARÁMETROS

    if (
        !idProgramacion ||
        !/^\d+$/.test(idProgramacion) ||
        Number(idProgramacion) <= 0 ||
        !idSolicitud ||
        !/^\d+$/.test(idSolicitud) ||
        Number(idSolicitud) <= 0
    ) {

        mostrarMensaje("Los códigos proporcionados no son válidos.", "danger");
        botonVolver.disabled = true;

        return;
    }

    // VOLVER A LA PANTALLA ANTERIOR

    botonVolver.addEventListener("click", () => {

        const url = new URLSearchParams({
            id: idSolicitud
        });

        if (fecha) {
            url.set("fecha", fecha);
            url.set("pagina", pagina || "0");
        }

        window.location.href =
            `/pages/programacion/registrarProgramacion.html?${url.toString()}`;

    });

    // CARGAR DETALLE

    cargarProgramacion();

    async function cargarProgramacion() {

        try {

            const respuesta = await fetchAutenticado(
                `${API_PROGRAMACION}/detalle/${idProgramacion}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo obtener el detalle de la programación."
                );
            }

            mostrarProgramacion(resultado.data);

        } catch (error) {

            mostrarMensaje(error.message, "danger");

        }

    }

    // MOSTRAR INFORMACIÓN

    function mostrarProgramacion(programacion) {

        document.getElementById("id-programacion").textContent =
            programacion.idProgramacion ?? "-";

        const estadoProgramacion = document.getElementById("estado-programacion");
        estadoProgramacion.textContent = formatearEstado(programacion.estado);
        estadoProgramacion.className = "badge " + obtenerClaseEstado(programacion.estado);

        document.getElementById("fecha-registro-programacion").textContent =
            formatearFechaHora(programacion.fechaRegistro);

        document.getElementById("fecha-ejecucion").textContent =
            formatearFecha(programacion.fechaEjecucion);

        document.getElementById("jefe-unidad").textContent =
            `${programacion.nombreJefeUnidad ?? ""} ${programacion.apellidoJefeUnidad ?? ""}`.trim() || "-";

        document.getElementById("id-solicitud").textContent =
            programacion.idSolicitud ?? "-";

        document.getElementById("titulo-solicitud").textContent =
            programacion.tituloSolicitud ?? "-";

        document.getElementById("descripcion-solicitud").textContent =
            programacion.descripcionSolicitud ?? "-";

        document.getElementById("ubicacion-solicitud").textContent =
            programacion.ubicacionSolicitud ?? "-";

        document.getElementById("fecha-registro-solicitud").textContent =
            formatearFechaHora(programacion.fechaRegistroSolicitud);

        document.getElementById("cantidad-unidades").textContent =
            programacion.cantidadUnidades ?? "-";

        document.getElementById("razon-cantidad-unidades").textContent =
            programacion.razonCantidadUnidades ?? "-";

        document.getElementById("equipo-seguridad").textContent =
            programacion.equipoSeguridad ?? "-";

        document.getElementById("otras-recomendaciones").textContent =
            programacion.otrasRecomendaciones ?? "-";

    }

    // FORMATEAR FECHAS

    function formatearFecha(fecha) {

        if (!fecha) return "-";

        const partes = fecha.split("T")[0].split("-");

        if (partes.length !== 3) return fecha;

        return `${partes[2]}/${partes[1]}/${partes[0]}`;

    }

    function formatearFechaHora(fecha) {

        if (!fecha) return "-";

        const partes = fecha.split("T");

        if (partes.length !== 2) {
            return formatearFecha(fecha);
        }

        return `${formatearFecha(partes[0])} ${partes[1].substring(0, 5)}`;

    }

    // FORMATEAR ESTADO

    function formatearEstado(estado) {

        if (!estado) return "-";

        return estado.replaceAll("_", " ");

    }

    function obtenerClaseEstado(estado) {
        const estadoNormalizado = String(estado || "").toUpperCase();

        if (estadoNormalizado.includes("PENDIENTE")) {
            return "bg-warning-subtle text-warning-emphasis";
        }

        if (estadoNormalizado.includes("APROB") || estadoNormalizado.includes("CONFIRM")) {
            return "bg-success-subtle text-success-emphasis";
        }

        if (estadoNormalizado.includes("RECH")) {
            return "bg-danger-subtle text-danger-emphasis";
        }

        return "bg-secondary-subtle text-secondary-emphasis";
    }

    // MOSTRAR MENSAJES

    function mostrarMensaje(mensaje, tipo) {

        const contenedor = document.getElementById("mensaje-container");

        contenedor.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button
                    type="button"
                    class="btn-close"
                    data-bs-dismiss="alert"
                    aria-label="Cerrar"
                ></button>
            </div>
        `;

        window.scrollTo({
            top: 0,
            behavior: "smooth"
        });

    }

    // ESCAPAR HTML

    function escaparHTML(valor) {

        const elemento = document.createElement("div");
        elemento.textContent = valor ?? "";

        return elemento.innerHTML;

    }

});
