import {afterEach, describe, expect, it, vi} from 'vitest';

import {
    FetchBridgeWireTransport,
    WebSocketBridgeWireTransport,
} from '@/BridgeWireTransport';
import {
    FetchCache,
    FetchCredentials,
    FetchMode,
    FetchRedirect,
    HTTPMethod,
    PayloadDataType,
    Protocol,
    RequestStatus,
    TransportStatus,
    TransportType,
} from '@/types';

import BridgeWireBuilder from './BridgeWireBuilder';

class MockWebSocket extends EventTarget {
    public static readonly CONNECTING = 0;
    public static readonly OPEN = 1;
    public static readonly CLOSING = 2;
    public static readonly CLOSED = 3;

    public readyState = MockWebSocket.CONNECTING;
    public binaryType: BinaryType = 'blob';

    public send = vi.fn();
    public close = vi.fn(() => {
        this.readyState = MockWebSocket.CLOSED;
    });

    public readonly url: string | URL;
    public readonly protocols?: string | string[];

    public constructor(url: string | URL, protocols?: string | string[]) {
        super();

        this.url = url;
        this.protocols = protocols;

        MockWebSocket.instances.push(this);
    }

    public static instances: MockWebSocket[] = [];

    public static reset(): void {
        MockWebSocket.instances = [];
    }
}

function installMockWebSocket(): void {
    vi.stubGlobal('WebSocket', MockWebSocket);
}

function getLastSocket(): MockWebSocket {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
}

function createJsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'content-type': 'application/json',
        },
    });
}

async function waitForPromises(): Promise<void> {
    for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
    }
}

