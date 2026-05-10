import type {
    RequestOptions,
    Request,
    RequestId,
    UnsubscribeMethod,
    BridgeWireTransportAbortCallback,
    BridgeWireTransportCallback,
    ErrorCallback,
} from '@/types';
import {TransportStatus} from '@/types';
import {subscribe} from '@/utils';

/**
 * Base transport implementation for BridgeWire request/response communication.
 *
 * Stores active requests, exposes shared subscription methods, and provides
 * common request abort logic for concrete transport implementations.
 *
 * Concrete transports are responsible for implementing the actual `send`
 * behavior, for example over HTTP, WebSocket, or another communication layer.
 */
export default abstract class BridgeWireTransport<RequestData, ResponseData> {
    readonly #abortCallbacks: Set<BridgeWireTransportAbortCallback> = new Set();
    readonly #messageCallbacks: Set<BridgeWireTransportCallback<ResponseData>> =
        new Set();
    readonly #requestErrorCallbacks: Set<BridgeWireTransportCallback<Error>> =
        new Set();
    readonly #errorCallbacks: Set<ErrorCallback> = new Set();

    protected _status: TransportStatus;

    protected _requests: Map<RequestId, Request<ResponseData>> = new Map();

    /**
     * Aborts a single active request by id.
     *
     * If the request exists, it is aborted, removed from the active request
     * collection, and all abort subscribers are notified with the request id.
     *
     * If the request does not exist, the method does nothing.
     *
     * @param id - Id of the request to abort.
     */
    #abortRequest(id: RequestId): void {
        if (this._requests.has(id)) {
            this._requests.get(id)?.abort();
            this._requests.delete(id);
            this.#abortCallbacks.forEach((callback) => callback(id));
        }
    }

    constructor(status: TransportStatus) {
        this._status = status;
    }

    /**
     * Aborts one, several, or all active requests.
     *
     * - When a request id is provided, only that request is aborted.
     * - When an array of request ids is provided, all matching requests are aborted.
     * - When called without arguments, all currently tracked requests are aborted.
     *
     * Aborting an unknown request id is a no-op.
     *
     * @param ids - Request id, list of request ids, or undefined to abort all requests.
     */
    public abort(ids?: RequestId | RequestId[]): void {
        if (Array.isArray(ids)) {
            ids.forEach((id) => this.#abortRequest(id));
        } else if (ids === undefined) {
            [...this._requests.keys()].forEach((id) => this.#abortRequest(id));
        } else {
            this.#abortRequest(ids);
        }
    }

    public get status(): TransportStatus {
        return this._status;
    }

    /**
     * Subscribes to request abort events.
     *
     * The callback is called with the id of the aborted request.
     *
     * @param callback - Callback called when a request is aborted.
     * @returns Function that removes the callback from the listener collection.
     */
    public onAbort(
        callback: BridgeWireTransportAbortCallback
    ): UnsubscribeMethod {
        return subscribe(callback, this.#abortCallbacks);
    }

    /**
     * Subscribes to incoming response messages.
     *
     * @param callback - Callback called with request id and response data.
     * @returns Function that removes the callback from the listener collection.
     */
    public onMessage(
        callback: BridgeWireTransportCallback<ResponseData>
    ): UnsubscribeMethod {
        return subscribe(callback, this.#messageCallbacks);
    }

    /**
     * Subscribes to request-level errors.
     *
     * Request-level errors are associated with a specific request id.
     *
     * @param callback - Callback called with request id and error.
     * @returns Function that removes the callback from the listener collection.
     */
    public onRequestError(
        callback: BridgeWireTransportCallback<Error>
    ): UnsubscribeMethod {
        return subscribe(callback, this.#requestErrorCallbacks);
    }

    /**
     * Subscribes to transport-level errors.
     *
     * Transport-level errors are not necessarily associated with a specific request.
     *
     * @param callback - Callback called when a transport-level error occurs.
     * @returns Function that removes the callback from the listener collection.
     */
    public onError(callback: ErrorCallback): UnsubscribeMethod {
        return subscribe(callback, this.#errorCallbacks);
    }

    /**
     * Sends request data through the concrete transport implementation.
     *
     * Implementations are responsible for creating a request object, storing it in
     * the active request collection when needed, delivering the request payload,
     * and resolving or rejecting the request result according to the transport
     * response.
     *
     * @param request - Request payload to send.
     * @param options - Optional request options, such as timeout.
     * @returns Request object representing the sent request.
     */
    public abstract send(
        request: RequestData,
        options?: RequestOptions
    ): Request<ResponseData>;
}
