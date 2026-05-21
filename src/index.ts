import BridgeWireBuilder from './BridgeWireBuilder';

export default function getBridgeWireBuilder<
    RequestData,
    ResponseData,
>(): BridgeWireBuilder<RequestData, ResponseData> {
    return new BridgeWireBuilder();
}
