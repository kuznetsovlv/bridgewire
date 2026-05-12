import type {UnsubscribeMethod, RequestId} from '@/types';
import {RequestStatus} from '@/types';
import {subscribe} from '@/utils';

/**
 * Base request implementation for BridgeWire transports.
 *
 * Stores request state, result promise, response data, error information, and
 * request-level event subscriptions.
 *
 * Concrete request implementations are responsible for implementing the actual
 * abort behavior and for updating protected state fields when the request is
 * completed, failed, aborted, or receives response data.
 */
export default abstract class Request<Data> {
    readonly #id: RequestId;

    protected _status: RequestStatus;
    protected _data: Data | null;
    protected _error: Error | null;
    protected _result: Promise<Data>;

    protected _abortCallbacks: Set<() => void>;
    protected _messageCallbacks: Set<(data: Data) => void>;
    protected _errorCallbacks: Set<(error: Error) => void>;

    /**
     * Creates a request instance.
     *
     * @param id - Unique request id.
     * @param status - Initial request status.
     * @param result - Promise that resolves or rejects with the request result.
     */
    constructor(id: RequestId, status: RequestStatus, result: Promise<Data>) {
        this.#id = id;

        this._status = status;
        this._data = null;
        this._error = null;
        this._result = result;

        this._abortCallbacks = new Set();
        this._messageCallbacks = new Set();
        this._errorCallbacks = new Set();
    }

    /**
     * Unique request id.
     */
    public get id(): RequestId {
        return this.#id;
    }

    /**
     * Current request status.
     */
    public get status(): RequestStatus {
        return this._status;
    }

    /**
     * Last successfully received request data.
     *
     * Returns `null` when the request has not received data yet or when the
     * request failed before producing data.
     */
    public get data(): Data | null {
        return this._data;
    }

    /**
     * Last request error.
     *
     * Returns `null` when the request has not failed.
     */
    public get error(): Error | null {
        return this._error;
    }

    /**
     * Promise representing the request result.
     *
     * The promise is created by a concrete request or transport implementation
     * and can be used by consumers to await the final response.
     *
     * @returns Promise that resolves with response data or rejects with an error.
     */
    public result(): Promise<Data> {
        return this._result;
    }

    /**
     * Subscribes to request abort events.
     *
     * The callback is called when this request is aborted.
     *
     * @param callback - Callback called when the request is aborted.
     * @returns Function that removes the callback from the listener collection.
     */
    public onAbort(callback: () => void): UnsubscribeMethod {
        return subscribe(callback, this._abortCallbacks);
    }

    /**
     * Subscribes to request message events.
     *
     * The callback is called when this request receives response data.
     *
     * @param callback - Callback called with received response data.
     * @returns Function that removes the callback from the listener collection.
     */
    public onMessage(callback: (data: Data) => void): UnsubscribeMethod {
        return subscribe(callback, this._messageCallbacks);
    }

    /**
     * Subscribes to request error events.
     *
     * The callback is called when this request fails with an error.
     *
     * @param callback - Callback called with the request error.
     * @returns Function that removes the callback from the listener collection.
     */
    public onError(callback: (error: Error) => void): UnsubscribeMethod {
        return subscribe(callback, this._errorCallbacks);
    }

    /**
     * Aborts the request.
     *
     * Concrete implementations decide how the underlying operation is cancelled,
     * for example by aborting an HTTP request, closing a pending operation, or
     * notifying a transport layer.
     *
     * Implementations should update the request status and notify abort
     * subscribers through `_abortCallbacks`.
     */
    public abstract abort(): void;
}
