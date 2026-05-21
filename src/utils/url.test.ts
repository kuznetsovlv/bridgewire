import {afterEach, describe, expect, it, vi} from 'vitest';
import {Protocol, TransportType} from '@/types';
import {
    constructUrl,
    getDefaultHost,
    getDefaultPort,
    getDefaultProtocol,
    parseProtocol,
    parseUrl,
    searchToQueryData,
    stringifyProtocol,
} from './url';

describe('url utils', () => {
    afterEach(() => {
        vi.unstubAllGlobals();
    });

    describe('parseUrl', () => {
        it('parses full https URL', () => {
            expect(
                parseUrl('https://example.com/api/users?page=1#top')
            ).toEqual({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                port: 443,
                path: '/api/users',
                hash: '#top',
                query: {
                    page: '1',
                },
            });
        });

        it('parses explicit port', () => {
            expect(parseUrl('http://example.com:3000/api')).toEqual({
                protocol: Protocol.HTTP,
                host: 'example.com:3000',
                port: 3000,
                path: '/api',
                query: {},
            });
        });

        it('parses host without protocol', () => {
            expect(parseUrl('example.com/api?a=1')).toEqual({
                host: 'example.com',
                path: '/api',
                query: {
                    a: '1',
                },
            });
        });

        it('parses absolute path without host and protocol', () => {
            expect(parseUrl('/api/users?a=1')).toEqual({
                path: '/api/users',
                query: {
                    a: '1',
                },
            });
        });

        it('parses relative path', () => {
            expect(parseUrl('api/users')).toEqual({
                path: '/api/users',
                query: {},
            });
        });

        it('parses repeated query params as array', () => {
            expect(parseUrl('/api?tag=a&tag=b')).toEqual({
                path: '/api',
                query: {
                    tag: ['a', 'b'],
                },
            });
        });

        it('adds default port for explicit http protocol', () => {
            expect(parseUrl('http://example.com/api')).toEqual({
                protocol: Protocol.HTTP,
                host: 'example.com',
                port: 80,
                path: '/api',
                query: {},
            });
        });

        it('adds default port for explicit https protocol', () => {
            expect(parseUrl('https://example.com/api')).toEqual({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                port: 443,
                path: '/api',
                query: {},
            });
        });

        it('adds default port for explicit ws protocol', () => {
            expect(parseUrl('ws://example.com/socket')).toEqual({
                protocol: Protocol.WS,
                host: 'example.com',
                port: 80,
                path: '/socket',
                query: {},
            });
        });

        it('adds default port for explicit wss protocol', () => {
            expect(parseUrl('wss://example.com/socket')).toEqual({
                protocol: Protocol.WSS,
                host: 'example.com',
                port: 443,
                path: '/socket',
                query: {},
            });
        });

        it('parses localhost without protocol', () => {
            expect(parseUrl('localhost:3000/api/users?a=1')).toEqual({
                host: 'localhost:3000',
                path: '/api/users',
                port: 3000,
                query: {
                    a: '1',
                },
            });
        });

        it('parses protocol-relative localhost', () => {
            expect(parseUrl('//localhost:3000/api/users')).toEqual({
                host: 'localhost:3000',
                path: '/api/users',
                port: 3000,
                query: {},
            });
        });

        it('parses localhost with explicit protocol and port', () => {
            expect(parseUrl('http://localhost:3000/api/users')).toEqual({
                protocol: Protocol.HTTP,
                host: 'localhost:3000',
                port: 3000,
                path: '/api/users',
                query: {},
            });
        });

        it('parses hash without query', () => {
            expect(parseUrl('/api/users#section')).toEqual({
                path: '/api/users',
                hash: '#section',
                query: {},
            });
        });

        it('parses root URL with explicit host', () => {
            expect(parseUrl('https://example.com')).toEqual({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                port: 443,
                path: '/',
                query: {},
            });
        });
    });

    describe('constructUrl', () => {
        it('constructs URL with explicit protocol, host, port and path', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                port: 8443,
                path: '/api/users',
                query: {},
            });

            expect(url.toString()).toBe('https://example.com:8443/api/users');
        });

        it('constructs URL with default port for protocol', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                path: '/api/users',
                query: {},
            });

            expect(url.toString()).toBe('https://example.com/api/users');
        });

        it('constructs URL with string query params', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                path: '/api',
                query: {
                    page: '1',
                    search: 'hello world',
                },
            });

            expect(url.toString()).toBe(
                'https://example.com/api?page=1&search=hello+world'
            );
        });

        it('constructs URL with repeated query params from arrays', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                path: '/api',
                query: {
                    tag: ['a', 'b'],
                },
            });

            expect(url.toString()).toBe('https://example.com/api?tag=a&tag=b');
        });

        it('constructs URL with hash without leading hash symbol', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                path: '/api',
                hash: 'top',
                query: {},
            });

            expect(url.toString()).toBe('https://example.com/api#top');
        });

        it('constructs URL with hash with leading hash symbol', () => {
            const url = constructUrl({
                protocol: Protocol.HTTPS,
                host: 'example.com',
                path: '/api',
                hash: '#top',
                query: {},
            });

            expect(url.toString()).toBe('https://example.com/api#top');
        });

        it('constructs URL with default protocol and host', () => {
            const url = constructUrl({
                path: '/api',
                query: {},
            });

            expect(url.toString()).toBe('http://localhost/api');
        });
    });

    describe('stringifyProtocol', () => {
        it('stringifies supported protocols', () => {
            expect(stringifyProtocol(Protocol.HTTP)).toBe('http:');
            expect(stringifyProtocol(Protocol.HTTPS)).toBe('https:');
            expect(stringifyProtocol(Protocol.WS)).toBe('ws:');
            expect(stringifyProtocol(Protocol.WSS)).toBe('wss:');
        });

        it('returns empty string for undefined protocol', () => {
            expect(stringifyProtocol()).toBe('');
        });
    });

    describe('parseProtocol', () => {
        it('parses supported protocols', () => {
            expect(parseProtocol('http:')).toBe(Protocol.HTTP);
            expect(parseProtocol('https:')).toBe(Protocol.HTTPS);
            expect(parseProtocol('ws:')).toBe(Protocol.WS);
            expect(parseProtocol('wss:')).toBe(Protocol.WSS);
        });

        it('returns undefined for unsupported protocol', () => {
            expect(parseProtocol('ftp:')).toBeUndefined();
        });

        it('returns undefined for missing protocol', () => {
            expect(parseProtocol()).toBeUndefined();
        });
    });

    describe('searchToQueryData', () => {
        it('converts search params to query object', () => {
            expect(searchToQueryData(new URLSearchParams('a=1&b=2'))).toEqual({
                a: '1',
                b: '2',
            });
        });

        it('stores repeated params as array', () => {
            expect(
                searchToQueryData(new URLSearchParams('tag=a&tag=b'))
            ).toEqual({
                tag: ['a', 'b'],
            });
        });

        it('stores later repeated params in the same array', () => {
            expect(
                searchToQueryData(new URLSearchParams('tag=a&tag=b&tag=c'))
            ).toEqual({
                tag: ['a', 'b', 'c'],
            });
        });

        it('returns empty object for empty search params', () => {
            expect(searchToQueryData(new URLSearchParams())).toEqual({});
        });
    });

    describe('getDefaultProtocol', () => {
        it('returns HTTP outside browser-like environments by default', () => {
            expect(getDefaultProtocol()).toBe(Protocol.HTTP);
        });

        it('returns HTTP for fetch outside browser-like environments', () => {
            expect(getDefaultProtocol(TransportType.FETCH)).toBe(Protocol.HTTP);
        });

        it('returns WS for websocket outside browser-like environments', () => {
            expect(getDefaultProtocol(TransportType.WEBSOCKET)).toBe(
                Protocol.WS
            );
        });

        it('returns HTTPS for fetch when runtime protocol is HTTPS', () => {
            vi.stubGlobal('location', {
                protocol: 'https:',
                host: 'example.com',
            });

            expect(getDefaultProtocol(TransportType.FETCH)).toBe(
                Protocol.HTTPS
            );
        });

        it('returns WSS for websocket when runtime protocol is HTTPS', () => {
            vi.stubGlobal('location', {
                protocol: 'https:',
                host: 'example.com',
            });

            expect(getDefaultProtocol(TransportType.WEBSOCKET)).toBe(
                Protocol.WSS
            );
        });

        it('returns HTTP for fetch when runtime protocol is HTTP', () => {
            vi.stubGlobal('location', {
                protocol: 'http:',
                host: 'example.com',
            });

            expect(getDefaultProtocol(TransportType.FETCH)).toBe(Protocol.HTTP);
        });

        it('returns WS for websocket when runtime protocol is HTTP', () => {
            vi.stubGlobal('location', {
                protocol: 'http:',
                host: 'example.com',
            });

            expect(getDefaultProtocol(TransportType.WEBSOCKET)).toBe(
                Protocol.WS
            );
        });

        it('returns runtime protocol when transport is omitted', () => {
            vi.stubGlobal('location', {
                protocol: 'https:',
                host: 'example.com',
            });

            expect(getDefaultProtocol()).toBe(Protocol.HTTPS);
        });

        it('falls back to HTTP for unsupported runtime protocol', () => {
            vi.stubGlobal('location', {
                protocol: 'ftp:',
                host: 'example.com',
            });

            expect(getDefaultProtocol()).toBe(Protocol.HTTP);
        });
    });

    describe('getDefaultHost', () => {
        it('returns localhost outside browser-like environments by default', () => {
            expect(getDefaultHost()).toBe('localhost');
        });

        it('returns runtime location host when available', () => {
            vi.stubGlobal('location', {
                protocol: 'https:',
                host: 'example.com:3000',
            });

            expect(getDefaultHost()).toBe('example.com:3000');
        });
    });

    describe('getDefaultPort', () => {
        it('returns default ports', () => {
            expect(getDefaultPort(Protocol.HTTP)).toBe(80);
            expect(getDefaultPort(Protocol.WS)).toBe(80);
            expect(getDefaultPort(Protocol.HTTPS)).toBe(443);
            expect(getDefaultPort(Protocol.WSS)).toBe(443);
        });
    });
});
