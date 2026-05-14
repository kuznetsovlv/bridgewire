import type {UnsubscribeMethod, RequestId} from '@/types';
import {RequestStatus} from '@/types';
import {subscribe} from '@/utils';

/**
 * Base request implementation for BridgeWire transports.
 *
 * Stores request state, latest response data, latest error information, and
 * request-level event subscriptions.
 *
 * Concrete request implementations are responsible for implementing the actual
 * abort behavior and for updating request status according to their own
 * lifecycle rules.
 */
export default abstract class Request<Data> {
    readonly #id: RequestId;

    readonly #abortCallbacks: Set<() => void>;
    readonly #messageCallbacks: Set<(data: Data) => void>;
    readonly #errorCallbacks: Set<(error: Error) => void>;

    protected _status: RequestStatus;
    protected _data: Data | null;
    protected _error: Error | null;

    /**
     * Creates a request instance.
     *
     * @param id - Unique request id.
     * @param status - Initial request status.
     */
    protected constructor(id: RequestId, status: RequestStatus) {
        this.#id = id;
        this.#abortCallbacks = new Set();
        this.#messageCallbacks = new Set();
        this.#errorCallbacks = new Set();

        this._status = status;
        this._data = null;
        this._error = null;
    }

    /**
     * Stores received data as the latest request data and notifies message
     * subscribers.
     *
     * This method does not change request status. Concrete implementations should
     * update status explicitly according to their own lifecycle rules.
     *
     * @param data - Received response data.
     */
    protected _emitMessage(data: Data): void {
        this._data = data;

        this.#messageCallbacks.forEach((callback) => {
            callback(data);
        });
    }

    /**
     * Stores an error as the latest request error and notifies error subscribers.
     *
     * This method does not change request status. Concrete implementations should
     * update status explicitly according to their own lifecycle rules.
     *
     * @param error - Request error.
     */
    protected _emitError(error: Error): void {
        this._error = error;

        this.#errorCallbacks.forEach((callback) => {
            callback(error);
        });
    }

    /**
     * Notifies abort subscribers.
     *
     * This method does not change request status. Concrete implementations should
     * update status explicitly before or after calling this method.
     */
    protected _emitAbort(): void {
        this.#abortCallbacks.forEach((callback) => {
            callback();
        });
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
     * Subscribes to request abort events.
     *
     * The callback is called when this request is aborted.
     *
     * @param callback - Callback called when the request is aborted.
     * @returns Function that removes the callback from the listener collection.
     */
    public onAbort(callback: () => void): UnsubscribeMethod {
        return subscribe(callback, this.#abortCallbacks);
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
        return subscribe(callback, this.#messageCallbacks);
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
        return subscribe(callback, this.#errorCallbacks);
    }

    /**
     * Aborts the request.
     *
     * Concrete implementations decide how the underlying operation is cancelled,
     * for example by aborting an HTTP request, closing a pending operation, or
     * notifying a transport layer.
     *
     * Implementations should update request status according to their own lifecycle
     * rules and call `_emitAbort` to notify abort subscribers.
     */
    public abstract abort(): void;
}
