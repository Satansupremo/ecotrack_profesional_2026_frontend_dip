self.addEventListener("install", event => {
    event.waitUntil(self.skipWaiting());
});

self.addEventListener("activate", event => {
    event.waitUntil(self.clients.claim());
});

self.addEventListener("fetch", event => {
    const request = event.request;
    const url = new URL(request.url);

    if (
        request.method !== "GET" ||
        request.mode !== "navigate" ||
        url.origin !== self.location.origin
    ) {
        return;
    }

    event.respondWith(
        fetch(request).then(async response => {
            if (response.status !== 404) {
                return response;
            }

            const paginaError = await fetch("/404.html", { cache: "no-store" });

            if (!paginaError.ok) {
                return response;
            }

            return new Response(await paginaError.text(), {
                status: 404,
                statusText: "Not Found",
                headers: {
                    "Content-Type": "text/html; charset=utf-8"
                }
            });
        })
    );
});
