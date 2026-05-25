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

// TODO: Review public exports before release.
// Export only the stable public API: builder factory, transport/request types
// needed by users, public enums and callback types. Keep internal helper types,
// normalized config shapes and implementation details private.
