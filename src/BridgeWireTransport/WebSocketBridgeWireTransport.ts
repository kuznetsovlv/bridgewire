import type {WebSocketMessageParser} from '@/Request';
import {WebSocketRequest} from '@/Request';
import type {Nullable, RequestOptions, URLData} from '@/types';
import {PayloadDataType, RequestStatus, TransportStatus} from '@/types';
import {constructUrl, isArrayBufferView} from '@/utils';

import BridgeWireTransport from './BridgeWireTransport';

/**
 * Supported WebSocket subprotocol extensions.
 */
type Extensions = 'soap' | 'wamp';

/**
 * WebSocket transport configuration.
 *
 * Contains normalized URL data, optional payload data type, connection timeout,
 * and optional WebSocket subprotocol flags.
 */
interface TransportData {
    /**
     * URL parts used to construct the WebSocket URL.
     */
    urlData: URLData;

    /**
     * Expected incoming message data type.
     *
     * When set to `JSON`, incoming message data is parsed with `JSON.parse`.
     * When set to `ARRAY_BUFFER`, socket `binaryType` is set to `arraybuffer`.
     * Other values are passed through as received from the socket.
     */
    dataType?: PayloadDataType;

    /**
     * WebSocket connection timeout in milliseconds.
     *
     * Applies only to the socket opening phase. It does not limit individual
     * messages or request-response operations.
     */
    timeout?: number;

    /**
     * Whether to request the `soap` WebSocket subprotocol.
     */
    soap?: boolean;

    /**
     * Whether to request the `wamp` WebSocket subprotocol.
     */
    wamp?: boolean;
}

/**
 * Data types that can be sent through a WebSocket connection.
 */
type SendDataType = string | BufferSource | Blob;

/**
 * WebSocket-based BridgeWire transport.
 *
 * Represents a long-lived WebSocket stream transport. The transport owns the
 * underlying socket and keeps one active `WebSocketRequest` for the current
 * socket stream.
 *
 * Calling `send` writes data to the current socket and returns the active stream
 * request. If the previous request is settled, the transport creates a new
 * socket and a new request before sending.
 *
 * Incoming socket messages are handled by `WebSocketRequest` and forwarded
 * through the base transport subscription API.
 *
 * @template RequestData - Data accepted by `send`.
 * @template ResponseData - Data emitted by the active WebSocket request.
 */
export default class WebSocketBridgeWireTransport<
    RequestData,
    ResponseData,
