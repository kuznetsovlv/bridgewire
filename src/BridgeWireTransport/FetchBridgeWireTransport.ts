import type {FetchResponseParser} from '@/Request';
import type {Request} from '@/Request';
import {FetchRequest} from '@/Request';
import type {
    BaseFetchRequestData,
    Nullable,
    Query,
    RequestOptions,
    URLData,
} from '@/types';
import {HTTPMethod, PayloadDataType, TransportStatus} from '@/types';
import {constructUrl} from '@/utils';

import BridgeWireTransport from './BridgeWireTransport';

/**
 * Fetch transport configuration.
 *
 * Contains normalized URL data, the HTTP method used by this transport, optional
 * Fetch request defaults, and an optional payload data type used to select a
 * response parser.
 */
interface TransportData extends Partial<BaseFetchRequestData> {
    /**
     * HTTP method used by requests created by this transport.
     */
    method: HTTPMethod;

    /**
     * URL parts used to construct request URLs.
     */
    urlData: URLData;

    /**
     * Expected response payload data type.
     *
     * When omitted, FetchRequest uses its default content-type based parser.
     */
    dataType?: PayloadDataType;
}

/**
 * Fetch-compatible request body type.
 */
type FetchBody = BaseFetchRequestData['body'];

/**
 * Checks whether a value is an ArrayBuffer view backed by a regular ArrayBuffer.
 *
 * SharedArrayBuffer-backed views are intentionally excluded because they are not
 * accepted as Fetch BodyInit in all environments.
 *
 * @param value - Value to check.
 * @returns Whether the value is an ArrayBuffer view backed by ArrayBuffer.
 */
const isArrayBufferView = (
    value: unknown
): value is ArrayBufferView<ArrayBuffer> => {
    return ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer;
};

/**
 * Checks whether a value can be passed directly as a Fetch request body.
 *
 * @param value - Value to check.
 * @returns Whether the value is a supported Fetch body value.
 */
const isFetchBody = (value: unknown): value is FetchBody => {
    return (
        typeof value === 'string' ||
        value instanceof FormData ||
        value instanceof Blob ||
        value instanceof ArrayBuffer ||
        isArrayBufferView(value) ||
        value instanceof URLSearchParams
    );
};

/**
 * Returns the raw Fetch Response as request data.
 *
 * Useful for methods such as HEAD where response metadata is useful but a
 * response body is not expected.
 *
 * @param response - Fetch response.
 * @returns Raw response cast to the expected data type.
 */
const rawResponseParser = async <Data>(response: Response): Promise<Data> => {
    return response as Data;
};

/**
 * Fetch-based BridgeWire transport.
 *
 * Creates FetchRequest instances, builds URLs from configured URL data, maps
 * request data either to query parameters or request body depending on the HTTP
 * method, selects a response parser from the configured payload data type, and
 * registers created requests in the base transport.
 *
 * Query-oriented methods merge plain object request data into the configured
 * query. Body-oriented methods serialize request data into a Fetch-compatible
 * body.
 *
 * @template RequestData - Data accepted by `send`.
 * @template ResponseData - Data emitted by created requests.
 */
export default class FetchBridgeWireTransport<
    RequestData,
    ResponseData,
