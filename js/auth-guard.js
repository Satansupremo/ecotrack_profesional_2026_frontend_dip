
document.addEventListener("DOMContentLoaded", () => {

    const paginasAuth = [
        "/pages/auth/login.html",
        "/pages/auth/register.html"
    ];

    // Solo redirigir al inicio si estamos en login o registro.
    if (!paginasAuth.includes(window.location.pathname)) {
        return;
    }

    const token = sessionStorage.getItem("token");

    if (!token) {
        return;
    }

    if (obtenerTokenValido()) {
        window.location.replace("/index.html");
    } else {
        limpiarSesion();
    }
});

function obtenerTokenValido() {
    const token = sessionStorage.getItem("token");

    if (!token) {
        return false;
    }

    try {
        const partes = token.split(".");

        if (partes.length !== 3) {
            return false;
        }

        const payloadBase64 = partes[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        const payload = JSON.parse(
            atob(
                payloadBase64.padEnd(
                    Math.ceil(payloadBase64.length / 4) * 4,
                    "="
                )
            )
        );

        return Boolean(
            payload.sub &&
            payload.exp &&
            payload.exp > Math.floor(Date.now() / 1000)
        );

    } catch (error) {
        console.error("No se pudo validar la sesión:", error);
        return false;
    }
}

function verificarAutenticacion() {
    if (!obtenerTokenValido()) {
        limpiarSesion();
        window.location.replace("/pages/auth/login.html");
        return false;
    }

    return true;
}

function limpiarSesion() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");
}

async function fetchAutenticado(url, opciones = {}) {

    const token = sessionStorage.getItem("token");

    if (!token || !obtenerTokenValido()) {
        limpiarSesion();
        window.location.replace("/pages/auth/login.html");
        throw new Error("La sesión ha expirado.");
    }

    const headers = {
        ...opciones.headers,
        "Authorization": `Bearer ${token}`
    };

    if (opciones.body && !headers["Content-Type"]) {
        headers["Content-Type"] = "application/json";
    }

    const respuesta = await fetch(url, {
        ...opciones,
        headers
    });

    if (respuesta.status === 401 || respuesta.status === 403) {
        limpiarSesion();
        window.location.replace("/pages/auth/login.html");
        throw new Error("No tienes autorización o tu sesión ha expirado.");
    }

    return respuesta;
}

window.fetchAutenticado = fetchAutenticado;