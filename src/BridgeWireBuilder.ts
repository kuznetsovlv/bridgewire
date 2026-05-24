import {
    HTTPMethod,
    PayloadDataType,
    Protocol,
    Query,
    TransportType,
    URLData,
    FetchMode,
    FetchCredentials,
    FetchCache,
    FetchRedirect,
} from './types';
import {
    getDefaultHost,
    getDefaultPort,
    getDefaultProtocol,
    protocolAndDataTypeAssert,
    transportAndDataTypeAssert,
    transportAndProtocolAssert,
} from './utils';
import {parseUrl} from '@/utils';
import {
    BridgeWireTransport,
    FetchBridgeWireTransport,
} from '@/BridgeWireTransport';

/**
 * Fluent configuration builder for BridgeWire transports.
 *
 * The builder stores transport, URL, payload, Fetch and request defaults step by
 * step. Each `with*` method mutates the builder state and returns the same
 * builder instance, allowing chained configuration.
 *
 * Current responsibilities:
 * - collect transport configuration
 * - collect URL parts: protocol, host, port, path, query and hash
 * - validate transport/protocol/payload data type compatibility
 * - collect Fetch-specific defaults: method, headers, referrer, mode,
 *   credentials, cache, redirect, integrity and keepalive
 * - collect request defaults such as timeout
 * - build a Fetch-based BridgeWire transport
 *
 * WebSocket transport build support is not implemented yet.
 *
 * @template RequestData - Data type accepted by the created transport.
 * @template ResponseData - Data type emitted by requests created by the transport.
 *
 * @example
 * const transport = getBridgeWireBuilder<RequestPayload, ResponsePayload>()
 *     .withUrl('https://api.example.com/users?page=1')
 *     .withMethod(HTTPMethod.GET)
 *     .withHeader('Accept', 'application/json')
 *     .build();
 */
export default class BridgeWireBuilder<RequestData, ResponseData> {
    #transport?: TransportType;
    #protocol?: Protocol;
    #host?: string;
    #port?: number;
    #path?: string;
    #query?: Query;
    #hash?: string;
    #method?: HTTPMethod;
    #headers?: HeadersInit;
    #timeout?: number;
    #dataType?: PayloadDataType;
    #referrer?: string;
    #referrerPolicy?: ReferrerPolicy;
    #mode?: FetchMode;
    #credentials?: FetchCredentials;
    #cache?: FetchCache;
    #redirect?: FetchRedirect;
    #integrity?: string;
    #keepalive: boolean;

    constructor() {
        this.#keepalive = false;
    }

    /**
     * Builds normalized URL data from explicit builder state and runtime defaults.
     *
     * Missing protocol, host, port and query values are filled with defaults.
     *
     * @returns Normalized URL data.
     */
    #getURLData(): URLData {
        const protocol = this.#protocol ?? getDefaultProtocol(this.#transport);

