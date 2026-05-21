import {HTTPMethod, Protocol, Query, TransportType} from './types';
import {transportAndProtocolAssert} from './utils';
import {parseUrl} from '@/utils';
// import BridgeWireTransport from '@/BridgeWireTransport/BridgeWireTransport';

/**
 * Fluent configuration builder for BridgeWire clients.
 *
 * The builder stores transport, URL and request defaults step by step and is
 * intended to produce a configured BridgeWire client when `build()` is added.
 *
 * Current responsibilities:
 * - collect transport configuration
 * - collect URL parts: protocol, host, port, path, query and hash
 * - validate transport/protocol compatibility
 * - collect HTTP-specific defaults: method, headers and timeout
 *
 * @example
 * const builder = new BridgeWireBuilder()
 *   .withUrl('https://api.example.com/users?page=1')
 *   .withMethod(HTTPMethod.GET)
 *   .withHeader('Accept', 'application/json');
 */
export default class BridgeWireBuilder<RequestData, ResponseData> {
    #transport?: TransportType;
    #protocol?: Protocol;
    // #host?: string;
    // #port?: number;
    // #path?: string;
    // #query?: Query;
    // #hash?: string;
    // #method?: HTTPMethod;
    #headers?: HeadersInit;
    // #timeOut?: number;

    /**
     * Sets the transport implementation type.
     *
     * Throws if the selected transport is incompatible with an already selected
     * protocol. For example, Fetch cannot be used with `ws` / `wss`.
     *
     * @throws Error when transport and protocol are incompatible.
     */
    public withTransport(
        transport: TransportType
    ): BridgeWireBuilder<RequestData, ResponseData> {
        transportAndProtocolAssert(transport, this.#protocol);
        this.#transport = transport;
        return this;
    }

    /**
     * Sets the URL protocol.
     *
     * Throws if the selected protocol is incompatible with an already selected
     * transport. For example, `ws` / `wss` cannot be used with Fetch.
     *
     * @throws Error when transport and protocol are incompatible.
     */
    public withProtocol(
        protocol: Protocol
    ): BridgeWireBuilder<RequestData, ResponseData> {
        transportAndProtocolAssert(this.#transport, protocol);
        this.#protocol = protocol;
        return this;
    }

    /**
     * Sets the request host.
     *
     * The host may include a port if it was parsed from a URL,
     * for example `example.com:3000`.
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
     * Expected to be normalized with a leading slash, for example `/api/users`.
     */
    public withPath(
        path: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#path = path;
        return this;
    }

    /**
     * Sets the request port.
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
     * Expected format follows the URL API output, for example `#section`.
     */
    public withHash(
        hash: string
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#hash = hash;
        return this;
    }

    /**
     * Sets query parameters.
     *
     * Replaces the current query object.
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
     * Supports absolute URLs, protocol-relative URLs, host-only URLs,
     * absolute paths and relative paths.
     *
     * Existing builder values are overwritten only by URL parts that are present
     * in the parsed input.
     *
     * @throws Error when parsed protocol is incompatible with selected transport.
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
     * Later values overwrite earlier values with the same header name.
     */
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
     * Sets the default request timeout in milliseconds.
     */
    public withTimeOut(
        timeOut: number
    ): BridgeWireBuilder<RequestData, ResponseData> {
        this.#timeOut = timeOut;
        return this;
    }

    // public build(): BridgeWireTransport<RequestData, ResponseData> {}
}
