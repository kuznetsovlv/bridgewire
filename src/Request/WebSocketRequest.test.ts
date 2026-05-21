import {describe, expect, it, vi} from 'vitest';
import WebSocketRequest from './WebSocketRequest';
import {CloseSocketCode, RequestStatus} from '@/types';

class MockWebSocket extends EventTarget {
    public readyState: number;

    public close = vi.fn((code?: number, reason?: string) => {
        this.readyState = WebSocket.CLOSING;

        this.dispatchClose({
            wasClean: true,
            code,
            reason,
        });

        this.readyState = WebSocket.CLOSED;
    });

    public constructor(readyState: number = WebSocket.OPEN) {
        super();

        this.readyState = readyState;
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
        code = CloseSocketCode.NORMAL,
        reason = '',
    }: {
        wasClean?: boolean;
        code?: number;
        reason?: string;
    } = {}): void {
        this.readyState = WebSocket.CLOSED;

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
}

function createSocket(readyState: number = WebSocket.OPEN): WebSocket {
    return new MockWebSocket(readyState) as unknown as WebSocket;
}

describe('WebSocketRequest', () => {
    it('uses Pending status for connecting socket', () => {
        const socket = createSocket(WebSocket.CONNECTING);

        const request = new WebSocketRequest<string>('request-1', {socket});

        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('uses Pending status for open socket', () => {
        const socket = createSocket(WebSocket.OPEN);

        const request = new WebSocketRequest<string>('request-1', {socket});

        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('uses Pending status for closing socket', () => {
        const socket = createSocket(WebSocket.CLOSING);

        const request = new WebSocketRequest<string>('request-1', {socket});

        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('uses Failed status for closed socket', () => {
        const socket = createSocket(WebSocket.CLOSED);

        const request = new WebSocketRequest<string>('request-1', {socket});

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
    });

    it('emits message data with default parser', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onMessage = vi.fn();

        request.onMessage(onMessage);

        (socket as unknown as MockWebSocket).dispatchMessage('message-data');

        expect(request.data).toBe('message-data');
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith('message-data');
    });

    it('uses custom message parser', () => {
        const socket = createSocket();
        const parser = vi.fn((event: MessageEvent) => {
            return JSON.parse(event.data as string) as {ok: boolean};
        });

        const request = new WebSocketRequest<{ok: boolean}>('request-1', {
            socket,
            parser,
        });

        const onMessage = vi.fn();

        request.onMessage(onMessage);

        (socket as unknown as MockWebSocket).dispatchMessage('{"ok":true}');

        expect(parser).toHaveBeenCalledOnce();
        expect(request.data).toEqual({ok: true});
        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith({ok: true});
    });

    it('stores latest message data while stream is active', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        (socket as unknown as MockWebSocket).dispatchMessage('first');
        (socket as unknown as MockWebSocket).dispatchMessage('second');

        expect(request.data).toBe('second');
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('emits non-terminal error when parser throws', () => {
        const socket = createSocket();
        const error = new Error('Parse error');

        const request = new WebSocketRequest<string>('request-1', {
            socket,
            parser: () => {
                throw error;
            },
        });

        const onError = vi.fn();
        const onSettled = vi.fn();

        request.onError(onError);
        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchMessage('bad-message');

        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);

        expect(onError).toHaveBeenCalledOnce();
        expect(onError).toHaveBeenCalledWith(error);
        expect(onSettled).not.toHaveBeenCalled();
    });

    it('normalizes non-error parser throw', () => {
        const socket = createSocket();

        const request = new WebSocketRequest<string>('request-1', {
            socket,
            parser: () => {
                throw 'Parse error';
            },
        });

        const onError = vi.fn();

        request.onError(onError);

        (socket as unknown as MockWebSocket).dispatchMessage('bad-message');

        expect(request.error).toEqual(new Error('Parse error'));
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);

        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][0]).toEqual(new Error('Parse error'));
    });

    it('continues receiving messages after parser error', () => {
        const socket = createSocket();
        let shouldThrow = true;

        const request = new WebSocketRequest<string>('request-1', {
            socket,
            parser: (event) => {
                if (shouldThrow) {
                    shouldThrow = false;
                    throw new Error('Parse error');
                }

                return event.data as string;
            },
        });

        const onMessage = vi.fn();
        const onError = vi.fn();

        request.onMessage(onMessage);
        request.onError(onError);

        (socket as unknown as MockWebSocket).dispatchMessage('bad-message');
        (socket as unknown as MockWebSocket).dispatchMessage('good-message');

        expect(request.data).toBe('good-message');
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);

        expect(onError).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith('good-message');
    });

    it('fails request on socket error', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onError = vi.fn();
        const onSettled = vi.fn();

        request.onError(onError);
        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchError();

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(
            new Error('Socket error: [object Event]')
        );

        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][0]).toEqual(
            new Error('Socket error: [object Event]')
        );

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled.mock.calls[0][0]).toBe(RequestStatus.Failed);
        expect(onSettled.mock.calls[0][1]).toEqual(
            new Error('Socket error: [object Event]')
        );
    });

    it('completes request on clean normal close', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onSettled = vi.fn();

        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.NORMAL,
            reason: 'Done',
        });

        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.settled).toBe(true);
        expect(request.error).toBeNull();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });

    it('aborts request on clean aborted close', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onAbort = vi.fn();
        const onSettled = vi.fn();

        request.onAbort(onAbort);
        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.ABORTED,
            reason: 'Aborted',
        });

        expect(request.status).toBe(RequestStatus.Aborted);
        expect(request.settled).toBe(true);
        expect(request.error).toBeNull();

        expect(onAbort).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(RequestStatus.Aborted, null);
    });

    it('fails request on clean close with error code', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onError = vi.fn();
        const onSettled = vi.fn();

        request.onError(onError);
        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.PROTOCOL_ERROR,
            reason: 'Bad protocol',
        });

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(new Error('Code 1002: Bad protocol'));

        expect(onError).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled.mock.calls[0][0]).toBe(RequestStatus.Failed);
        expect(onSettled.mock.calls[0][1]).toEqual(
            new Error('Code 1002: Bad protocol')
        );
    });

    it('uses default close reason when close reason is empty', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.PROTOCOL_ERROR,
            reason: '',
        });

        expect(request.error).toEqual(
            new Error(
                'Code 1002: Connection aborted because of protocol error.'
            )
        );
    });

    it('fails request on unclean close', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onError = vi.fn();
        const onSettled = vi.fn();

        request.onError(onError);
        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: false,
            code: CloseSocketCode.CONNECTION_LOST,
            reason: 'Connection lost',
        });

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(
            new Error('Connection aborted: 1006 Connection lost')
        );

        expect(onError).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled.mock.calls[0][0]).toBe(RequestStatus.Failed);
        expect(onSettled.mock.calls[0][1]).toEqual(
            new Error('Connection aborted: 1006 Connection lost')
        );
    });

    it('closes socket with aborted code when aborted manually', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        request.abort();

        expect(
            (socket as unknown as MockWebSocket).close
        ).toHaveBeenCalledOnce();
        expect((socket as unknown as MockWebSocket).close).toHaveBeenCalledWith(
            CloseSocketCode.ABORTED,
            'Aborted by client'
        );
    });

    it('closes socket with normal code by default', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        request.close();

        expect(
            (socket as unknown as MockWebSocket).close
        ).toHaveBeenCalledOnce();
        expect((socket as unknown as MockWebSocket).close).toHaveBeenCalledWith(
            CloseSocketCode.NORMAL,
            'Connection closed normally.'
        );
    });

    it('closes socket with provided code and reason', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        request.close(CloseSocketCode.PROTOCOL_ERROR, 'Bad protocol');

        expect(
            (socket as unknown as MockWebSocket).close
        ).toHaveBeenCalledOnce();
        expect((socket as unknown as MockWebSocket).close).toHaveBeenCalledWith(
            CloseSocketCode.PROTOCOL_ERROR,
            'Bad protocol'
        );
    });

    it('does not close socket when request is already settled', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.NORMAL,
        });

        request.close();
        request.abort();

        expect(
            (socket as unknown as MockWebSocket).close
        ).not.toHaveBeenCalled();
    });

    it('ignores messages after request is settled', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onMessage = vi.fn();

        request.onMessage(onMessage);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.NORMAL,
        });

        (socket as unknown as MockWebSocket).dispatchMessage('late-message');

        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.data).toBeNull();
        expect(onMessage).not.toHaveBeenCalled();
    });

    it('does not emit settled event more than once', () => {
        const socket = createSocket();
        const request = new WebSocketRequest<string>('request-1', {socket});
        const onSettled = vi.fn();

        request.onSettled(onSettled);

        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: true,
            code: CloseSocketCode.NORMAL,
        });

        (socket as unknown as MockWebSocket).dispatchError();
        (socket as unknown as MockWebSocket).dispatchClose({
            wasClean: false,
            code: CloseSocketCode.CONNECTION_LOST,
        });

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });
});
