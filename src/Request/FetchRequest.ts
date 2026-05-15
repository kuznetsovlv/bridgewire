import Request from './Request';
import {
    FetchCache,
    FetchCredentials,
    FetchMode,
    FetchRedirect,
    HTTPMethod,
    RequestStatus,
} from '@/types';
import type {RequestId} from '@/types';

/**
 * Parses a fetch response into request data.
 *
 * @template Data - Parsed response data type.
 */
export type FetchResponseParser<Data> = (response: Response) => Promise<Data>;

/**
 * Fetch request configuration.
 *
 * Most options map directly to the standard `fetch` init options.
 *
 * @template Data - Parsed response data type.
 */
export interface FetchData<Data> {
    /**
     * Request URL.
     */
    url: URL;

    /**
     * HTTP method used by the request.
     *
     * Defaults to `GET`.
     */
    method?: HTTPMethod;

    /**
     * Request headers.
     */
    headers?: HeadersInit;

    /**
     * Request body.
     */
    body?: string | FormData | Blob | BufferSource | URLSearchParams;

    /**
     * Request referrer.
     *
     * Defaults to `about:client`.
     */
    referrer?: string;

    /**
     * Request referrer policy.
     *
     * Defaults to `strict-origin-when-cross-origin`.
     */
    referrerPolicy?: ReferrerPolicy;

    /**
     * Request mode.
     *
     * Defaults to `cors`.
     */
    mode?: FetchMode;

    /**
     * Request credentials mode.
     *
     * Defaults to `same-origin`.
     */
    credentials?: FetchCredentials;

    /**
     * Request cache mode.
     *
     * Defaults to `default`.
     */
    cache?: FetchCache;

    /**
     * Request redirect mode.
     *
     * Defaults to `follow`.
     */
    redirect?: FetchRedirect;

    /**
     * Request subresource integrity value.
     */
    integrity?: string;

    /**
     * Whether the request may outlive the page.
     *
     * Defaults to `false`.
     */
    keepalive?: boolean;

    /**
     * Response parser used to convert the fetch `Response` into request data.
     *
     * When omitted, the default parser chooses a parsing strategy based on
     * response status and `Content-Type`.
     */
    responseParser?: FetchResponseParser<Data>;

    /**
     * Request timeout in milliseconds.
     *
     * When the timeout expires while the request is still pending, the
     * underlying fetch operation is aborted and the request status becomes
     * `TimedOut`.
     *
     * Defaults to `Infinity`, which disables timeout handling.
     */
    timeout?: number;
}

/**
 * Default fetch response parser.
 *
 * Parsing strategy:
 * - `204 No Content` and `205 Reset Content` are parsed as `undefined`.
 * - Responses with `application/json` content type are parsed with `json()`.
 * - Responses with `text/*` content type are parsed with `text()`.
 * - Responses with `multipart/form-data` content type are parsed with `formData()`.
 * - All other responses are parsed with `blob()`.
 *
 * The parser is intentionally generic, but its actual runtime return type
 * depends on the response status and `Content-Type`. For stricter behavior,
 * pass an explicit `responseParser`.
 *
 * @param response - Fetch response to parse.
 * @returns Parsed response data.
 */
export const defaultResponseParser = async <Data>(
    response: Response
): Promise<Data> => {
    if (response.status === 204 || response.status === 205) {
        return undefined as Data;
    }

    const contentType = response.headers.get('content-type')?.toLowerCase();

    if (contentType?.includes('application/json')) {
        return response.json() as Promise<Data>;
    }

    if (contentType?.startsWith('text/')) {
        return response.text() as Promise<Data>;
    }

    if (contentType?.includes('multipart/form-data')) {
        return response.formData() as Promise<Data>;
    }

    return response.blob() as Promise<Data>;
};

/**
 * Fetch-based BridgeWire request implementation.
 *
 * Starts a fetch operation immediately after construction, parses the response
 * with a configurable response parser, updates request state, and emits
 * request-level events through the base `Request` API.
 *
 * A successful response updates the request with `Completed` status. A non-OK
 * response, fetch rejection, or parser failure updates the request with
 * `Failed` status. A timeout updates the request with `TimedOut` status. Manual
 * abort updates the request with `Aborted` status.
 *
 * @template Data - Parsed response data type.
 */
export default class FetchRequest<Data> extends Request<Data> {
    readonly #controller: AbortController;
    readonly #timeoutId?: ReturnType<typeof setTimeout>;

    /**
     * Creates and starts a fetch request.
     *
     * The request starts immediately. Consumers can subscribe to message, error,
     * and abort events after construction through the inherited `Request` methods.
     *
     * @param id - Unique request id.
     * @param data - Fetch request configuration.
     */
    public constructor(
        id: RequestId,
        {
            url,
            method = HTTPMethod.GET,
            headers,
            body,
            referrer = 'about:client',
            referrerPolicy = 'strict-origin-when-cross-origin',
            mode = FetchMode.CORS,
            credentials = FetchCredentials.SAME_ORIGIN,
            cache = FetchCache.DEFAULT,
            redirect = FetchRedirect.FOLLOW,
            integrity = '',
            keepalive = false,
            responseParser = defaultResponseParser,
            timeout = Infinity,
        }: FetchData<Data>
    ) {
        super(id, RequestStatus.Pending);

        this.#controller = new AbortController();

        if (timeout > 0 && timeout !== Infinity) {
            this.#timeoutId = setTimeout(() => {
                if (this.status === RequestStatus.Pending) {
                    this.#controller.abort();
                    this._processTimeout(timeout);
                }
            }, timeout);
        }

        fetch(url, {
            signal: this.#controller.signal,
            method,
            headers,
            body,
            referrer,
            referrerPolicy,
            mode,
            credentials,
            cache,
            redirect,
            integrity,
            keepalive,
        }).then(
            async (result) => {
                this.#clearTimeout();
                if (result.ok) {
                    try {
                        const data = await responseParser(result);
                        this._processData(data, RequestStatus.Completed);
                    } catch (error) {
                        this._processError(
                            error instanceof Error
                                ? error
                                : new Error(String(error))
                        );
                    }
                } else {
                    const {status, statusText} = result;
                    this._processError(
                        new Error(`Error ${status}: ${statusText}`)
                    );
                }
            },
            (error) => {
                this.#clearTimeout();
                if (
                    ![RequestStatus.Aborted, RequestStatus.TimedOut].includes(
                        this.status
                    )
                ) {
                    this._processError(
                        error instanceof Error
                            ? error
                            : new Error(String(error))
                    );
                }
            }
        );
    }

    /**
     * Clears the request timeout timer if one was created.
     */
    #clearTimeout(): void {
        if (this.#timeoutId !== undefined) {
            clearTimeout(this.#timeoutId);
        }
    }

    /**
     * Aborts the underlying fetch operation while the request is pending.
     *
     * If the request is already completed, failed, timed out, or aborted, this
     * method does nothing.
     */
    abort(): void {
        if (this.status === RequestStatus.Pending) {
            this.#clearTimeout();
            this.#controller.abort();
            this._processAbort();
        }
    }
}
