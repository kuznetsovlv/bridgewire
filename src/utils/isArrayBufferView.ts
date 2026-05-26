/**
 * Checks whether a value is an ArrayBuffer view backed by a regular ArrayBuffer.
 *
 * SharedArrayBuffer-backed views are intentionally excluded. BridgeWire accepts
 * only views backed by regular ArrayBuffer as binary request payloads.
 *
 * @param value - Value to check.
 * @returns Whether the value is an ArrayBuffer view backed by ArrayBuffer.
 */
export default function isArrayBufferView(
    value: unknown
): value is ArrayBufferView<ArrayBuffer> {
    return ArrayBuffer.isView(value) && value.buffer instanceof ArrayBuffer;
}
