import {Protocol, TransportType} from '../types';

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
const transportAndProtocolCompatibility = (
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
    if (!transportAndProtocolCompatibility(transport, protocol)) {
        throw new Error(
            `Incompatible combination of transport "${transport}" and protocol "${protocol}".`
        );
    }
};
