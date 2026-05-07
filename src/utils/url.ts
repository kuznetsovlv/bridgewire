import {Protocol} from '../types';
import type {Query, URLData} from '../types';

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
 * Converts a protocol enum value to a URL protocol string.
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
 * Parses a URL protocol string into a Protocol enum value.
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
 * Repeated keys are represented as arrays.
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
 * Returns the protocol of the current runtime location, if available.
 */
export function getDefaultProtocol(): Protocol {
    return parseProtocol(globalThis?.location?.protocol) ?? Protocol.HTTP;
}

/**
 * Returns the host of the current runtime location, or localhost outside browser-like environments.
 */
export function getDefaultHost(): string {
    return globalThis?.location?.host ?? 'localhost';
}

/**
 * Returns the default port for a supported protocol.
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
