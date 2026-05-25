import {afterEach, describe, expect, it, vi} from 'vitest';

import {
    PayloadDataType,
    Protocol,
    RequestStatus,
    TransportStatus,
} from '@/types';

import WebSocketBridgeWireTransport from './WebSocketBridgeWireTransport';

const urlData = {
    protocol: Protocol.WSS,
    host: 'example.com',
    port: 443,
    path: '/socket',
    query: {},
};

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

    public dispatchOpen(): void {
        this.readyState = MockWebSocket.OPEN;
        this.dispatchEvent(new Event('open'));
    }

    public dispatchMessage(data: unknown): void {
        const event = new Event('message') as MessageEvent;

        Object.defineProperty(event, 'data', {
            value: data,
        });

        this.dispatchEvent(event);
    }

    public dispatchError(): void {
        this.dispatchEvent(new Event('error'));
    }

    public dispatchClose({
        wasClean = true,
        code = 1000,
        reason = '',
    }: {
        wasClean?: boolean;
        code?: number;
        reason?: string;
    } = {}): void {
        this.readyState = MockWebSocket.CLOSED;

        const event = new Event('close') as CloseEvent;

        Object.defineProperties(event, {
            wasClean: {
                value: wasClean,
            },
            code: {
                value: code,
            },
            reason: {
                value: reason,
            },
        });

        this.dispatchEvent(event);
    }

    public static instances: MockWebSocket[] = [];

    public static reset(): void {
        MockWebSocket.instances = [];
    }
}

const installMockWebSocket = (): void => {
    vi.stubGlobal('WebSocket', MockWebSocket);
};

const getLastSocket = (): MockWebSocket => {
    return MockWebSocket.instances[MockWebSocket.instances.length - 1];
};

