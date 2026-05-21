import type {
    RequestOptions,
    RequestId,
    UnsubscribeMethod,
    BridgeWireTransportAbortCallback,
    BridgeWireTransportCallback,
    BridgeWireTransportSettledCallback,
    ErrorCallback,
} from '@/types';
import {TransportStatus} from '@/types';
import {subscribe} from '@/utils';
import {Request} from '@/Request';

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
    readonly #abortCallbacks: Set<BridgeWireTransportAbortCallback>;
    readonly #messageCallbacks: Set<BridgeWireTransportCallback<ResponseData>>;
    readonly #requestErrorCallbacks: Set<BridgeWireTransportCallback<Error>>;
    readonly #errorCallbacks: Set<ErrorCallback>;
    readonly #settledCallbacks: Set<BridgeWireTransportSettledCallback>;

    protected _status: TransportStatus;
    protected _requests: Map<RequestId, Request<ResponseData>>;

    /**
     * Aborts a single active request by id.
     *
     * If the request exists, the transport calls the request's own `abort` method
     * and removes the request from the active request collection.
     *
     * Abort subscribers are notified by the request-level abort event bridge
     * registered in `_registerRequest`, not directly by this method.
     *
     * If the request does not exist, the method does nothing.
     *
     * @param id - Id of the request to abort.
     */
    #abortRequest(id: RequestId): void {
        if (this._requests.has(id)) {
            this._requests.get(id)?.abort();
            this._requests.delete(id);
        }
    }

    protected constructor(status: TransportStatus) {
        this.#abortCallbacks = new Set();
        this.#messageCallbacks = new Set();
        this.#requestErrorCallbacks = new Set();
        this.#errorCallbacks = new Set();
        this.#settledCallbacks = new Set();

        this._status = status;
        this._requests = new Map();
    }

    /**
     * Registers a request in the active request collection and connects its
     * request-level events to transport-level subscribers.
     *
     * The request remains the source of request-level events. The transport only
     * forwards those events to its own subscribers.
     *
     * The request is removed from the active collection when it reaches a terminal
     * state. Abort events are forwarded separately so consumers can react to
     * explicit cancellation.
     *
     * Concrete transport implementations should call this method after creating a
     * request object.
     *
     * @param request - Request object created by a concrete transport implementation.
     */
    protected _registerRequest(request: Request<ResponseData>): void {
        this._requests.set(request.id, request);

        request.onAbort(() => {
            this._requests.delete(request.id);
            this.#abortCallbacks.forEach((callback) => callback(request.id));
        });

        request.onMessage?.((data) => {
            this.#messageCallbacks.forEach((callback) => {
                callback(request.id, data);
            });
        });

        request.onError?.((error) => {
            this.#requestErrorCallbacks.forEach((callback) => {
                callback(request.id, error);
            });
        });

        request.onSettled?.((status, error) => {
            this._requests.delete(request.id);
            this.#settledCallbacks.forEach((callback) =>
                callback(request.id, status, error)
            );
        });
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
     * Subscribes to request settled events.
     *
     * The callback is called with request id, final request status, and latest
     * request error when a tracked request reaches a terminal state.
     *
     * @param callback - Callback called when a request is settled.
     * @returns Function that removes the callback from the listener collection.
     */
    public onSettled(
        callback: BridgeWireTransportSettledCallback
    ): UnsubscribeMethod {
        return subscribe(callback, this.#settledCallbacks);
    }

    /**
     * Sends request data through the concrete transport implementation.
     *
     * Implementations are responsible for creating a request object, registering it
     * with `_registerRequest`, delivering the request payload, and resolving or
     * rejecting the request result according to the transport response.
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
