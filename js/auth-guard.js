
document.addEventListener("DOMContentLoaded", () => {
    const token = sessionStorage.getItem("token");

    if (!token) {
        return;
    }

    try {
        const partes = token.split(".");

        if (partes.length !== 3) {
            limpiarSesion();
            return;
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

        const tokenValido =
            payload.sub &&
            payload.exp &&
            payload.exp > Math.floor(Date.now() / 1000);

        if (tokenValido) {
            window.location.replace("/index.html");
            return;
        }

        limpiarSesion();
    } catch (error) {
        console.error("No se pudo validar la sesión:", error);
        limpiarSesion();
    }

    function limpiarSesion() {
        sessionStorage.removeItem("token");
        sessionStorage.removeItem("username");
    }
});
