export type Nullable<T> = T | null;

export type RequiredNullable<T> = {
    [K in keyof Required<T>]: Nullable<Required<T>[K]>;
};

export enum TransportType {
    FETCH = 'fetch',
    WEBSOCKET = 'websocket',
}

export enum Protocol {
    HTTP = 'http',
    HTTPS = 'https',
    WS = 'ws',
    WSS = 'wss',
}

export enum HTTPMethod {
    GET = 'GET',
    HEAD = 'HEAD',
    POST = 'POST',
    PUT = 'PUT',
    PATCH = 'PATCH',
    DELETE = 'DELETE',
}

export type Query = Record<string, string | string[]>;

export type URLData = {path: string; query: Query} & Partial<{
    protocol: Protocol;
    host: string;
    hash: string;
    port: number;
}>;

export type Config = RequiredNullable<
    {
        transport: TransportType;
        method: HTTPMethod;
        headers: HeadersInit;
        timeout: number;
    } & URLData
>;

export type RequestId = string;

export type UnsubscribeMethod = () => void;
export type ErrorCallback = (error: Error) => void;

export enum RequestStatus {
    Pending = 'Pending',
    Completed = 'Completed',
    Failed = 'Failed',
    Aborted = 'Aborted',
    TimedOut = 'TimedOut',
}

export interface RequestOptions {
    timeout?: number;
}

export type BridgeWireTransportCallback<T> = (id: RequestId, data: T) => void;
export type BridgeWireTransportAbortCallback = (id: RequestId) => void;
export type BridgeWireTransportSettledCallback = (
    id: RequestId,
    status: RequestStatus,
    error: Error | null
) => void;

export enum TransportStatus {
    Disconnected = 'Disconnected',
    Connecting = 'Connecting',
    Connected = 'Connected',
    Closing = 'Closing',
    Error = 'Error',
}

export enum FetchMode {
    CORS = 'cors',
    SAME_ORIGIN = 'same-origin',
    NO_CORS = 'no-cors',
}

export enum FetchCredentials {
    SAME_ORIGIN = 'same-origin',
    INCLUDE = 'include',
    OMIT = 'omit',
}

export enum FetchCache {
    DEFAULT = 'default',
    NO_STORE = 'no-store',
    RELOAD = 'reload',
    NO_CACHE = 'no-cache',
    FORCE_CACHE = 'force-cache',
    ONLY_IF_CACHED = 'only-if-cached',
}

export enum FetchRedirect {
    FOLLOW = 'follow',
    ERROR = 'error',
    MANUAL = 'manual',
}

export enum CloseSocketCode {
    NORMAL = 1000,
    ABORTED = 1001,
    PROTOCOL_ERROR = 1002,
    INCONSISTENT_DATA_TYPE = 1003,
    RESERVED = 1004,
    NO_STATUS = 1005,
    CONNECTION_LOST = 1006,
    INCONSISTENT_MESSAGE_TYPE = 1007,
    VIOLATES_POLICY_MESSAGE = 1008,
    MESSAGE_IS_TOO_BIG = 1009,
    NEGOTIATION_FAILED = 1010,
    UNEXPECTED_CONDITIONS = 1011,
    SECURITY_ERROR = 1015,
}

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

export type AllowedCloseSocketCode =
    (typeof ALLOWED_CLOSE_SOCKET_CODES)[number];

export enum PayloadDataType {
    TEXT = 'Text',
    JSON = 'JSON',
    BLOB = 'Blob',
    FORM_DATA = 'FormData',
    ARRAY_BUFFER = 'ArrayBuffer',
}
