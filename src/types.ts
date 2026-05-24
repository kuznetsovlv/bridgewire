/**
 * Represents a value that can be either the given type or `null`.
 *
 * @template T - Non-null value type.
 */
export type Nullable<T> = T | null;

/**
 * Makes every property of `T` required, but allows each property value to be `null`.
 *
 * Useful for normalized config objects where every known config key should exist,
 * even when the user did not provide a value.
 *
 * @template T - Source object type.
 */
export type RequiredNullable<T> = {
    [K in keyof Required<T>]: Nullable<Required<T>[K]>;
};

/**
 * Supported BridgeWire transport implementations.
 */
export enum TransportType {
    /**
     * HTTP Fetch-based transport.
     */
    FETCH = 'fetch',

    /**
     * WebSocket-based transport.
     */
    WEBSOCKET = 'websocket',
}

/**
 * Supported URL protocols.
 */
export enum Protocol {
    /**
     * Plain HTTP protocol.
     */
    HTTP = 'http',

    /**
     * Secure HTTP protocol.
     */
    HTTPS = 'https',

    /**
     * Plain WebSocket protocol.
     */
    WS = 'ws',

    /**
     * Secure WebSocket protocol.
     */
    WSS = 'wss',
}

/**
 * Supported HTTP methods.
 */
export enum HTTPMethod {
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
    OPTIONS = 'OPTIONS',
}

/**
 * URL query representation.
 *
 * String values are serialized as single query parameters.
 * Array values are serialized as repeated query parameters.
 *
 * @example
 * { tag: ['react', 'typescript'] }
 * // ?tag=react&tag=typescript
 */
export type Query = Record<string, string | string[]>;

/**
 * Normalized URL data used by BridgeWire URL utilities and builders.
 *
 * `path` and `query` are always present. Protocol, host, port and hash may be
 * omitted and later inferred from runtime defaults or builder configuration.
 */
export type URLData = {path: string; query: Query} & Partial<{
    /**
     * URL protocol.
     */
    protocol: Protocol;

    /**
     * URL host, optionally including port when parsed from URL input.
     */
    host: string;

    /**
     * URL hash fragment, preferably with the leading `#`.
     */
    hash: string;

    /**
     * URL port.
     */
    port: number;
}>;

/**
 * Normalized BridgeWire configuration shape.
 *
 * Every property is present, but each value may be `null` when not configured.
 */
export type Config = RequiredNullable<
    {
        /**
         * Selected transport type.
         */
        transport: TransportType;

        /**
         * Default HTTP method.
         */
        method: HTTPMethod;

        /**
         * Default request headers.
         */
        headers: HeadersInit;

        /**
         * Default request timeout in milliseconds.
         */
        timeout: number;
    } & URLData
>;

/**
 * Unique request identifier.
 */
export type RequestId = string;

/**
 * Function returned by subscription methods.
 *
 * Calling it removes the previously registered callback. Implementations should
 * keep unsubscribe functions safe to call more than once.
 */
export type UnsubscribeMethod = () => void;

/**
 * Generic error callback.
 */
export type ErrorCallback = (error: Error) => void;

/**
 * Request lifecycle status.
 */
export enum RequestStatus {
    /**
     * Request is active and can still receive data, fail, timeout or be aborted.
     */
    Pending = 'Pending',

    /**
     * Request completed successfully.
     */
    Completed = 'Completed',

    /**
     * Request failed with an error.
     */
    Failed = 'Failed',

    /**
     * Request was explicitly aborted.
     */
    Aborted = 'Aborted',

    /**
     * Request timed out.
     */
    TimedOut = 'TimedOut',
}

/**
 * Per-request options passed to transport `send` calls.
 */
export interface RequestOptions {
    /**
     * Request timeout in milliseconds.
     *
     * When omitted, the transport default is used.
     */
    timeout?: number;
}

/**
 * Transport-level callback associated with a request id.
 *
 * Used for events such as request messages and request-level errors.
 *
 * @template T - Event payload type.
 */
export type BridgeWireTransportCallback<T> = (id: RequestId, data: T) => void;

/**
 * Transport-level callback for request abort events.
 */
export type BridgeWireTransportAbortCallback = (id: RequestId) => void;

/**
 * Transport-level callback for request settled events.
 *
 * Called when a tracked request reaches a terminal state.
 */
export type BridgeWireTransportSettledCallback = (
    id: RequestId,
    status: RequestStatus,
    error: Error | null
) => void;

/**
 * Transport lifecycle status.
 */
export enum TransportStatus {
    /**
     * Transport is not connected.
     */
    Disconnected = 'Disconnected',

    /**
     * Transport is currently establishing a connection.
     */
    Connecting = 'Connecting',

    /**
     * Transport is connected and can send requests.
     */
    Connected = 'Connected',

    /**
     * Transport is closing.
     */
    Closing = 'Closing',

    /**
     * Transport encountered a transport-level error.
     */
    Error = 'Error',
}

/**
 * Fetch request mode.
 *
 * Mirrors the browser Fetch API `mode` option.
 */
export enum FetchMode {
    CORS = 'cors',
    SAME_ORIGIN = 'same-origin',
    NO_CORS = 'no-cors',
}

/**
 * Fetch credentials mode.
 *
 * Mirrors the browser Fetch API `credentials` option.
 */
export enum FetchCredentials {
    SAME_ORIGIN = 'same-origin',
    INCLUDE = 'include',
    OMIT = 'omit',
}

/**
 * Fetch cache mode.
 *
 * Mirrors the browser Fetch API `cache` option.
 */