> extends BridgeWireTransport<RequestData, ResponseData> {
    #method: HTTPMethod;
    #urlData: URLData;
    #requestData: Partial<BaseFetchRequestData>;
    #dataType?: PayloadDataType;

    constructor({urlData, method, dataType, ...requestData}: TransportData) {
        super(TransportStatus.Connected);

        this.#method = method;
        this.#urlData = urlData;
        this.#dataType = dataType;
        this.#requestData = requestData;
    }

    /**
     * Creates a FetchRequest for the provided request data.
     *
     * Query-oriented methods build a URL with merged query parameters. Body-oriented
     * methods build a URL from configured URL data and convert request data into a
     * Fetch body.
     *
     * @param data - Request data passed to `send`.
     * @param options - Per-request options.
     * @returns Created FetchRequest, or `null` if no request can be created.
     */
    #createRequest(
        data: RequestData,
        options: RequestOptions = {}
    ): Nullable<FetchRequest<ResponseData>> {
        const {timeout = this.#requestData.timeout} = options;
        const parser = this.#getParser();

        switch (this.#method) {
            case HTTPMethod.GET:
            case HTTPMethod.HEAD:
            case HTTPMethod.OPTIONS:
            case HTTPMethod.DELETE: {
                const query =
                    data && !Array.isArray(data) && !isFetchBody(data)
                        ? {...this.#urlData.query, ...(data as Query)}
                        : this.#urlData.query;
                const url = constructUrl({...this.#urlData, query});
                return new FetchRequest(crypto.randomUUID(), {
                    ...this.#requestData,
                    url,
                    method: this.#method,
                    timeout,
                    responseParser: parser,
                });
            }
            case HTTPMethod.POST:
            case HTTPMethod.PUT:
            case HTTPMethod.PATCH:
                return new FetchRequest(crypto.randomUUID(), {
                    ...this.#requestData,
                    url: constructUrl(this.#urlData),
                    method: this.#method,
                    body: this.#getBody(data),
                    timeout,
                    responseParser: parser,
                });
            default:
                this._emitError(
                    new Error(`Unsupported HTTP method: ${this.#method}`)
                );
                return null;
        }
    }

    /**
     * Converts request data into a Fetch-compatible request body.
     *
     * Native Fetch body values are passed through. Plain objects are serialized to
     * JSON. Empty or unsupported values are converted to an empty string.
     *
     * @param data - Request data.
     * @returns Fetch-compatible request body.
     */
    #getBody(data: RequestData): FetchBody {
        if (isFetchBody(data)) {
            return data;
        }

        if (data && typeof data === 'object') {
            // TODO: Consider setting Content-Type: application/json automatically when
            // serializing plain objects to JSON, unless the user already provided it.
            return JSON.stringify(data);
        }

        return '';
    }

    /**
     * Selects a response parser for requests created by this transport.
     *
     * HEAD and OPTIONS currently return the raw Response. Configured payload data
     * types map to the corresponding Fetch Response parsing method. When no data
     * type is configured, returns `undefined` so FetchRequest can use its default
     * parser.
     *
     * @returns Response parser or `undefined` for FetchRequest default parser.
     */
    #getParser(): FetchResponseParser<ResponseData> | undefined {
        switch (this.#method) {
            case HTTPMethod.HEAD:
            case HTTPMethod.OPTIONS:
                return rawResponseParser<ResponseData>;
            default:
                switch (this.#dataType) {
                    case PayloadDataType.TEXT:
                        return (response) =>
                            response.text() as Promise<ResponseData>;
                    case PayloadDataType.JSON:
                        return (response) =>
                            response.json() as Promise<ResponseData>;
                    case PayloadDataType.FORM_DATA:
                        return (response) =>
                            response.formData() as Promise<ResponseData>;
                    case PayloadDataType.ARRAY_BUFFER:
                        return (response) =>
                            response.arrayBuffer() as Promise<ResponseData>;
                    case PayloadDataType.BLOB:
                        return (response) =>
                            response.blob() as Promise<ResponseData>;
                }
        }
    }

    /**
     * Sends request data through Fetch.
     *
     * Creates and registers a FetchRequest. Returns `null` if the configured method
     * is unsupported and the request cannot be created.
     *
     * @param data - Request data.
     * @param options - Optional per-request options.
     * @returns Created request, or `null` when sending is not possible.
     */
    public send(
        data: RequestData,
        options?: RequestOptions
    ): Nullable<Request<ResponseData>> {
        const request = this.#createRequest(data, options);
        if (request) {
            this._registerRequest(request);
        }

        return request;
    }
}
