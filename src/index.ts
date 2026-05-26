import BridgeWireBuilder from './BridgeWireBuilder';

/**
 * Creates a new BridgeWire builder instance.
 *
 * This helper is the main entry point for configuring BridgeWire transports.
 * The returned builder can be used to configure request defaults, choose or
 * infer a transport type, build request URLs, and create a concrete BridgeWire
 * transport instance.
 *
 * @template RequestData - Data type accepted by the transport created by the builder.
 * @template ResponseData - Data type emitted by requests created by that transport.
 *
 * @returns New BridgeWire builder instance.
 */
export default function getBridgeWireBuilder<
    RequestData,
    ResponseData,
>(): BridgeWireBuilder<RequestData, ResponseData> {
    return new BridgeWireBuilder();
}

export type {
    BridgeWireTransportAbortCallback,
    BridgeWireTransportCallback,
    BridgeWireTransportSettledCallback,
    ErrorCallback,
    Query,
    RequestId,
    RequestOptions,
    UnsubscribeMethod,
} from './types';
export {
    FetchCache,
    FetchCredentials,
    FetchMode,
    FetchRedirect,
    HTTPMethod,
    PayloadDataType,
    Protocol,
    RequestStatus,
    TransportStatus,
    TransportType,
} from './types';
