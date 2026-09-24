export const GENERATION_PATHS = new Set(['/api/novelai/generate-image', '/api/plugins/autopic/generate-image', '/api/plugins/autopic/generate-direct']);
export function installTransport(host, enabled, destination = '/api/plugins/sharednai-bridge/generate', onComplete = () => {}) {
    const previous = host.fetch.bind(host);
    host.fetch = async function(input, init) {
        const request = input instanceof Request ? input : null;
        const url = new URL(request ? request.url : String(input), host.location.href);
        const method = (init?.method ?? request?.method ?? 'GET').toUpperCase();
        if (enabled() && url.origin === host.location.origin && url.pathname === '/api/plugins/autopic/direct-models' && method === 'GET') {
            return previous(destination.replace(/\/generate$/, '/direct-models'), init);
        }
        if (!enabled() || url.origin !== host.location.origin || !GENERATION_PATHS.has(url.pathname) || method !== 'POST') return previous(input, init);
        const target = url.pathname.endsWith('/generate-direct') ? destination.replace(/\/generate$/, '/generate-direct') : destination;
        const body = init?.body ?? (request ? await request.clone().text() : undefined);
        const headers = new Headers(init?.headers ?? request?.headers);
        // Keep ST's CSRF header; credentials belong only to the server session.
        headers.delete('Authorization');
        headers.set('Content-Type', 'application/json');
        try {
            const response = await previous(target, {...init, method: 'POST', body, headers, credentials: 'same-origin', signal: init?.signal ?? request?.signal});
            try { onComplete(response.status); } catch { /* UI must not affect generation */ }
            return response;
        } catch {
            // AutoPic retries thrown fetch errors via the original route. Return an
            // HTTP error instead to avoid a second, potentially billable generation.
            return Response.json({message: '이미지 요청 연결이 끊겼습니다. 사이트 생성 이력을 확인한 뒤 다시 시도하세요.'}, {status: 502});
        }
    };
}

