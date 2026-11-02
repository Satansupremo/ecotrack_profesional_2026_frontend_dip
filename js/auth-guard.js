
document.addEventListener("DOMContentLoaded", () => {

    const paginasAuth = [
        "/pages/auth/login.html",
        "/pages/auth/register.html"
    ];

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

function decodificarPayloadTokenAuth() {

    const token = sessionStorage.getItem("token");

    if (!token) {
        return null;
    }

    try {

        const partes = token.split(".");

        if (partes.length !== 3) {
            return null;
        }

        const payloadBase64 = partes[1]
            .replace(/-/g, "+")
            .replace(/_/g, "/");

        return JSON.parse(
            atob(
                payloadBase64.padEnd(
                    Math.ceil(payloadBase64.length / 4) * 4,
                    "="
                )
            )
        );

    } catch (error) {

        return null;
    }
}

function obtenerTokenValido() {

    const payload = decodificarPayloadTokenAuth();

    return Boolean(
        payload &&
        payload.sub &&
        payload.exp &&
        payload.exp > Math.floor(Date.now() / 1000)
    );
}

function obtenerRolUsuario() {

    const payload = decodificarPayloadTokenAuth();

    if (!payload || !obtenerTokenValido()) {
        return null;
    }

    return payload.rol || null;
}

function verificarAutenticacion() {

    if (!obtenerTokenValido()) {
        limpiarSesion();
        window.location.replace("/pages/auth/login.html");
        return false;
    }

    return true;
}

function verificarRolPermitido(rolesPermitidos) {

    if (!verificarAutenticacion()) {
        return false;
    }

    const rol = obtenerRolUsuario();

    if (!rol || !rolesPermitidos.includes(rol)) {
        window.location.replace("/index.html");
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

    if (respuesta.status === 401) {
        limpiarSesion();
        window.location.replace("/pages/auth/login.html");
        throw new Error("La sesión ha expirado o no es válida.");
    }

    return respuesta;
}

window.fetchAutenticado = fetchAutenticado;
