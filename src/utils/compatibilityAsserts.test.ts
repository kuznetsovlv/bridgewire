import {describe, expect, it} from 'vitest';
import {Protocol, TransportType} from '@/types';
import {transportAndProtocolAssert} from './compatibilityAsserts';

describe('compatibility asserts', () => {
    describe('transportAndProtocolAssert', () => {
        it('allows missing transport and protocol', () => {
            expect(() => transportAndProtocolAssert()).not.toThrow();
        });

        it('allows missing transport', () => {
            expect(() =>
                transportAndProtocolAssert(undefined, Protocol.HTTP)
            ).not.toThrow();

            expect(() =>
                transportAndProtocolAssert(undefined, Protocol.WS)
            ).not.toThrow();
        });

        it('allows missing protocol', () => {
            expect(() =>
                transportAndProtocolAssert(TransportType.FETCH)
            ).not.toThrow();

            expect(() =>
                transportAndProtocolAssert(TransportType.WEBSOCKET)
            ).not.toThrow();
        });

        it('allows fetch transport with HTTP protocols', () => {
            expect(() =>
                transportAndProtocolAssert(TransportType.FETCH, Protocol.HTTP)
            ).not.toThrow();

            expect(() =>
                transportAndProtocolAssert(TransportType.FETCH, Protocol.HTTPS)
            ).not.toThrow();
        });

        it('allows websocket transport with WebSocket protocols', () => {
            expect(() =>
                transportAndProtocolAssert(TransportType.WEBSOCKET, Protocol.WS)
            ).not.toThrow();

            expect(() =>
                transportAndProtocolAssert(
                    TransportType.WEBSOCKET,
                    Protocol.WSS
                )
            ).not.toThrow();
        });

        it('throws for fetch transport with WebSocket protocols', () => {
            expect(() =>
                transportAndProtocolAssert(TransportType.FETCH, Protocol.WS)
            ).toThrow(
                'Incompatible combination of transport "fetch" and protocol "ws".'
            );

            expect(() =>
                transportAndProtocolAssert(TransportType.FETCH, Protocol.WSS)
            ).toThrow(
                'Incompatible combination of transport "fetch" and protocol "wss".'
            );
        });

        it('throws for websocket transport with HTTP protocols', () => {
            expect(() =>
                transportAndProtocolAssert(
                    TransportType.WEBSOCKET,
                    Protocol.HTTP
                )
            ).toThrow(
                'Incompatible combination of transport "websocket" and protocol "http".'
            );

            expect(() =>
                transportAndProtocolAssert(
                    TransportType.WEBSOCKET,
                    Protocol.HTTPS
                )
            ).toThrow(
                'Incompatible combination of transport "websocket" and protocol "https".'
            );
        });
    });
});
