import type {Query, URLData} from '@/types';
import {Protocol, TransportType} from '@/types';

const PROTOCOL_PATTERN = /^[a-zA-Z][a-zA-Z\d+\-.]*:\/\//;

const HOST_PATTERN =
    /^(?:\/\/)?(?:localhost|(?:[\w-]+\.)+[\w-]+|\d{1,3}(?:\.\d{1,3}){3})(?::\d+)?(?:\/|$|\?|#)/;

/**
 * Parses a URL-like string into normalized URL data.
 *
 * The function accepts absolute URLs, protocol-relative URLs, host-only URLs,
 * absolute paths and relative paths.
 *
 * Missing parts are intentionally omitted:
 * - protocol is returned only if it was present in the original input
 * - host is returned only if it was present in the original input
 * - port is returned if explicitly present, or inferred from an explicit protocol
 * - query is always returned as an object
 *
 * @example
 * parseUrl('https://example.com/api?a=1#top')
 * // {
 * //   protocol: Protocol.HTTPS,
 * //   host: 'example.com',
 * //   port: 443,
 * //   path: '/api',
 * //   hash: '#top',
 * //   query: { a: '1' }
 * // }
 */
export function parseUrl(url: string): URLData {
    const hasProtocol = PROTOCOL_PATTERN.test(url);
    let hasHost = hasProtocol;

    if (!hasHost) {
        hasHost = HOST_PATTERN.test(url);
    }

    if (!hasHost) {
        url = url.startsWith('/') ? url : `/${url}`;
        url = `${getDefaultHost()}${url}`;
    }

    if (!hasProtocol) {
        url = url.startsWith('//') ? url : `//${url}`;
        url = `${stringifyProtocol(getDefaultProtocol())}${url}`;
    }

    const {protocol, host, pathname, port, hash, searchParams} = new URL(url);
    const parsedProtocol = parseProtocol(protocol);

    const result: URLData = {
        path: pathname ? pathname : '/',
        query: searchToQueryData(searchParams),
    };

    if (hasHost) {
        result.host = host;
    }

    if (hash) {
        result.hash = hash;
    }

    if (hasProtocol) {
        result.protocol = parsedProtocol;
    }

    if (port) {
        result.port = Number(port);
    } else if (hasProtocol && parsedProtocol) {
        result.port = getDefaultPort(parsedProtocol);
    }

    return result;
}

/**
 * Builds a URL instance from normalized URL data.
 *
 * Missing protocol, host, and port values are filled with runtime defaults.
 * Query values can be strings or arrays of strings. Array values are serialized
 * as repeated query parameters.
 *
 * Hash can be passed with or without the leading `#`.
 *
 * @param data - Normalized URL data.
 * @returns URL instance built from the provided data and defaults.
 *
 * @example
 * constructUrl({
 *     protocol: Protocol.HTTPS,
 *     host: 'example.com',
 *     path: '/api',
 *     query: {tag: ['a', 'b']},
 *     hash: 'top',
 * })
 * // URL('https://example.com:443/api?tag=a&tag=b#top')
 */
export function constructUrl({
    query = {},
    path,
    protocol = getDefaultProtocol(),
    host = getDefaultHost(),
    port = getDefaultPort(protocol),
    hash,
}: URLData): URL {
    const base = `${stringifyProtocol(protocol)}//${host}:${port}`;
    const searchParams = Object.entries(query).reduce((res, [key, value]) => {
        if (typeof value === 'string') {
            res.append(key, value);
        } else if (Array.isArray(value)) {
            value.forEach((v) => res.append(key, v));
        }
        return res;
    }, new URLSearchParams());

    let pathUrl = searchParams.size
        ? `${path}?${searchParams.toString()}`
        : path;
    if (hash) {
        pathUrl = `${pathUrl}${hash.startsWith('#') ? hash : `#${hash}`}`;
    }

    return new URL(pathUrl, base);
}

/**
 * Converts a protocol enum value to a URL protocol string.
 *
 * @param protocol - Protocol enum value.
 * @returns URL protocol string with trailing colon, or an empty string when omitted.
 */
export function stringifyProtocol(protocol?: Protocol): string {
    switch (protocol) {
        case Protocol.WS:
            return 'ws:';
        case Protocol.WSS:
            return 'wss:';
        case Protocol.HTTP:
            return 'http:';
        case Protocol.HTTPS:
            return 'https:';
        default:
            return '';
    }
}

/**
 * Parses a URL protocol string into a supported Protocol enum value.
 *
 * @param str - URL protocol string with trailing colon.
 * @returns Matching Protocol enum value, or `undefined` for unsupported protocols.
 */
export function parseProtocol(str?: string): Protocol | undefined {
    switch (str) {
        case 'http:':
            return Protocol.HTTP;
        case 'https:':
            return Protocol.HTTPS;
        case 'ws:':
            return Protocol.WS;
        case 'wss:':
            return Protocol.WSS;
    }
}

/**
 * Converts URLSearchParams into a plain query object.
 *
 * Repeated keys are represented as arrays. Single keys are represented as
 * strings.
 *
 * @param search - URLSearchParams instance.
 * @returns Plain query object.
 */
export function searchToQueryData(search: URLSearchParams): Query {
    const query: Query = {};
    search.forEach((value, key) => {
        const existing = query[key];

        if (existing === undefined) {
            query[key] = value;
            return;
        }

        if (Array.isArray(existing)) {
            existing.push(value);
            return;
        }

        query[key] = [existing, value];
    });

    return query;
}

/**
 * Returns the default protocol for the current runtime or requested transport.
 *
 * When a transport type is provided, HTTP-like protocols are mapped to the
 * corresponding transport protocol:
 * - protected runtime protocols produce `https` for fetch and `wss` for WebSocket
 * - unprotected runtime protocols produce `http` for fetch and `ws` for WebSocket
 *
 * Outside browser-like environments, `http` is used as the base default.
 *
 * @param transport - Optional transport type used to adapt the default protocol.
 * @returns Default protocol.
 */
export function getDefaultProtocol(transport?: TransportType): Protocol {
    const defaultProtocol =
        parseProtocol(globalThis?.location?.protocol) ?? Protocol.HTTP;
    const isProtected = [Protocol.HTTPS, Protocol.WSS].includes(
        defaultProtocol
    );

    switch (transport) {
        case TransportType.WEBSOCKET:
            return isProtected ? Protocol.WSS : Protocol.WS;
        case TransportType.FETCH:
            return isProtected ? Protocol.HTTPS : Protocol.HTTP;
        default:
            return defaultProtocol;
    }
}

/**
 * Returns the host of the current runtime location.
 *
 * Falls back to `localhost` outside browser-like environments.
 *
 * @returns Default host.
 */
export function getDefaultHost(): string {
    return globalThis?.location?.host ?? 'localhost';
}

/**
 * Returns the default port for a supported protocol.
 *
 * @param protocol - Supported protocol.
 * @returns Default port number.
 */
export function getDefaultPort(protocol: Protocol): number {
    switch (protocol) {
        case Protocol.WS:
        case Protocol.HTTP:
            return 80;
        case Protocol.WSS:
        case Protocol.HTTPS:
            return 443;
    }
}
