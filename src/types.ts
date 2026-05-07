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
