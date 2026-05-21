import {PayloadDataType, Protocol, TransportType} from '@/types';

/**
 * Checks whether the selected transport is compatible with the URL protocol.
 *
 * Compatibility rules:
 * - HTTP / HTTPS can only be used with Fetch transport
 * - WS / WSS can only be used with WebSocket transport
 *
 * If either transport or protocol is missing, the combination is considered valid.
 * This allows BridgeWire to infer the missing part later.
 */
const isTransportAndProtocolCompatible = (
    transport?: TransportType,
    protocol?: Protocol
): boolean => {
    if (!transport || !protocol) {
        return true;
    }

    switch (protocol) {
        case Protocol.HTTP:
        case Protocol.HTTPS:
            return transport === TransportType.FETCH;
        case Protocol.WS:
        case Protocol.WSS:
            return transport === TransportType.WEBSOCKET;
    }
};

/**
 * Throws an error when the selected transport is incompatible with the URL protocol.
 *
 * @throws Error when transport and protocol do not match.
 */
export const transportAndProtocolAssert = (
    transport?: TransportType,
    protocol?: Protocol
): void => {
    if (!isTransportAndProtocolCompatible(transport, protocol)) {
        throw new Error(
            `Incompatible combination of transport "${transport}" and protocol "${protocol}".`
        );
    }
};

/**
 * Throws an error when the selected transport is incompatible with the payload data type.
 *
 * Compatibility rules:
 * - FormData is not supported by WebSocket transport
 *
 * If either transport or data type is missing, the combination is considered valid.
 * This allows BridgeWire to infer or configure the missing part later.
 *
 * @throws Error when transport and payload data type do not match.
 */
export const transportAndDataTypeAssert = (
    transport?: TransportType,
    dataType?: PayloadDataType
): void => {
    if (
        transport === TransportType.WEBSOCKET &&
        dataType === PayloadDataType.FORM_DATA
    ) {
        throw new Error(
            `Incompatible combination of transport "${transport}" and data type "${dataType}".`
        );
    }
};

/**
 * Throws an error when the selected protocol is incompatible with the payload data type.
 *
 * Compatibility rules:
 * - FormData is not supported by WS / WSS protocols
 *
 * If either protocol or data type is missing, the combination is considered
 * valid. This allows BridgeWire to infer or configure the missing part later.
 *
 * @param protocol - Selected URL protocol.
 * @param dataType - Selected payload data type.
 *
 * @throws Error when protocol and payload data type do not match.
 */
export const protocolAndDataTypeAssert = (
    protocol?: Protocol,
    dataType?: PayloadDataType
): void => {
    if (!protocol || !dataType) {
        return;
    }

    if (
        [Protocol.WS, Protocol.WSS].includes(protocol) &&
        dataType === PayloadDataType.FORM_DATA
    ) {
        throw new Error(
            `Incompatible combination of protocol "${protocol}" and data type "${dataType}".`
        );
    }
};
