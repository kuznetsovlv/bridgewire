import {describe, expect, it} from 'vitest';
import {Protocol} from '@/types';
import {
    getDefaultHost,
    getDefaultPort,
    getDefaultProtocol,
    parseProtocol,
    parseUrl,
    searchToQueryData,
    stringifyProtocol,
} from './url';

describe('url utils', () => {
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
                hash: undefined,
                query: {},
            });
        });

        it('parses host without protocol', () => {
            expect(parseUrl('example.com/api?a=1')).toEqual({
                host: 'example.com',
                path: '/api',
                hash: undefined,
                query: {
                    a: '1',
                },
            });
        });

        it('parses absolute path without host and protocol', () => {
            expect(parseUrl('/api/users?a=1')).toEqual({
                path: '/api/users',
                hash: undefined,
                query: {
                    a: '1',
                },
            });
        });

        it('parses relative path', () => {
            expect(parseUrl('api/users')).toEqual({
                path: '/api/users',
                hash: undefined,
                query: {},
            });
        });

        it('parses repeated query params as array', () => {
            expect(parseUrl('/api?tag=a&tag=b')).toEqual({
                path: '/api',
                hash: undefined,
                query: {
                    tag: ['a', 'b'],
                },
            });
        });

        it('adds default port for explicit ws protocol', () => {
            expect(parseUrl('ws://example.com/socket')).toEqual({
                protocol: Protocol.WS,
                host: 'example.com',
                port: 80,
                path: '/socket',
                hash: undefined,
                query: {},
            });
        });

        it('adds default port for explicit wss protocol', () => {
            expect(parseUrl('wss://example.com/socket')).toEqual({
                protocol: Protocol.WSS,
                host: 'example.com',
                port: 443,
                path: '/socket',
                hash: undefined,
                query: {},
            });
        });

        it('parses localhost without protocol', () => {
            expect(parseUrl('localhost:3000/api/users?a=1')).toEqual({
                host: 'localhost:3000',
                path: '/api/users',
                port: 3000,
                hash: undefined,
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
                hash: undefined,
                query: {},
            });
        });

        it('parses localhost with explicit protocol and port', () => {
            expect(parseUrl('http://localhost:3000/api/users')).toEqual({
                protocol: Protocol.HTTP,
                host: 'localhost:3000',
                port: 3000,
                path: '/api/users',
                hash: undefined,
                query: {},
            });
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
    });

    describe('getDefaultProtocol', () => {
        it('returns HTTP outside browser-like environments by default', () => {
            expect(getDefaultProtocol()).toBe(Protocol.HTTP);
        });
    });

    describe('getDefaultHost', () => {
        it('returns localhost outside browser-like environments by default', () => {
            expect(getDefaultHost()).toBe('localhost');
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
