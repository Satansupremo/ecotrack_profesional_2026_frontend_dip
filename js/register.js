const API_URL = "http://localhost:8080/api/usuario/registro";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("register-form");
    const message = document.getElementById("register-message");
    const registerButton = document.getElementById("register-button");

    let temporizadorMensaje;

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        ocultarMensaje();

        registerButton.disabled = true;
        registerButton.textContent = "Registrando...";

        const usuario = {
            nombre: document.getElementById("nombre").value,
            apellido: document.getElementById("apellido").value,
            dni: document.getElementById("dni").value,
            correo: document.getElementById("correo").value,
            celular: document.getElementById("celular").value,
            username: document.getElementById("username").value,
            password: document.getElementById("password").value
        };

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(usuario)
            });

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(resultado.message, "danger");
                return;
            }

            mostrarMensaje(resultado.message, "success");

            form.reset();

            temporizadorMensaje = setTimeout(() => {
                ocultarMensaje();
            }, 3000);

        } catch (error) {
            mostrarMensaje(
                "No se pudo obtener una respuesta del servidor.",
                "danger"
            );
        } finally {
            registerButton.disabled = false;
            registerButton.textContent = "Crear cuenta";
        }
    });

    function mostrarMensaje(texto, tipo) {
        clearTimeout(temporizadorMensaje);

        message.textContent =
            texto || "El servidor no proporcionó un mensaje.";

        message.className = `alert alert-${tipo}`;
    }

    function ocultarMensaje() {
        clearTimeout(temporizadorMensaje);
        message.textContent = "";
        message.className = "alert d-none";
    }
});