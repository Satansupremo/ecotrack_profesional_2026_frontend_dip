
const API_URL = "http://localhost:8080/api/solicitud";

document.addEventListener("DOMContentLoaded", () => {

    if (!verificarAutenticacion()) {
        return;
    }

    const formulario = document.getElementById("form-solicitud");
    const botonRegistrar = document.getElementById("btn-registrar");
    const mensajeContainer = document.getElementById("mensaje-container");

    formulario.addEventListener("submit", async event => {
        event.preventDefault();

        const solicitud = {
            titulo: document.getElementById("titulo").value.trim(),
            descripcion: document.getElementById("descripcion").value.trim(),
            ubicacion: document.getElementById("ubicacion").value.trim()
        };

        mensajeContainer.innerHTML = "";

        botonRegistrar.disabled = true;
        botonRegistrar.innerHTML = `
            <span class="spinner-border spinner-border-sm me-2"></span>
            Registrando...
        `;

        try {
            const response = await fetchAutenticado(`${API_URL}/registrar`, {
                method: "POST",
                body: JSON.stringify(solicitud)
            });

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            mostrarMensaje(resultado.message, "success");

            formulario.reset();

            setTimeout(() => {
                window.location.href =
                    "/pages/solicitud/gestionarMisSolicitudes.html";
            }, 2000);

        } catch (error) {
            console.error("Error al registrar solicitud:", error);

            mostrarMensaje(
                "No se pudo obtener una respuesta del servidor.",
                "danger"
            );

        } finally {
            botonRegistrar.disabled = false;
            botonRegistrar.innerHTML = `
                <i class="bi bi-check-circle me-2"></i>
                Registrar solicitud
            `;
        }
    });

    function mostrarMensaje(mensaje, tipo) {
        mensajeContainer.innerHTML = `
            <div class="alert alert-${tipo} alert-dismissible fade show" role="alert">
                ${escaparHTML(mensaje)}
                <button type="button" class="btn-close" data-bs-dismiss="alert"></button>
            </div>
        `;
    }

    function escaparHTML(valor) {
        return String(valor ?? "").replace(/[&<>"']/g, caracter => ({
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            '"': "&quot;",
            "'": "&#39;"
        })[caracter]);
    }
});