describe('WebSocketBridgeWireTransport', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.unstubAllGlobals();
        vi.restoreAllMocks();
        MockWebSocket.reset();
    });

    it('creates socket immediately and starts with Connecting status', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const socket = getLastSocket();

        expect(transport.status).toBe(TransportStatus.Connecting);
        expect(socket.url.toString()).toBe('wss://example.com/socket');
        expect(socket.protocols).toEqual([]);
    });

    it('requests configured websocket subprotocols', () => {
        installMockWebSocket();

        new WebSocketBridgeWireTransport<string, string>({
            urlData,
            soap: true,
            wamp: true,
        });

        const socket = getLastSocket();

        expect(socket.protocols).toEqual(['soap', 'wamp']);
    });

    it('sets arraybuffer binary type for ARRAY_BUFFER data type', () => {
        installMockWebSocket();

        new WebSocketBridgeWireTransport<string, ArrayBuffer>({
            urlData,
            dataType: PayloadDataType.ARRAY_BUFFER,
        });

        expect(getLastSocket().binaryType).toBe('arraybuffer');
    });

    it('sets blob binary type by default', () => {
        installMockWebSocket();

        new WebSocketBridgeWireTransport<string, Blob>({
            urlData,
        });

        expect(getLastSocket().binaryType).toBe('blob');
    });

    it('marks transport as Connected when socket opens', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        getLastSocket().dispatchOpen();

        expect(transport.status).toBe(TransportStatus.Connected);
    });

    it('marks transport as Disconnected when socket closes without transport error', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        getLastSocket().dispatchClose();

        expect(transport.status).toBe(TransportStatus.Disconnected);
    });

    it('emits transport error when connection times out', () => {
        vi.useFakeTimers();
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
            timeout: 1000,
        });

        const onError = vi.fn();

        transport.onError(onError);

        vi.advanceTimersByTime(1000);

        const socket = getLastSocket();

        expect(socket.close).toHaveBeenCalledOnce();
        expect(transport.status).toBe(TransportStatus.Error);
        expect(onError).toHaveBeenCalledOnce();
        expect(onError).toHaveBeenCalledWith(
            new Error('WebSocket connection timed out after 1000 ms')
        );
    });

    it('uses per-send timeout when recreating socket', () => {
        vi.useFakeTimers();
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
            timeout: 1000,
        });

        const firstSocket = getLastSocket();

        firstSocket.dispatchClose();

        const onError = vi.fn();

        transport.onError(onError);
        transport.send('hello', {
            timeout: 2000,
        });

        vi.advanceTimersByTime(1000);

        expect(onError).not.toHaveBeenCalled();

        vi.advanceTimersByTime(1000);

        expect(onError).toHaveBeenCalledWith(
            new Error('WebSocket connection timed out after 2000 ms')
        );
    });

    it('clears connection timeout when socket opens', () => {
        vi.useFakeTimers();
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
            timeout: 1000,
        });

        const onError = vi.fn();

        transport.onError(onError);

        getLastSocket().dispatchOpen();

        vi.advanceTimersByTime(1000);

        expect(transport.status).toBe(TransportStatus.Connected);
        expect(onError).not.toHaveBeenCalled();
    });

    it('sends string data through current socket', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const request = transport.send('hello');
        const socket = getLastSocket();

        expect(request).not.toBeNull();
        expect(socket.send).toHaveBeenCalledOnce();
        expect(socket.send).toHaveBeenCalledWith('hello');
    });

    it('serializes object data to JSON before sending', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<
            {message: string},
            string
        >({
            urlData,
        });

        transport.send({message: 'hello'});

        expect(getLastSocket().send).toHaveBeenCalledWith(
            JSON.stringify({message: 'hello'})
        );
    });

    it('passes Blob data through before sending', () => {
        installMockWebSocket();

        const blob = new Blob(['hello']);
        const transport = new WebSocketBridgeWireTransport<Blob, Blob>({
            urlData,
        });

        transport.send(blob);

        expect(getLastSocket().send).toHaveBeenCalledWith(blob);
    });

    it('passes ArrayBuffer data through before sending', () => {
        installMockWebSocket();

        const buffer = new ArrayBuffer(3);
        const transport = new WebSocketBridgeWireTransport<
            ArrayBuffer,
            ArrayBuffer
        >({
            urlData,
        });

        transport.send(buffer);

        expect(getLastSocket().send).toHaveBeenCalledWith(buffer);
    });

    it('passes ArrayBufferView data through before sending', () => {
        installMockWebSocket();

        const data = new Uint8Array([1, 2, 3]);
        const transport = new WebSocketBridgeWireTransport<
            Uint8Array,
            ArrayBuffer
        >({
            urlData,
        });

        transport.send(data);

        expect(getLastSocket().send).toHaveBeenCalledWith(data);
    });

    it('sends empty string for null data', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<null, string>({
            urlData,
        });

        transport.send(null);

        expect(getLastSocket().send).toHaveBeenCalledWith('');
    });

    it('returns the same active request while request is pending', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const firstRequest = transport.send('first');
        const secondRequest = transport.send('second');

        expect(firstRequest).toBe(secondRequest);
        expect(MockWebSocket.instances).toHaveLength(1);
    });

    it('creates a new socket and request after previous request is completed', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const firstSocket = getLastSocket();
        const firstRequest = transport.send('first');

        firstSocket.dispatchClose({
            wasClean: true,
            code: 1000,
        });

        expect(firstRequest?.status).toBe(RequestStatus.Completed);

        const secondRequest = transport.send('second');
        const secondSocket = getLastSocket();

        expect(secondRequest).not.toBe(firstRequest);
        expect(secondSocket).not.toBe(firstSocket);
        expect(MockWebSocket.instances).toHaveLength(2);
        expect(secondSocket.send).toHaveBeenCalledWith('second');
    });

    it('parses JSON messages when data type is JSON', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<
            string,
            {ok: boolean}
        >({
            urlData,
            dataType: PayloadDataType.JSON,
        });

        const onMessage = vi.fn();

        transport.onMessage(onMessage);

        const request = transport.send('hello');

        getLastSocket().dispatchMessage('{"ok":true}');

        expect(request?.data).toEqual({ok: true});
        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith(request?.id, {ok: true});
    });

    it('passes non-JSON messages through by default', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const onMessage = vi.fn();

        transport.onMessage(onMessage);

        const request = transport.send('hello');

        getLastSocket().dispatchMessage('server-message');

        expect(request?.data).toBe('server-message');
        expect(onMessage).toHaveBeenCalledWith(request?.id, 'server-message');
    });

    it('forwards parser errors as request and transport errors', () => {
        installMockWebSocket();

        const transport = new WebSocketBridgeWireTransport<
            string,
            {ok: boolean}
        >({
            urlData,
            dataType: PayloadDataType.JSON,
        });

        const onRequestError = vi.fn();
        const onTransportError = vi.fn();

        transport.onRequestError(onRequestError);
        transport.onError(onTransportError);

        const request = transport.send('hello');

        getLastSocket().dispatchMessage('bad-json');

        expect(request?.status).toBe(RequestStatus.Pending);
        expect(onRequestError).toHaveBeenCalledOnce();
        expect(onRequestError.mock.calls[0][0]).toBe(request?.id);
        expect(onTransportError).toHaveBeenCalledOnce();
    });

    it('returns null when request cannot be created for closed socket', () => {
        installMockWebSocket();

        class ClosedMockWebSocket extends MockWebSocket {
            public constructor(
                url: string | URL,
                protocols?: string | string[]
            ) {
                super(url, protocols);
                this.readyState = MockWebSocket.CLOSED;
            }
        }

        vi.stubGlobal('WebSocket', ClosedMockWebSocket);

        const transport = new WebSocketBridgeWireTransport<string, string>({
            urlData,
        });

        const onError = vi.fn();

        transport.onError(onError);

        const request = transport.send('hello');

        expect(request).toBeNull();
        expect(onError).toHaveBeenCalled();
    });
});
