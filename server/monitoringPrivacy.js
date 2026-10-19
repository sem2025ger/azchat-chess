// Standalone server copy of tmp/src/monitoring/privacy.ts (types erased).
// Keep both boundaries aligned; adversarial fixtures test both packages.
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.safeRelease = safeRelease;
exports.safeEnvironment = safeEnvironment;
exports.sanitizeUrl = sanitizeUrl;
exports.sanitizeBreadcrumb = sanitizeBreadcrumb;
exports.safeDatabaseCode = safeDatabaseCode;
exports.persistenceDiagnostics = persistenceDiagnostics;
exports.sanitizeEvent = sanitizeEvent;
exports.sanitizeEnvelope = sanitizeEnvelope;
exports.privateDataCollection = privateDataCollection;
function fields(value) {
    return value !== null && typeof value === 'object' && !Array.isArray(value)
        ? value : {};
}
const LEVELS = new Set(['fatal', 'error', 'warning', 'info', 'debug']);
const ERROR_TYPES = new Set([
    'Error', 'TypeError', 'RangeError', 'ReferenceError', 'SyntaxError',
    'URIError', 'EvalError', 'AggregateError', 'MatchPersistenceError',
]);
const METHODS = new Set(['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'HEAD', 'OPTIONS']);
const HOSTS = new Set([
    'chessaz.de', 'www.chessaz.de', 'chessaz-preview.vercel.app',
    'chessaz-api.onrender.com', 'localhost', '127.0.0.1',
]);
const ROUTES = new Set(['/', '/health', '/home', '/play', '/analysis', '/profile', '/settings']);
const SERVER_FILES = new Set([
    'index.js', 'matchPersistence.js', 'socketAuth.js', 'rateLimiter.js',
    'timeoutManager.js', 'monitoring.js', 'monitoringPrivacy.js',
]);
function safeRelease(value) {
    return typeof value === 'string' && /^[a-f0-9]{40}$/i.test(value) ? value : undefined;
}
function safeEnvironment(value) {
    return typeof value === 'string' && /^[a-z][a-z0-9-]{0,31}$/.test(value)
        ? value : 'unspecified';
}
function safePath(path) {
    if (ROUTES.has(path))
        return path;
    // Only emitted static JS/CSS names; never arbitrary IDs or private room paths.
    if (/^\/assets\/[a-zA-Z0-9_-]{1,100}\.(?:js|css)$/.test(path))
        return path;
    return '/[redacted]';
}
function sanitizeUrl(value) {
    if (typeof value !== 'string')
        return '[redacted-url]';
    try {
        const url = new URL(value, 'https://chessaz.de');
        const knownHost = HOSTS.has(url.hostname)
            || /^azchat-chess-[a-z0-9-]+-semov20207-3068s-projects\.vercel\.app$/.test(url.hostname);
        if (!knownHost || !['https:', 'http:'].includes(url.protocol))
            return '[redacted-url]';
        // origin excludes credentials, search and fragment. Unknown hosts (including
        // Supabase project hosts), paths and encoded path identifiers are redacted.
        const origin = HOSTS.has(url.hostname) ? url.origin : 'https://chessaz-preview.vercel.app';
        return origin + safePath(url.pathname);
    }
    catch {
        return '[redacted-url]';
    }
}
function sanitizeFilename(value) {
    if (typeof value !== 'string')
        return '[redacted-file]';
    if (/^(?:https?:\/\/|\/assets\/)/.test(value))
        return sanitizeUrl(value);
    const name = value.split(/[?#]/, 1)[0].replaceAll('\\', '/').split('/').pop() || '';
    return SERVER_FILES.has(name) ? name : '[redacted-file]';
}
function safeFrame(value) {
    const frame = fields(value);
    const output = { filename: sanitizeFilename(frame.filename) };
    for (const key of ['lineno', 'colno']) {
        const number = frame[key];
        if (typeof number === 'number' && Number.isSafeInteger(number) && number >= 0)
            output[key] = number;
    }
    if (typeof frame.in_app === 'boolean')
        output.in_app = frame.in_app;
    return output;
}
function sanitizeBreadcrumb(value) {
    try {
        const crumb = fields(value);
        // No console, DOM, navigation or application messages: these may include
        // chat content, moves, usernames, bearer tokens or private room identifiers.
        if (typeof crumb.category !== 'string' || !['fetch', 'xhr', 'http'].includes(crumb.category))
            return null;
        const data = fields(crumb.data);
        return {
            category: crumb.category,
            type: 'http',
            ...(typeof crumb.timestamp === 'number' && Number.isFinite(crumb.timestamp)
                ? { timestamp: crumb.timestamp } : {}),
            data: {
                url: sanitizeUrl(data.url),
                ...(typeof data.method === 'string' && METHODS.has(data.method) ? { method: data.method } : {}),
                ...(typeof data.status_code === 'number' && Number.isInteger(data.status_code)
                    && data.status_code >= 100 && data.status_code <= 599 ? { status_code: data.status_code } : {}),
            },
        };
    }
    catch {
        return null;
    }
}
function safeDatabaseCode(value) {
    if (typeof value !== 'string')
        return 'UNKNOWN';
    return /^(?:[0-9]{2}[A-Z0-9]{3}|PGRST[0-9]{3}|HTTP_[45][0-9]{2}|MATCH_(?:VALIDATION_ERROR|INVALID_ACK)|E(?:CONNRESET|CONNREFUSED|TIMEDOUT|AI_AGAIN|NOTFOUND|PIPE|NETUNREACH|HOSTUNREACH)|UND_ERR_(?:CONNECT_TIMEOUT|HEADERS_TIMEOUT|BODY_TIMEOUT|SOCKET)|UNKNOWN)$/.test(value)
        ? value : 'UNKNOWN';
}
function persistenceDiagnostics(value) {
    const input = fields(value);
    return {
        code: 'MATCH_PERSIST_FAILED',
        errorClass: input.errorClass === 'transient' || input.errorClass === 'permanent'
            ? input.errorClass : 'unknown',
        attempts: typeof input.attempts === 'number' && Number.isInteger(input.attempts)
            && input.attempts >= 1 && input.attempts <= 3 ? input.attempts : 0,
        lastErrorCode: safeDatabaseCode(input.lastErrorCode),
    };
}
function sanitizeEvent(value) {
    try {
        const event = fields(value);
        if (event.type !== undefined && event.type !== 'error')
            return null;
        const exceptions = fields(event.exception).values;
        const persistence = event.message === 'MATCH_PERSIST_FAILED';
        const request = fields(event.request);
        const breadcrumbs = Array.isArray(event.breadcrumbs) ? event.breadcrumbs : [];
        return {
            ...(typeof event.event_id === 'string' && /^[a-f0-9]{32}$/.test(event.event_id)
                ? { event_id: event.event_id } : {}),
            ...(typeof event.timestamp === 'number' && Number.isFinite(event.timestamp)
                ? { timestamp: event.timestamp } : {}),
            level: typeof event.level === 'string' && LEVELS.has(event.level) ? event.level : 'error',
            platform: event.platform === 'node' ? 'node' : 'javascript',
            environment: safeEnvironment(event.environment),
            ...(safeRelease(event.release) ? { release: safeRelease(event.release) } : {}),
            message: persistence ? 'MATCH_PERSIST_FAILED' : 'Application error (details redacted)',
            ...(Array.isArray(exceptions) ? { exception: { values: exceptions.slice(0, 3).map((item) => {
                        const exception = fields(item);
                        const frames = fields(exception.stacktrace).frames;
                        return {
                            type: typeof exception.type === 'string' && ERROR_TYPES.has(exception.type) ? exception.type : 'Error',
                            value: 'Error details redacted',
                            ...(Array.isArray(frames) ? { stacktrace: { frames: frames.slice(-40).map(safeFrame) } } : {}),
                        };
                    }) } } : {}),
            ...(request.url ? { request: {
                    url: sanitizeUrl(request.url),
                    ...(typeof request.method === 'string' && METHODS.has(request.method) ? { method: request.method } : {}),
                } } : {}),
            breadcrumbs: breadcrumbs.slice(-10).map(sanitizeBreadcrumb).filter(Boolean),
            ...(persistence ? { extra: persistenceDiagnostics(event.extra) } : {}),
        };
    }
    catch {
        // Hostile getters and unexpected SDK values must not bypass scrubbing.
        return null;
    }
}
// The SDK can append envelope-level data AFTER beforeSend. Reapply the privacy
// boundary here, and discard all non-error items, including attachments.
function sanitizeEnvelope(value) {
    try {
        if (!Array.isArray(value) || !Array.isArray(value[1]))
            return null;
        const items = [];
        for (const item of value[1]) {
            if (!Array.isArray(item) || fields(item[0]).type !== 'event')
                continue;
            const event = sanitizeEvent(item[1]);
            if (event)
                items.push([{ type: 'event' }, event]);
        }
        if (!items.length)
            return null;
        const eventId = items[0][1].event_id;
        return [typeof eventId === 'string' ? { event_id: eventId } : {}, items];
    }
    catch {
        return null;
    }
}
// Sentry 11 replaced sendDefaultPii with category-specific controls and changed
// their defaults. Explicitly opt out of EVERY collection category.
function privateDataCollection() {
    return {
        userInfo: false,
        cookies: false,
        httpHeaders: false,
        httpBodies: [],
        urlQueryParams: false,
        graphQL: { document: false, variables: false },
        genAI: { inputs: false, outputs: false },
        databaseQueryData: false,
        queues: false,
        stackFrameVariables: false,
        frameContextLines: 0,
    };
}
