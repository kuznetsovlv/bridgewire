import {describe, expect, it} from 'vitest';

import {PayloadDataType, Protocol, TransportType} from '@/types';

import {
    protocolAndDataTypeAssert,
    transportAndDataTypeAssert,
    transportAndProtocolAssert,
} from './compatibilityAsserts';

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

    describe('transportAndDataTypeAssert', () => {
        it('allows missing transport and data type', () => {
            expect(() => transportAndDataTypeAssert()).not.toThrow();
        });

        it('allows missing transport', () => {
            expect(() =>
                transportAndDataTypeAssert(undefined, PayloadDataType.FORM_DATA)
            ).not.toThrow();
        });

        it('allows missing data type', () => {
            expect(() =>
                transportAndDataTypeAssert(TransportType.FETCH)
            ).not.toThrow();

            expect(() =>
                transportAndDataTypeAssert(TransportType.WEBSOCKET)
            ).not.toThrow();
        });

        it('allows fetch transport with all payload data types', () => {
            Object.values(PayloadDataType).forEach((dataType) => {
                expect(() =>
                    transportAndDataTypeAssert(TransportType.FETCH, dataType)
                ).not.toThrow();
            });
        });

        it('allows websocket transport with compatible payload data types', () => {
            expect(() =>
                transportAndDataTypeAssert(
                    TransportType.WEBSOCKET,
                    PayloadDataType.TEXT
                )
            ).not.toThrow();

            expect(() =>
                transportAndDataTypeAssert(
                    TransportType.WEBSOCKET,
                    PayloadDataType.JSON
                )
            ).not.toThrow();

            expect(() =>
                transportAndDataTypeAssert(
                    TransportType.WEBSOCKET,
                    PayloadDataType.BLOB
                )
            ).not.toThrow();

            expect(() =>
                transportAndDataTypeAssert(
                    TransportType.WEBSOCKET,
                    PayloadDataType.ARRAY_BUFFER
                )
            ).not.toThrow();
        });

        it('throws for websocket transport with FormData payload data type', () => {
            expect(() =>
                transportAndDataTypeAssert(
                    TransportType.WEBSOCKET,
                    PayloadDataType.FORM_DATA
                )
            ).toThrow(
                'Incompatible combination of transport "websocket" and data type "FormData".'
            );
        });
    });

    describe('protocolAndDataTypeAssert', () => {
        it('allows missing protocol and data type', () => {
            expect(() => protocolAndDataTypeAssert()).not.toThrow();
        });

        it('allows missing protocol', () => {
            expect(() =>
                protocolAndDataTypeAssert(undefined, PayloadDataType.FORM_DATA)
            ).not.toThrow();
        });

        it('allows missing data type', () => {
            expect(() =>
                protocolAndDataTypeAssert(Protocol.HTTP)
            ).not.toThrow();
            expect(() =>
                protocolAndDataTypeAssert(Protocol.HTTPS)
            ).not.toThrow();
            expect(() => protocolAndDataTypeAssert(Protocol.WS)).not.toThrow();
            expect(() => protocolAndDataTypeAssert(Protocol.WSS)).not.toThrow();
        });

        it('allows HTTP protocols with all payload data types', () => {
            Object.values(PayloadDataType).forEach((dataType) => {
                expect(() =>
                    protocolAndDataTypeAssert(Protocol.HTTP, dataType)
                ).not.toThrow();

                expect(() =>
                    protocolAndDataTypeAssert(Protocol.HTTPS, dataType)
                ).not.toThrow();
            });
        });

        it('allows WebSocket protocols with compatible payload data types', () => {
            const compatibleDataTypes = [
                PayloadDataType.TEXT,
                PayloadDataType.JSON,
                PayloadDataType.BLOB,
                PayloadDataType.ARRAY_BUFFER,
            ];

            compatibleDataTypes.forEach((dataType) => {
                expect(() =>
                    protocolAndDataTypeAssert(Protocol.WS, dataType)
                ).not.toThrow();

                expect(() =>
                    protocolAndDataTypeAssert(Protocol.WSS, dataType)
                ).not.toThrow();
            });
        });

        it('throws for WebSocket protocols with FormData payload data type', () => {
            expect(() =>
                protocolAndDataTypeAssert(
                    Protocol.WS,
                    PayloadDataType.FORM_DATA
                )
            ).toThrow(
                'Incompatible combination of protocol "ws" and data type "FormData".'
            );

            expect(() =>
                protocolAndDataTypeAssert(
                    Protocol.WSS,
                    PayloadDataType.FORM_DATA
                )
            ).toThrow(
                'Incompatible combination of protocol "wss" and data type "FormData".'
            );
        });
    });
});
