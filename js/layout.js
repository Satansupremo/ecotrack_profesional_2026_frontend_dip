
document.addEventListener("DOMContentLoaded", async () => {
    await inicializarLayout();
    ocultarPantallaCarga();
});

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
        return null;
    }
}

function actualizarHeader() {
    const accessMenu = document.getElementById("access-menu");
    const userMenu = document.getElementById("user-menu");
    const notificationMenu = document.getElementById("notification-menu");
    const usernameLabel = document.getElementById("header-username");
    const roleLabel = document.getElementById("header-role");
    const logoutButton = document.getElementById("logout-button");

    const menuMisSolicitudes = document.getElementById("menu-mis-solicitudes");
    const menuMisProgramaciones = document.getElementById("menu-mis-programaciones");
    const menuSolicitudesPendientes = document.getElementById("menu-solicitudes-pendientes");
    const menuSolicitudesPIE = document.getElementById("menu-solicitudes-pie");
    const menuSolicitudesPIConfirmadas = document.getElementById("menu-solicitudes-pi-confirmadas");
    const menuSolicitudesPagoTotal = document.getElementById("menu-solicitudes-pago-total");

    if (!accessMenu || !userMenu) {
        return;
    }

    const usuario = obtenerDatosToken();

    if (usuario) {
        accessMenu.classList.add("d-none");
        userMenu.classList.remove("d-none");
        notificationMenu?.classList.remove("d-none");

        if (usernameLabel) {
            usernameLabel.textContent =
                sessionStorage.getItem("username") || usuario.username;
        }

        if (roleLabel) {
            roleLabel.textContent = usuario.rol;
        }

        menuMisSolicitudes?.classList.remove("d-none");

        const rolesGestionProgramaciones = ["ADMINISTRADOR", "JEFE_UNIDAD"];
        const tienePermisoProgramaciones = rolesGestionProgramaciones.includes(usuario.rol);

        menuMisProgramaciones?.classList.toggle(
            "d-none",
            !tienePermisoProgramaciones
        );

        const rolesGestionSolicitudes = ["ADMINISTRADOR", "COORDINADOR"];
        const tienePermisoGestion = rolesGestionSolicitudes.includes(usuario.rol);

        if (tienePermisoGestion) {
            menuSolicitudesPendientes?.classList.remove("d-none");
            menuSolicitudesPIE?.classList.remove("d-none");
            menuSolicitudesPIConfirmadas?.classList.remove("d-none");
            menuSolicitudesPagoTotal?.classList.remove("d-none");

            actualizarContadoresSolicitudes();
        } else {
            menuSolicitudesPendientes?.classList.add("d-none");
            menuSolicitudesPIE?.classList.add("d-none");
            menuSolicitudesPIConfirmadas?.classList.add("d-none");
            menuSolicitudesPagoTotal?.classList.add("d-none");
        }

        actualizarContadorNotificaciones();

    } else {
        accessMenu.classList.remove("d-none");
        userMenu.classList.add("d-none");
        notificationMenu?.classList.add("d-none");

        menuMisProgramaciones?.classList.add("d-none");
        menuSolicitudesPendientes?.classList.add("d-none");
        menuSolicitudesPIE?.classList.add("d-none");
        menuSolicitudesPIConfirmadas?.classList.add("d-none");
        menuSolicitudesPagoTotal?.classList.add("d-none");
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

async function actualizarContadoresSolicitudes() {
    await Promise.all([
        actualizarContador(
            "http://localhost:8080/api/solicitud/pendientes/total",
            "contador-solicitudes-pendientes"
        ),
        actualizarContador(
            "http://localhost:8080/api/solicitud/pie/total",
            "contador-solicitudes-pie"
        ),
        actualizarContador(
            "http://localhost:8080/api/solicitud/pi-confirmadas/total",
            "contador-solicitudes-pi-confirmadas"
        ),
        actualizarContador(
            "http://localhost:8080/api/solicitud/pago-total/total",
            "contador-solicitudes-pago-total"
        )
    ]);
}

async function actualizarContador(url, elementoId) {
    const contador = document.getElementById(elementoId);

    if (!contador) {
        return;
    }

    try {
        const respuesta = await fetchAutenticado(url);
        const resultado = await respuesta.json();

        if (!respuesta.ok || !resultado.success) {
            throw new Error(resultado.message || "No se pudo obtener el total.");
        }

        const cantidad = Number(resultado.data);

        if (cantidad > 0) {
            contador.textContent = cantidad;
            contador.classList.remove("d-none");
        } else {
            contador.textContent = "";
            contador.classList.add("d-none");
        }

    } catch (error) {
        contador.textContent = "";
        contador.classList.add("d-none");
    }
}

async function actualizarContadorNotificaciones() {
    await actualizarContador(
        "http://localhost:8080/api/notificacion/no-leidas/total",
        "contador-notificaciones"
    );
}

function ocultarPantallaCarga() {
    const pantallaCarga = document.getElementById("pantalla-carga");

    if (pantallaCarga) {
        pantallaCarga.classList.add("oculto");

        setTimeout(() => {
            pantallaCarga.remove();
        }, 300);
    }
}
