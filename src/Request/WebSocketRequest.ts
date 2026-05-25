import type {AllowedCloseSocketCode, RequestId} from '@/types';
import {CloseSocketCode, RequestStatus} from '@/types';

import Request from './Request';

/**
 * Parses a WebSocket message event into request data.
 *
 * @template Data - Parsed message data type.
 */
export type WebSocketMessageParser<Data> = (event: MessageEvent) => Data;

/**
 * WebSocket stream request configuration.
 *
 * `WebSocketRequest` does not create or own the socket connection. It observes
 * the provided socket and exposes its message/error/close lifecycle through the
 * base `Request` API.
 *
 * @template Data - Parsed message data type.
 */
export interface WebSocketData<Data> {
    /**
     * WebSocket instance observed by the request.
     */
    socket: WebSocket;

    /**
     * Message parser used to convert incoming `MessageEvent` objects into
     * request data.
     *
     * When omitted, the default parser returns `event.data` as-is.
     */
    parser?: WebSocketMessageParser<Data>;
}

/**
 * Default WebSocket message parser.
 *
 * Returns `event.data` without conversion. For JSON messages, pass an explicit
 * parser that calls `JSON.parse`.
 *
 * @param event - Incoming WebSocket message event.
 * @returns Parsed message data.
 */
const defaultMessageParser = <Data>(event: MessageEvent): Data => {
    return event.data as Data;
};

/**
 * WebSocket-based BridgeWire stream request implementation.
 *
 * Represents one active WebSocket stream rather than one request-response
 * operation. Incoming socket messages are emitted as request message events and
 * keep the request in `Pending` status while the stream remains active.
 *
 * Parser errors are reported through `onError` without settling the request, so
 * the stream can continue receiving later messages. Socket errors and abnormal
 * close events fail the request. Normal close completes the request. Aborted
 * close aborts the request.
 *
 * @template Data - Parsed message data type.
 */
export default class WebSocketRequest<Data> extends Request<Data> {
    #socket: WebSocket;

    /**
     * Creates a WebSocket stream request.
     *
     * The request starts observing the provided socket immediately.
     *
     * @param id - Unique request id.
     * @param data - WebSocket request configuration.
     */
    public constructor(
        id: RequestId,
        {socket, parser = defaultMessageParser}: WebSocketData<Data>
    ) {
        super(id, WebSocketRequest.#getStatus(socket));

        this.#socket = socket;

        socket.addEventListener('message', (event: MessageEvent) => {
            try {
                this._processData(parser(event), RequestStatus.Pending);
            } catch (error) {
                this._processError(
                    error instanceof Error ? error : new Error(String(error)),
                    false
                );
            }
        });

        socket.addEventListener('error', (error) => {
            this._processError(
                new Error(`Socket error: ${error.toString()}`),
                true
            );
        });

        socket.addEventListener('close', ({wasClean, code, reason}) => {
            const closeReason =
                reason || WebSocketRequest.#getDefaultCloseReason(code);
            if (wasClean) {
                switch (code) {
                    case CloseSocketCode.NORMAL:
                        this._processComplete();
                        break;

                    case CloseSocketCode.ABORTED:
                        this._processAbort();
                        break;

                    case CloseSocketCode.SECURITY_ERROR:
                    case CloseSocketCode.CONNECTION_LOST:
                    case CloseSocketCode.INCONSISTENT_DATA_TYPE:
                    case CloseSocketCode.INCONSISTENT_MESSAGE_TYPE:
                    case CloseSocketCode.MESSAGE_IS_TOO_BIG:
                    case CloseSocketCode.NEGOTIATION_FAILED:
                    case CloseSocketCode.UNEXPECTED_CONDITIONS:
                    case CloseSocketCode.VIOLATES_POLICY_MESSAGE:
                    case CloseSocketCode.PROTOCOL_ERROR:
                    case CloseSocketCode.NO_STATUS:
                    default:
                        this._processError(
                            new Error(`Code ${code}: ${closeReason}`),
                            true
                        );
                }
            } else {
                this._processError(
                    new Error(`Connection aborted: ${code} ${closeReason}`),
                    true
                );
            }
        });
    }

    /**
     * Converts the current socket ready state into initial request status.
     *
     * Connecting, open, and closing sockets are treated as active streams.
     * Closed sockets are treated as failed because close details are unavailable
     * during construction.
     *
     * @param socket - WebSocket instance.
     * @returns Initial request status.
     */
    static #getStatus(socket: WebSocket): RequestStatus {
        switch (socket.readyState) {
            case WebSocket.CONNECTING:
            case WebSocket.OPEN:
            default:
                return RequestStatus.Pending;
            case WebSocket.CLOSING:
            case WebSocket.CLOSED:
                return RequestStatus.Failed;
        }
    }

    /**
     * Returns a fallback close reason for known WebSocket close codes.
     *
     * @param code - WebSocket close code.
     * @returns Human-readable close reason.
     */
    static #getDefaultCloseReason(code: CloseSocketCode): string {
        switch (code) {
            case CloseSocketCode.NORMAL:
                return 'Connection closed normally.';
            case CloseSocketCode.ABORTED:
                return 'Connection aborted.';
            case CloseSocketCode.PROTOCOL_ERROR:
                return 'Connection aborted because of protocol error.';
            case CloseSocketCode.CONNECTION_LOST:
                return 'Connection lost.';
            case CloseSocketCode.INCONSISTENT_DATA_TYPE:
                return 'Connection aborted because of inconsistent data type.';
            case CloseSocketCode.INCONSISTENT_MESSAGE_TYPE:
                return 'Connection aborted because of inconsistent message type.';
            case CloseSocketCode.MESSAGE_IS_TOO_BIG:
                return 'Connection aborted because of enormous message size.';
            case CloseSocketCode.NEGOTIATION_FAILED:
                return 'Negotiation failed.';
            case CloseSocketCode.NO_STATUS:
                return 'No expected status.';
            case CloseSocketCode.RESERVED:
                return 'Connection close with unknown reason.';
            case CloseSocketCode.SECURITY_ERROR:
                return 'Security error.';
            case CloseSocketCode.UNEXPECTED_CONDITIONS:
                return 'Unexpected conditions';
            case CloseSocketCode.VIOLATES_POLICY_MESSAGE:
                return 'Violates policy message';
            default:
                return String(code);
        }
    }

    /**
     * Aborts the WebSocket stream by closing the underlying socket with the
     * `ABORTED` close code.
     *
     * If the request is already settled, this method does nothing.
     */
    public abort(): void {
        if (this.status === RequestStatus.Pending) {
            this.#socket.close(CloseSocketCode.ABORTED, 'Aborted by client');
        }
    }

    /**
     * Closes the WebSocket stream with the provided close code and reason.
     *
     * If the request is already settled, this method does nothing. The final
     * request status is resolved from the socket `close` event.
     *
     * @param code - WebSocket close code to send.
     * @param reason - Human-readable close reason.
     */
    public close(
        code: AllowedCloseSocketCode = CloseSocketCode.NORMAL,
        reason: string = WebSocketRequest.#getDefaultCloseReason(code)
    ): void {
        if (this.status === RequestStatus.Pending) {
            this.#socket.close(code, reason);
        }
    }
}
