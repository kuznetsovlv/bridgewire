import {RequestId, RequestStatus, UnsubscribeMethod} from '@/types';
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
    #data: Data | null;
    #error: Error | null;

    protected _status: RequestStatus;

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
        this.#data = null;
        this.#error = null;

        this._status = status;
    }

    /**
     * Notifies message subscribers.
     *
     * This method does not store data or change request status.
     *
     * @param data - Received response data.
     */
    #emitMessage(data: Data): void {
        this.#messageCallbacks.forEach((callback) => {
            callback(data);
        });
    }

    /**
     * Notifies error subscribers.
     *
     * This method does not store error information or change request status.
     *
     * @param error - Request error.
     */
    #emitError(error: Error): void {
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
    #emitAbort(): void {
        this.#abortCallbacks.forEach((callback) => {
            callback();
        });
    }

    /**
     * Stores received data, updates request status, and notifies message subscribers.
     *
     * Concrete implementations should call this method when the request receives
     * response data or completes with response data.
     *
     * @param data - Received response data.
     * @param status - New request status.
     */
    protected _processData(data: Data, status: RequestStatus): void {
        this.#data = data;
        this._status = status;
        this.#emitMessage(data);
    }

    /**
     * Stores the latest request error, marks the request as failed, and notifies
     * error subscribers.
     *
     * @param error - Request error.
     */
    protected _processError(error: Error): void {
        this.#error = error;
        this._status = RequestStatus.Failed;
        this.#emitError(error);
    }

    /**
     * Stores timeout error, marks the request as timed out, and notifies error
     * subscribers.
     *
     * @param timeout - Timeout duration in milliseconds.
     */
    protected _processTimeout(timeout: number): void {
        const error = new Error(`Request timed out after ${timeout}ms`);

        this.#error = error;
        this._status = RequestStatus.TimedOut;
        this.#emitError(error);
    }

    /**
     * Marks the request as aborted and notifies abort subscribers.
     */
    protected _processAbort(): void {
        this._status = RequestStatus.Aborted;
        this.#emitAbort();
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
     * Latest data received by the request.
     *
     * Returns `null` when the request has not received data yet.
     */
    public get data(): Data | null {
        return this.#data;
    }

    /**
     * Latest request error.
     *
     * Returns `null` when the request has not produced an error.
     */
    public get error(): Error | null {
        return this.#error;
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
     * The callback is called when this request fails or times out.
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
     * Implementations should call `_processAbort` when the request is considered
     * aborted.
     */
    public abstract abort(): void;
}
