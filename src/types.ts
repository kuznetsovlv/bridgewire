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
        timeOut: number;
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
