
const API_URL = "http://localhost:8080/api/usuario/login";

document.addEventListener("DOMContentLoaded", () => {
    const form = document.getElementById("login-form");
    const usernameInput = document.getElementById("username");
    const passwordInput = document.getElementById("password");
    const message = document.getElementById("login-message");
    const loginButton = document.getElementById("login-button");

    form.addEventListener("submit", async (event) => {
        event.preventDefault();

        message.textContent = "";
        message.className = "alert d-none";

        loginButton.disabled = true;
        loginButton.textContent = "Ingresando...";

        try {
            const response = await fetch(API_URL, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    username: usernameInput.value,
                    password: passwordInput.value
                })
            });

            const resultado = await response.json();

            if (!response.ok || !resultado.success) {
                mostrarMensaje(
                    resultado.message,
                    "danger"
                );
                return;
            }


            sessionStorage.setItem("token", resultado.data);
            sessionStorage.setItem("username", usernameInput.value.trim());

            mostrarMensaje(resultado.message, "success");

            setTimeout(() => {
                window.location.href = "/index.html";
            }, 2000);

            return;


        } catch (error) {
            mostrarMensaje(
                "No se pudo obtener una respuesta del servidor.",
                "danger"
            );
        } finally {
            loginButton.disabled = false;
            loginButton.textContent = "Iniciar sesión";
        }
    });

    function mostrarMensaje(texto, tipo) {
        message.textContent = texto || "El servidor no proporcionó un mensaje.";
        message.className = `alert alert-${tipo}`;
    }

    function obtenerDatosToken() {
        const token = sessionStorage.getItem("token");

        if (!token) {
            return null;
        }

        try {
            const payload = JSON.parse(atob(token.split(".")[1]));

            return {
                idUsuario: payload.idUsuario,
                username: payload.sub,
                rol: payload.rol
            };
        } catch {
            return null;
        }
    }
});
