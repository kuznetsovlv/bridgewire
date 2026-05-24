import type {RequestId, UnsubscribeMethod} from '@/types';
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
    #status: RequestStatus;

    readonly #abortCallbacks: Set<() => void>;
    readonly #messageCallbacks: Set<(data: Data) => void>;
    readonly #errorCallbacks: Set<(error: Error) => void>;
    readonly #settledCallbacks: Set<
        (status: RequestStatus, error: Error | null) => void
    >;
    #data: Data | null;
    #error: Error | null;

    /**
     * Creates a request instance.
     *
     * @param id - Unique request id.
     * @param status - Initial request status.
     */
    protected constructor(id: RequestId, status: RequestStatus) {
        this.#id = id;
        this.#status = status;

        this.#abortCallbacks = new Set();
        this.#messageCallbacks = new Set();
        this.#errorCallbacks = new Set();
        this.#settledCallbacks = new Set();

        this.#data = null;
        this.#error = null;
    }

    static #isSettledStatus(status: RequestStatus): boolean {
        return [
            RequestStatus.Completed,
            RequestStatus.Failed,
            RequestStatus.Aborted,
            RequestStatus.TimedOut,
        ].includes(status);
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

    #emitSettled(): void {
        this.#settledCallbacks.forEach((callback) => {
            callback(this.#status, this.#error);
        });
    }

    /**
     * Stores received data, updates request status, and notifies message
     * subscribers.
     *
     * If the new status is terminal, also notifies settled subscribers.
     *
     * Concrete implementations should call this method when the request receives
     * response data or completes with response data.
     *
     * @param data - Received response data.
     * @param status - New request status.
     */
    protected _processData(data: Data, status: RequestStatus): void {
        if (!this.settled) {
            this.#data = data;
            this.#status = status;
            this.#emitMessage(data);

            if (Request.#isSettledStatus(status)) {
                this.#emitSettled();
            }
        }
    }

    /**
     * Stores the latest request error and notifies error subscribers.
     *
     * When `settle` is `true`, also marks the request as failed and notifies
     * settled subscribers. When `settle` is `false`, the request keeps its current
     * status and can continue receiving data.
     *
     * @param error - Request error.
     * @param settle - Whether this error should finish the request lifecycle.
     */
    protected _processError(error: Error, settle: boolean = true): void {
        if (!this.settled) {
            this.#error = error;
            this.#emitError(error);
            if (settle) {
                this.#status = RequestStatus.Failed;
                this.#emitSettled();
            }
        }
    }

    /**
     * Stores timeout error, marks the request as timed out, and notifies error
     * subscribers.
     *
     * @param timeout - Timeout duration in milliseconds.
     */
    protected _processTimeout(timeout: number): void {
        if (!this.settled) {
            const error = new Error(`Request timed out after ${timeout}ms`);

            this.#error = error;
            this.#status = RequestStatus.TimedOut;
            this.#emitError(error);
            this.#emitSettled();
        }
    }

    /**
     * Marks the request as aborted and notifies abort subscribers.
     */
    protected _processAbort(): void {
        if (!this.settled) {
            this.#status = RequestStatus.Aborted;
            this.#emitAbort();
            this.#emitSettled();
        }
    }

    protected _processComplete(): void {
        if (!this.settled) {
            this.#status = RequestStatus.Completed;
            this.#emitSettled();
        }
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
        return this.#status;
    }

    /**
     * Whether the request has reached a terminal state.
     *
     * Terminal states are `Completed`, `Failed`, `Aborted`, and `TimedOut`.
     */
    public get settled(): boolean {
        return Request.#isSettledStatus(this.#status);
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
     * The callback is called when this request produces an error. Depending on the
     * concrete request implementation, an error may either finish the request or be
     * reported while the request remains active.
     *
     * @param callback - Callback called with the request error.
     * @returns Function that removes the callback from the listener collection.
     */
    public onError(callback: (error: Error) => void): UnsubscribeMethod {
        return subscribe(callback, this.#errorCallbacks);
    }

    /**
     * Subscribes to request settled events.
     *
     * The callback is called once when this request reaches a terminal state:
     * `Completed`, `Failed`, `Aborted`, or `TimedOut`.
     *
     * @param callback - Callback called with the final status and latest error.
     * @returns Function that removes the callback from the listener collection.
     */
    public onSettled(
        callback: (status: RequestStatus, error: Error | null) => void
    ): UnsubscribeMethod {
        return subscribe(callback, this.#settledCallbacks);
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