export enum FetchCache {
    DEFAULT = 'default',
    NO_STORE = 'no-store',
    RELOAD = 'reload',
    NO_CACHE = 'no-cache',
    FORCE_CACHE = 'force-cache',
    ONLY_IF_CACHED = 'only-if-cached',
}

/**
 * Fetch redirect mode.
 *
 * Mirrors the browser Fetch API `redirect` option.
 */
export enum FetchRedirect {
    FOLLOW = 'follow',
    ERROR = 'error',
    MANUAL = 'manual',
}

/**
 * WebSocket close codes known by BridgeWire.
 *
 * Some codes are valid to receive from close events but must not be sent
 * manually through `WebSocket.close`.
 */
export enum CloseSocketCode {
    /**
     * Normal closure.
     */
    NORMAL = 1000,

    /**
     * Endpoint is going away or the operation was aborted.
     */
    ABORTED = 1001,

    /**
     * Protocol error.
     */
    PROTOCOL_ERROR = 1002,

    /**
     * Unsupported or inconsistent data type.
     */
    INCONSISTENT_DATA_TYPE = 1003,

    /**
     * Reserved close code. Should not be sent manually.
     */
    RESERVED = 1004,

    /**
     * No status code was present. Should not be sent manually.
     */
    NO_STATUS = 1005,

    /**
     * Abnormal closure or lost connection. Should not be sent manually.
     */
    CONNECTION_LOST = 1006,

    /**
     * Message data was inconsistent with the expected message type.
     */
    INCONSISTENT_MESSAGE_TYPE = 1007,

    /**
     * Message violates policy.
     */
    VIOLATES_POLICY_MESSAGE = 1008,

    /**
     * Message is too large.
     */
    MESSAGE_IS_TOO_BIG = 1009,

    /**
     * Extension or negotiation failed.
     */
    NEGOTIATION_FAILED = 1010,

    /**
     * Unexpected server-side condition.
     */
    UNEXPECTED_CONDITIONS = 1011,

    /**
     * TLS or security-related failure. Should not be sent manually.
     */
    SECURITY_ERROR = 1015,
}

/**
 * WebSocket close codes that BridgeWire allows to send manually.
 *
 * Excludes reserved and receive-only codes such as `1004`, `1005`, `1006`
 * and `1015`.
 */
export const ALLOWED_CLOSE_SOCKET_CODES = [
    CloseSocketCode.NORMAL,
    CloseSocketCode.ABORTED,
    CloseSocketCode.PROTOCOL_ERROR,
    CloseSocketCode.INCONSISTENT_DATA_TYPE,
    CloseSocketCode.INCONSISTENT_MESSAGE_TYPE,
    CloseSocketCode.VIOLATES_POLICY_MESSAGE,
    CloseSocketCode.MESSAGE_IS_TOO_BIG,
    CloseSocketCode.NEGOTIATION_FAILED,
    CloseSocketCode.UNEXPECTED_CONDITIONS,
] as const satisfies readonly CloseSocketCode[];

/**
 * WebSocket close code that can be passed to `WebSocket.close`.
 */
export type AllowedCloseSocketCode =
    (typeof ALLOWED_CLOSE_SOCKET_CODES)[number];

/**
 * Expected payload data type.
 *
 * Used by builders and transports to select or configure parsing strategy.
 */
export enum PayloadDataType {
    /**
     * Plain text payload.
     */
    TEXT = 'Text',

    /**
     * JSON payload.
     */
    JSON = 'JSON',

    /**
     * Blob payload.
     */
    BLOB = 'Blob',

    /**
     * FormData payload.
     *
     * Supported by Fetch body parsing/sending, but not by WebSocket transport.
     */
    FORM_DATA = 'FormData',

    /**
     * ArrayBuffer payload.
     */
    ARRAY_BUFFER = 'ArrayBuffer',
}

/**
 * Base Fetch request data shared by Fetch-based transport and request classes.
 *
 * This type stores fully normalized Fetch options. Optional user-facing builder
 * configuration should be resolved to these values before creating a concrete
 * Fetch request where possible.
 */
export interface BaseFetchRequestData {
    /**
     * HTTP method used by the request.
     *
     * Defaults to `GET`.
     */
    method: HTTPMethod;

    /**
     * Request headers.
     */
    headers: HeadersInit;

    /**
     * Request body.
     */
    body: string | FormData | Blob | BufferSource | URLSearchParams;

    /**
     * Request referrer.
     *
     * Defaults to `about:client`.
     */
    referrer: string;

    /**
     * Request referrer policy.
     *
     * Defaults to `strict-origin-when-cross-origin`.
     */
    referrerPolicy: ReferrerPolicy;

    /**
     * Request mode.
     *
     * Defaults to `cors`.
     */
    mode: FetchMode;

    /**
     * Request credentials mode.
     *
     * Defaults to `same-origin`.
     */
    credentials: FetchCredentials;

    /**
     * Request cache mode.
     *
     * Defaults to `default`.
     */
    cache: FetchCache;

    /**
     * Request redirect mode.
     *
     * Defaults to `follow`.
     */
    redirect: FetchRedirect;

    /**
     * Request subresource integrity value.
     */
    integrity: string;

    /**
     * Whether the request may outlive the page.
     *
     * Defaults to `false`.
     */
    keepalive: boolean;

    /**
     * Request timeout in milliseconds.
     *
     * When the timeout expires while the request is still pending, the
     * underlying fetch operation is aborted and the request status becomes
     * `TimedOut`.
     *
     * Defaults to `Infinity`, which disables timeout handling.
     */
    timeout: number;
}