describe('BridgeWireBuilder', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        MockWebSocket.reset();
    });

    it('returns the same builder instance from fluent methods', () => {
        const builder = new BridgeWireBuilder<unknown, unknown>();

        expect(builder.withTransport(TransportType.FETCH)).toBe(builder);
        expect(builder.withProtocol(Protocol.HTTPS)).toBe(builder);
        expect(builder.withDataType(PayloadDataType.JSON)).toBe(builder);
        expect(builder.withHost('example.com')).toBe(builder);
        expect(builder.withPath('/api')).toBe(builder);
        expect(builder.withPort(443)).toBe(builder);
        expect(builder.withHash('top')).toBe(builder);
        expect(builder.withQuery({page: '1'})).toBe(builder);
        expect(builder.withMethod(HTTPMethod.GET)).toBe(builder);
        expect(builder.withHeaders({accept: 'application/json'})).toBe(builder);
        expect(builder.withHeader('x-test', 'yes')).toBe(builder);
        expect(builder.withTimeout(1000)).toBe(builder);
        expect(builder.withReferrer('about:client')).toBe(builder);
        expect(
            builder.withReferrerPolicy('strict-origin-when-cross-origin')
        ).toBe(builder);
        expect(builder.withMode(FetchMode.CORS)).toBe(builder);
        expect(builder.withCredentials(FetchCredentials.SAME_ORIGIN)).toBe(
            builder
        );
        expect(builder.withCache(FetchCache.NO_CACHE)).toBe(builder);
        expect(builder.withRedirect(FetchRedirect.FOLLOW)).toBe(builder);
        expect(builder.withIntegrity('sha256-test')).toBe(builder);
        expect(builder.withKeepAlive()).toBe(builder);
        expect(builder.withSoap()).toBe(builder);
        expect(builder.withWamp()).toBe(builder);
    });

    it('builds Fetch transport when transport is explicitly set to FETCH', () => {
        const transport = new BridgeWireBuilder<unknown, unknown>()
            .withTransport(TransportType.FETCH)
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api')
            .build();

        expect(transport).toBeInstanceOf(FetchBridgeWireTransport);
        expect(transport.status).toBe(TransportStatus.Connected);
    });

    it('builds Fetch transport when HTTP protocol is configured', () => {
        const transport = new BridgeWireBuilder<unknown, unknown>()
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api')
            .build();

        expect(transport).toBeInstanceOf(FetchBridgeWireTransport);
    });

    it('builds WebSocket transport when transport is explicitly set to WEBSOCKET', () => {
        installMockWebSocket();

        const transport = new BridgeWireBuilder<string, string>()
            .withTransport(TransportType.WEBSOCKET)
            .withProtocol(Protocol.WSS)
            .withHost('example.com')
            .withPath('/socket')
            .build();

        expect(transport).toBeInstanceOf(WebSocketBridgeWireTransport);
        expect(transport.status).toBe(TransportStatus.Connecting);
        expect(getLastSocket().url.toString()).toBe('wss://example.com/socket');
    });

    it('builds WebSocket transport when WS protocol is configured', () => {
        installMockWebSocket();

        const transport = new BridgeWireBuilder<string, string>()
            .withProtocol(Protocol.WSS)
            .withHost('example.com')
            .withPath('/socket')
            .build();

        expect(transport).toBeInstanceOf(WebSocketBridgeWireTransport);
        expect(getLastSocket().url.toString()).toBe('wss://example.com/socket');
    });

    it('applies parsed URL parts to Fetch transport', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new BridgeWireBuilder<
            Record<string, string>,
            unknown
        >()
            .withUrl('https://example.com/api/users?existing=yes#top')
            .withMethod(HTTPMethod.GET)
            .build();

        transport.send({page: '1'});

        const [url, init] = fetchMock.mock.calls[0];

        expect((url as URL).toString()).toBe(
            'https://example.com/api/users?existing=yes&page=1#top'
        );
        expect(init?.method).toBe(HTTPMethod.GET);
    });

    it('passes Fetch options to created Fetch transport', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const headers = {
            accept: 'application/json',
        };

        const transport = new BridgeWireBuilder<{name: string}, unknown>()
            .withTransport(TransportType.FETCH)
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api/users')
            .withMethod(HTTPMethod.POST)
            .withHeaders(headers)
            .withReferrer('about:client')
            .withReferrerPolicy('strict-origin-when-cross-origin')
            .withMode(FetchMode.CORS)
            .withCredentials(FetchCredentials.SAME_ORIGIN)
            .withCache(FetchCache.NO_CACHE)
            .withRedirect(FetchRedirect.FOLLOW)
            .withIntegrity('sha256-test')
            .withKeepAlive()
            .build();

        transport.send({name: 'Leonid'});

        const [, init] = fetchMock.mock.calls[0];

        expect(init).toEqual(
            expect.objectContaining({
                method: HTTPMethod.POST,
                headers,
                referrer: 'about:client',
                referrerPolicy: 'strict-origin-when-cross-origin',
                mode: FetchMode.CORS,
                credentials: FetchCredentials.SAME_ORIGIN,
                cache: FetchCache.NO_CACHE,
                redirect: FetchRedirect.FOLLOW,
                integrity: 'sha256-test',
                keepalive: true,
            })
        );
    });

    it('passes data type to Fetch transport parser configuration', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const transport = new BridgeWireBuilder<undefined, {ok: boolean}>()
            .withTransport(TransportType.FETCH)
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api')
            .withDataType(PayloadDataType.JSON)
            .build();

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toEqual({ok: true});
    });

    it('normalizes non-positive timeout to Infinity during build', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const transport = new BridgeWireBuilder<undefined, unknown>()
            .withTransport(TransportType.FETCH)
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api')
            .withTimeout(0)
            .build();

        const request = transport.send(undefined);

        vi.advanceTimersByTime(60_000);

        expect(request?.status).toBe(RequestStatus.Pending);
    });

    it('applies positive timeout during build', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const transport = new BridgeWireBuilder<undefined, unknown>()
            .withTransport(TransportType.FETCH)
            .withProtocol(Protocol.HTTPS)
            .withHost('example.com')
            .withPath('/api')
            .withTimeout(1000)
            .build();

        const request = transport.send(undefined);

        vi.advanceTimersByTime(1000);

        expect(request?.status).toBe(RequestStatus.TimedOut);
    });

    it('passes WebSocket subprotocol flags to WebSocket transport', () => {
        installMockWebSocket();

        new BridgeWireBuilder<string, string>()
            .withTransport(TransportType.WEBSOCKET)
            .withProtocol(Protocol.WSS)
            .withHost('example.com')
            .withPath('/socket')
            .withSoap()
            .withWamp()
            .build();

        expect(getLastSocket().protocols).toEqual(['soap', 'wamp']);
    });

    it('passes WebSocket ARRAY_BUFFER data type to WebSocket transport', () => {
        installMockWebSocket();

        new BridgeWireBuilder<string, ArrayBuffer>()
            .withTransport(TransportType.WEBSOCKET)
            .withProtocol(Protocol.WSS)
            .withHost('example.com')
            .withPath('/socket')
            .withDataType(PayloadDataType.ARRAY_BUFFER)
            .build();

        expect(getLastSocket().binaryType).toBe('arraybuffer');
    });

    it('throws when selected transport is incompatible with protocol', () => {
        expect(() => {
            new BridgeWireBuilder<unknown, unknown>()
                .withTransport(TransportType.FETCH)
                .withProtocol(Protocol.WSS);
        }).toThrow(
            'Incompatible combination of transport "fetch" and protocol "wss".'
        );
    });

    it('throws when selected data type is incompatible with transport', () => {
        expect(() => {
            new BridgeWireBuilder<unknown, unknown>()
                .withTransport(TransportType.WEBSOCKET)
                .withDataType(PayloadDataType.FORM_DATA);
        }).toThrow(
            'Incompatible combination of transport "websocket" and data type "FormData".'
        );
    });

    it('throws when selected data type is incompatible with protocol', () => {
        expect(() => {
            new BridgeWireBuilder<unknown, unknown>()
                .withProtocol(Protocol.WSS)
                .withDataType(PayloadDataType.FORM_DATA);
        }).toThrow(
            'Incompatible combination of protocol "wss" and data type "FormData".'
        );
    });
});