> extends BridgeWireTransport<RequestData, ResponseData> {
    readonly #url: URL;
    readonly #dataType?: PayloadDataType;
    readonly #connectionTimeout: number;
    readonly #soap: boolean;
    readonly #wamp: boolean;

    #connectionTimeoutId?: ReturnType<typeof setTimeout>;
    #socket: WebSocket;
    #request?: WebSocketRequest<ResponseData>;

    constructor({
        urlData,
        dataType,
        timeout = Infinity,
        soap = false,
        wamp = false,
    }: TransportData) {
        super(TransportStatus.Disconnected);

        this.#url = constructUrl(urlData);
        this.#dataType = dataType;
        this.#connectionTimeout = timeout;
        this.#soap = soap;
        this.#wamp = wamp;

        this.#socket = this.#createSocket();
        this.#request = this.#createRequest(this.#socket);
    }

    /**
     * Creates and configures a WebSocket instance.
     *
     * Sets transport status to `Connecting`, applies requested subprotocols,
     * configures connection timeout handling, attaches lifecycle listeners, and
     * sets `binaryType` according to the configured payload data type.
     *
     * @param options - Optional per-request options. `timeout` overrides transport connection timeout.
     * @returns Configured WebSocket instance.
     */
    #createSocket(options: RequestOptions = {}): WebSocket {
        this._status = TransportStatus.Connecting;
        const extensions: Extensions[] = [];

        if (this.#soap) {
            extensions.push('soap');
        }
        if (this.#wamp) {
            extensions.push('wamp');
        }

        const {timeout = this.#connectionTimeout} = options;

        const socket = new WebSocket(this.#url, extensions);

        if (timeout > 0 && timeout !== Infinity) {
            this.#connectionTimeoutId = setTimeout(() => {
                if (this.status === TransportStatus.Connecting) {
                    socket.close();
                    this._status = TransportStatus.Error;

                    this._emitError(
                        new Error(
                            `WebSocket connection timed out after ${timeout} ms`
                        )
                    );
                }
            }, timeout);
        }
        socket.addEventListener('open', () => {
            this.#clearConnectionTimeout();
            this._status = TransportStatus.Connected;
        });

        socket.addEventListener('close', () => {
            this.#clearConnectionTimeout();
            if (this.status !== TransportStatus.Error) {
                this._status = TransportStatus.Disconnected;
            }
        });

        socket.binaryType =
            this.#dataType === PayloadDataType.ARRAY_BUFFER
                ? 'arraybuffer'
                : 'blob';

        return socket;
    }

    /**
     * Creates a WebSocketRequest for the provided socket.
     *
     * Returns `undefined` and emits a transport-level error when the socket is
     * already closing or closed.
     *
     * @param socket - Socket observed by the created request.
     * @returns Created WebSocket request, or `undefined` when the socket cannot be used.
     */
    #createRequest(
        socket: WebSocket
    ): WebSocketRequest<ResponseData> | undefined {
        if (
            ([WebSocket.CLOSING, WebSocket.CLOSED] as number[]).includes(
                socket.readyState
            )
        ) {
            this._emitError(
                new Error('Creating request with inappropriate socket')
            );

            return;
        }

        const request: WebSocketRequest<ResponseData> = new WebSocketRequest(
            crypto.randomUUID(),
            {socket, parser: this.#getParser()}
        );

        this._registerRequest(request);

        request.onError((error: Error) => {
            this.#clearConnectionTimeout();
            this._emitError(error);
        });

        return request;
    }

    /**
     * Clears the pending connection timeout timer if one was created.
     */
    #clearConnectionTimeout(): void {
        if (this.#connectionTimeoutId !== undefined) {
            clearTimeout(this.#connectionTimeoutId);
        }
    }

    /**
     * Returns a message parser for incoming WebSocket messages.
     *
     * JSON payloads are parsed with `JSON.parse`. Other payload types are passed
     * through as received from the socket.
     *
     * @returns WebSocket message parser.
     */
    #getParser(): WebSocketMessageParser<ResponseData> {
        switch (this.#dataType) {
            case PayloadDataType.JSON:
                return ({data}) => JSON.parse(data) as ResponseData;
            default:
                return ({data}) => data as ResponseData;
        }
    }

    /**
     * Returns the current active request, or `null` when no active request exists.
     *
     * Settled requests are not considered active and should be replaced before
     * sending new data.
     *
     * @returns Active WebSocket request or `null`.
     */
    #getActiveRequest(): Nullable<WebSocketRequest<ResponseData>> {
        if (
            !this.#request ||
            [
                RequestStatus.Failed,
                RequestStatus.Aborted,
                RequestStatus.TimedOut,
                RequestStatus.Completed,
            ].includes(this.#request.status)
        ) {
            return null;
        }

        return this.#request;
    }

    /**
     * Converts outgoing request data into a WebSocket-compatible payload.
     *
     * Native WebSocket payload values are passed through. Plain objects are
     * serialized to JSON. Empty or unsupported values are converted to an empty
     * string.
     *
     * @param data - Data passed to `send`.
     * @returns WebSocket-compatible payload.
     */
    #preprocessData(data: RequestData): SendDataType {
        if (
            typeof data === 'string' ||
            isArrayBufferView(data) ||
            data instanceof ArrayBuffer ||
            data instanceof Blob
        ) {
            return data;
        } else if (data && typeof data === 'object') {
            return JSON.stringify(data);
        }

        return '';
    }

    /**
     * Sends data through the WebSocket connection.
     *
     * If the current stream request is missing or settled, creates a new socket and
     * request first. Returns `null` when a usable request cannot be created.
     *
     * @param data - Data to send.
     * @param options - Optional connection options used when a new socket must be created.
     * @returns Active WebSocket request, or `null` when sending is not possible.
     */
    send(
        data: RequestData,
        options?: RequestOptions
    ): Nullable<WebSocketRequest<ResponseData>> {
        let request = this.#getActiveRequest();

        if (!request) {
            this.#socket = this.#createSocket(options);
            this.#request = this.#createRequest(this.#socket);
            request = this.#getActiveRequest();
        }

        if (!request) {
            return null;
        }

        this.#socket.send(this.#preprocessData(data));

        return request;
    }
}
