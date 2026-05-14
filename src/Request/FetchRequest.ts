import Request from './Request';
import type {RequestId} from '@/types';
import {
    RequestStatus,
    HTTPMethod,
    FetchMode,
    FetchCredentials,
    FetchCache,
    FetchRedirect,
} from '@/types';

export interface FetchData {
    url: URL;
    method?: HTTPMethod;
    headers?: HeadersInit;
    body?: string | FormData | Blob | BufferSource | URLSearchParams;
    referrer?: string;
    referrerPolicy?: ReferrerPolicy;
    mode?: FetchMode;
    credentials?: FetchCredentials;
    cache?: FetchCache;
    redirect?: FetchRedirect;
    integrity?: string;
    keepalive?: boolean;
}

export default class FetchRequest<Data> extends Request<Data> {
    readonly #controller: AbortController;

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
        }: FetchData
    ) {
        super(id, RequestStatus.Pending);

        this.#controller = new AbortController();

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
            (result) => {
                if (result.ok) {
                    //TODO: Get data from result
                } else {
                    const {status, statusText} = result;
                    this._processError(
                        new Error(`Error ${status}: ${statusText}`)
                    );
                }
            },
            (error) => {
                this._processError(
                    error instanceof Error ? error : new Error(String(error))
                );
            }
        );
    }

    abort(): void {
        this.#controller.abort();
        this._processAbort();
    }
}