        return {
            protocol,
            port: this.#port ?? getDefaultPort(protocol),
            host: this.#host ?? getDefaultHost(),
            path: this.#path ?? '',
            hash: this.#hash,
            query: this.#query ?? {},
        };
    }

    /**
     * Returns the selected transport type or infers it from the default protocol.
     *
     * HTTP / HTTPS defaults to Fetch transport. WS / WSS defaults to WebSocket
     * transport.
     *
     * @returns Selected or inferred transport type.
     */
    #getTransportType(): TransportType {
        if (this.#transport) {
            return this.#transport;
        }

        switch ((this.#protocol = getDefaultProtocol())) {
            case Protocol.HTTP:
            case Protocol.HTTPS:
                return TransportType.FETCH;
            case Protocol.WS:
            case Protocol.WSS:
                return TransportType.WEBSOCKET;
        }
    }

    /**
     * Returns the configured HTTP method or the default GET method.
     *
     * @returns HTTP method.
     */
    #getMethod(): HTTPMethod {
        return this.#method ?? HTTPMethod.GET;
    }

    /**
     * Returns the configured request timeout.
     *
     * Non-positive timeout values are normalized to `Infinity`, which disables
     * timeout handling.
     *
     * @returns Request timeout in milliseconds, or `Infinity`.
     */
    #getTimeout(): number {
        const timeout = this.#timeout ?? Infinity;
        return timeout > 0 ? timeout : Infinity;
    }

    /**
     * Sets the transport implementation type.
     *
     * Throws if the selected transport is incompatible with already configured
     * protocol or payload data type.
     *
     * @param transport - Transport type to use.
     * @returns Current builder instance.
     *
     * @throws Error when transport and protocol are incompatible.
     * @throws Error when transport and payload data type are incompatible.
     */
    public withTransport(
        transport: TransportType
    ): BridgeWireBuilder<RequestData, ResponseData> {
        transportAndProtocolAssert(transport, this.#protocol);
        transportAndDataTypeAssert(transport, this.#dataType);
        this.#transport = transport;
        return this;
    }

    /**
     * Sets the URL protocol.
     *
     * Throws if the selected protocol is incompatible with already configured
     * transport or payload data type.
     *
     * @param protocol - URL protocol to use.
     * @returns Current builder instance.
     *
     * @throws Error when transport and protocol are incompatible.
     * @throws Error when protocol and payload data type are incompatible.
     */
    public withProtocol(
        protocol: Protocol
    ): BridgeWireBuilder<RequestData, ResponseData> {
        transportAndProtocolAssert(this.#transport, protocol);
        protocolAndDataTypeAssert(protocol, this.#dataType);
        this.#protocol = protocol;
        return this;
    }

    /**
     * Sets the expected payload data type.
     *
     * The data type is used by concrete transports to choose or configure payload
     * parsing. Throws if the selected data type is incompatible with already
     * configured transport or protocol.
     *
     * @param dataType - Expected payload data type.
     * @returns Current builder instance.
     *
     * @throws Error when transport and payload data type are incompatible.
     * @throws Error when protocol and payload data type are incompatible.
     */
    public withDataType(
        dataType: PayloadDataType
    ): BridgeWireBuilder<RequestData, ResponseData> {
        transportAndDataTypeAssert(this.#transport, dataType);
        protocolAndDataTypeAssert(this.#protocol, dataType);
        this.#dataType = dataType;
        return this;
    }

    /**
     * Sets the request host.
     *
     * The host may include a port when it comes from parsed URL input,
     * for example `example.com:3000`.
     *
     * @param host - Request host.
     * @returns Current builder instance.
     */
    public withHost(
        host: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#host = host;
        return this;
    }

    /**
     * Sets the request path.
     *
     * Prefer normalized paths with a leading slash, for example `/api/users`.
     *
     * @param path - Request path.
     * @returns Current builder instance.
     */
    public withPath(
        path: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#path = path;
        return this;
    }

    /**
     * Sets the request port.
     *
     * @param port - Request port.
     * @returns Current builder instance.
     */
    public withPort(
        port: number
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#port = port;
        return this;
    }

    /**
     * Sets the URL hash fragment.
     *
     * The hash can be passed with or without the leading `#`. It is stored with the
     * leading `#`.
     *
     * @param hash - URL hash fragment.
     * @returns Current builder instance.
     */
    public withHash(
        hash: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#hash = hash.startsWith('#') ? hash : `#${hash}`;
        return this;
    }

    /**
     * Sets query parameters.
     *
     * Replaces the current query object. Array values are serialized later as
     * repeated query parameters.
     *
     * @param query - Query parameters.
     * @returns Current builder instance.
     */
    public withQuery(
        query: Query
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#query = query;
        return this;
    }

    /**
     * Parses a URL-like string and applies its parts to the builder.
     *
     * Supports absolute URLs, protocol-relative URLs, host-only URLs, absolute
     * paths and relative paths.
     *
     * Existing builder values are overwritten only by URL parts that are present in
     * the parsed input.
     *
     * @param url - URL-like string to parse.
     * @returns Current builder instance.
     *
     * @throws Error when parsed protocol is incompatible with selected transport.
     * @throws Error when parsed protocol is incompatible with selected payload data type.
     */
    public withUrl(url: string): BridgeWireBuilder<RequestData, ResponseData> {
        const {port, protocol, path, hash, host, query} = parseUrl(url);

        if (protocol) {
            this.withProtocol(protocol);
        }

        if (host) {
            this.withHost(host);
        }

        if (port) {
            this.withPort(port);
        }

        if (hash) {
            this.withHash(hash);
        }

        if (Object.keys(query).length) {
            this.withQuery(query);
        }

        return this.withPath(path);
    }

    /**
     * Sets the default HTTP method for Fetch-based requests.
     *
     * @param method - HTTP method to use by default.
     * @returns Current builder instance.
     */
    public withMethod(
        method: HTTPMethod
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#method = method;
        return this;
    }

    /**
     * Merges the provided headers into the current default headers.
     *
     * Later values overwrite earlier values with the same header name when headers
     * are represented as plain objects.
     *
     * @param headers - Headers to merge into current defaults.
     * @returns Current builder instance.
     */
    // TODO: Normalize headers through the Headers API to support all HeadersInit forms:
    // Headers instance, tuple array, and plain object. Current implementation works
    // reliably only for plain object headers.
    public withHeaders(
        headers: HeadersInit
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#headers = this.#headers
            ? {...this.#headers, ...headers}
            : {...headers};
        return this;
    }

    /**
     * Adds or overwrites a single default header.
     *
     * @param headerName - Header name.
     * @param headerValue - Header value.
     * @returns Current builder instance.
     */
    public withHeader(
        headerName: string,
        headerValue: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#headers = this.#headers
            ? {...this.#headers, [headerName]: headerValue}
            : {[headerName]: headerValue};

        return this;
    }

    /**
     * Sets the default request timeout.
     *
     * Non-positive values are accepted at configuration time and normalized to
     * `Infinity` during build.
     *
     * @param timeout - Timeout in milliseconds.
     * @returns Current builder instance.
     */
    public withTimeout(
        timeout: number
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#timeout = timeout;
        return this;
    }

    /**
     * Sets the Fetch referrer.
     *
     * Maps to the `referrer` option of `fetch`.
     *
     * @param referrer - Referrer value to use for Fetch requests.
     * @returns Current builder instance.
     */
    public withReferrer(
        referrer: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#referrer = referrer;
        return this;
    }

    /**
     * Sets the Fetch referrer policy.
     *
     * Maps to the `referrerPolicy` option of `fetch`.
     *
     * @param referrerPolicy - Referrer policy to use for Fetch requests.
     * @returns Current builder instance.
     */
    public withReferrerPolicy(
        referrerPolicy: ReferrerPolicy
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#referrerPolicy = referrerPolicy;
        return this;
    }

    /**
     * Sets the Fetch request mode.
     *
     * Maps to the `mode` option of `fetch`.
     *
     * @param mode - Fetch mode to use.
     * @returns Current builder instance.
     */
    public withMode(
        mode: FetchMode
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#mode = mode;
        return this;
    }

    /**
     * Sets the Fetch credentials mode.
     *
     * Maps to the `credentials` option of `fetch`.
     *
     * @param credentials - Fetch credentials mode to use.
     * @returns Current builder instance.
     */
    public withCredentials(
        credentials: FetchCredentials
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#credentials = credentials;
        return this;
    }

    /**
     * Sets the Fetch cache mode.
     *
     * Maps to the `cache` option of `fetch`.
     *
     * @param cache - Fetch cache mode to use.
     * @returns Current builder instance.
     */
    public withCache(
        cache: FetchCache
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#cache = cache;
        return this;
    }

    /**
     * Sets the Fetch redirect mode.
     *
     * Maps to the `redirect` option of `fetch`.
     *
     * @param redirect - Fetch redirect mode to use.
     * @returns Current builder instance.
     */
    public withRedirect(
        redirect: FetchRedirect
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#redirect = redirect;
        return this;
    }

    /**
     * Sets the Fetch subresource integrity value.
     *
     * Maps to the `integrity` option of `fetch`.
     *
     * @param integrity - Subresource integrity metadata.
     * @returns Current builder instance.
     */
    public withIntegrity(
        integrity: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#integrity = integrity;
        return this;
    }

    /**
     * Enables or disables Fetch keepalive mode.
     *
     * Maps to the `keepalive` option of `fetch`. Calling this method without
     * arguments enables keepalive.
     *
     * @param keepAlive - Whether Fetch requests may outlive the page.
     * @returns Current builder instance.
     */
    public withKeepAlive(
        keepAlive: boolean = true
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#keepalive = keepAlive;
        return this;
    }

    /**
     * Builds a configured BridgeWire transport instance.
     *
     * Currently supports Fetch transport builds. WebSocket transport build support
     * is not implemented yet.
     *
     * During build, the builder resolves URL defaults, infers or uses the selected
     * transport type, normalizes timeout, applies request defaults, and creates a
     * concrete transport implementation.
     *
     * @returns Configured BridgeWire transport instance.
     *
     * @throws Error when the selected or inferred transport is not supported yet.
     */
    public build(): BridgeWireTransport<RequestData, ResponseData> {
        const urlData = this.#getURLData();
        const transport = this.#getTransportType();
        const timeout = this.#getTimeout();

        if (transport === TransportType.FETCH) {
            const method = this.#getMethod();

            return new FetchBridgeWireTransport<RequestData, ResponseData>({
                urlData,
                method,
                timeout,
                headers: this.#headers ?? {},
                referrer: this.#referrer,
                referrerPolicy: this.#referrerPolicy,
                mode: this.#mode,
                credentials: this.#credentials,
                cache: this.#cache,
                redirect: this.#redirect,
                integrity: this.#integrity,
                keepalive: this.#keepalive,
                dataType: this.#dataType,
            });
        }

        throw new Error(`Unsupported transport "${transport}".`);
    }
}
