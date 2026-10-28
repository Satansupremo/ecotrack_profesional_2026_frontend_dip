
document.addEventListener("DOMContentLoaded", inicializarLayout);

async function inicializarLayout() {
    const headerContainer = document.getElementById("site-header");
    const footerContainer = document.getElementById("site-footer");

    if (!headerContainer || !footerContainer) {
        return;
    }

    try {
        const [headerResponse, footerResponse] = await Promise.all([
            fetch("/components/header.html"),
            fetch("/components/footer.html")
        ]);

        if (!headerResponse.ok || !footerResponse.ok) {
            throw new Error("No se pudieron cargar los componentes.");
        }

        const [headerHTML, footerHTML] = await Promise.all([
            headerResponse.text(),
            footerResponse.text()
        ]);

        headerContainer.innerHTML = headerHTML;
        footerContainer.innerHTML = footerHTML;

        actualizarHeader();
    } catch (error) {
        console.error("Error al cargar los componentes:", error);
    }
}


function obtenerDatosToken() {
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

        const payload = JSON.parse(
            atob(
                payloadBase64.padEnd(
                    Math.ceil(payloadBase64.length / 4) * 4,
                    "="
                )
            )
        );

        if (!payload.sub || !payload.rol || !payload.exp) {
            return null;
        }

        if (payload.exp <= Math.floor(Date.now() / 1000)) {
            sessionStorage.removeItem("token");
            sessionStorage.removeItem("username");
            return null;
        }

        return {
            username: payload.sub,
            idUsuario: payload.idUsuario,
            rol: payload.rol
        };
    } catch (error) {
        console.error("No se pudo leer el JWT:", error);
        return null;
    }
}

function actualizarHeader() {
    const accessMenu = document.getElementById("access-menu");
    const userMenu = document.getElementById("user-menu");
    const usernameLabel = document.getElementById("header-username");
    const roleLabel = document.getElementById("header-role");
    const logoutButton = document.getElementById("logout-button");

    if (!accessMenu || !userMenu) {
        return;
    }

    const usuario = obtenerDatosToken();

    if (usuario) {
        accessMenu.classList.add("d-none");
        userMenu.classList.remove("d-none");

        if (usernameLabel) {
            usernameLabel.textContent =
                sessionStorage.getItem("username") || usuario.username;
        }

        if (roleLabel) {
            roleLabel.textContent = usuario.rol;
        }
    } else {
        accessMenu.classList.remove("d-none");
        userMenu.classList.add("d-none");
    }

    if (logoutButton && !logoutButton.dataset.eventoRegistrado) {
        logoutButton.addEventListener("click", cerrarSesion);
        logoutButton.dataset.eventoRegistrado = "true";
    }
}

function cerrarSesion() {
    sessionStorage.removeItem("token");
    sessionStorage.removeItem("username");

    window.location.href = "/index.html";
}
