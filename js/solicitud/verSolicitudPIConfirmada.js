
document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const API_URL = "http://localhost:8080/api/solicitud/pi-confirmadas";

    const parametros = new URLSearchParams(window.location.search);
    const idSolicitud = parametros.get("id");

    const botonCancelar = document.getElementById("cancelar");
    const botonAsignarTotal = document.getElementById("asignar-total");

    if (!idSolicitud || !/^\d+$/.test(idSolicitud) || Number(idSolicitud) <= 0) {
        mostrarMensaje("El código de solicitud no es válido.", "danger");
        botonAsignarTotal.classList.add("disabled");
        return;
    }

    botonCancelar.addEventListener("click", () => {
        window.location.href =
            "/pages/solicitud/gestionarSolicitudesPIConfirmadas.html";
    });

    botonAsignarTotal.href =
        `/pages/solicitud/asignarPagoTotal.html?id=${idSolicitud}`;

    cargarSolicitud();

    async function cargarSolicitud() {
        try {
            const respuesta = await fetchAutenticado(
                `${API_URL}/buscar/${idSolicitud}`
            );

            const resultado = await respuesta.json();

            if (!respuesta.ok || !resultado.success) {
                throw new Error(
                    resultado.message || "No se pudo obtener la solicitud."
                );
            }

            mostrarSolicitud(resultado.data);

        } catch (error) {
            mostrarMensaje(error.message, "danger");
            botonAsignarTotal.classList.add("disabled");
        }
    }

    function mostrarSolicitud(solicitud) {

        document.getElementById("id-solicitud").textContent =
            solicitud.idSolicitud;

        document.getElementById("titulo-solicitud").textContent =
            solicitud.titulo || "-";

        document.getElementById("descripcion-solicitud").textContent =
            solicitud.descripcion || "-";

        document.getElementById("ubicacion-solicitud").textContent =
            solicitud.ubicacion || "-";

        document.getElementById("fecha-solicitud").textContent =
            formatearFecha(solicitud.fechaRegistro);

        const estadoSolicitud = document.getElementById("estado-solicitud");
        estadoSolicitud.textContent = solicitud.estado || "-";
        estadoSolicitud.dataset.estado = solicitud.estado || "";

        document.getElementById("nombre-cliente").textContent =
            `${solicitud.nombreUsuario || ""} ${solicitud.apellidoUsuario || ""}`.trim() || "-";

        document.getElementById("correo-cliente").textContent =
            solicitud.correo || "-";

        document.getElementById("telefono-cliente").textContent =
            solicitud.celular || "-";
    }

    function formatearFecha(fecha) {
        if (!fecha) {
            return "-";
        }

        const valor = new Date(fecha);

        if (Number.isNaN(valor.getTime())) {
            return fecha;
        }

        return valor.toLocaleString("es-PE");
    }

    function mostrarMensaje(mensaje, tipo) {
        const contenedor = document.getElementById("mensaje-container");

        contenedor.innerHTML = "";

        const alerta = document.createElement("div");
        alerta.className = `alert alert-${tipo} alert-dismissible fade show`;
        alerta.setAttribute("role", "alert");
        alerta.textContent = mensaje;

        const botonCerrar = document.createElement("button");
        botonCerrar.type = "button";
        botonCerrar.className = "btn-close";
        botonCerrar.setAttribute("data-bs-dismiss", "alert");
        botonCerrar.setAttribute("aria-label", "Cerrar");

        alerta.appendChild(botonCerrar);
        contenedor.appendChild(alerta);
    }
});
