import {describe, expect, it} from 'vitest';

import isArrayBufferView from './isArrayBufferView';

describe('isArrayBufferView', () => {
    it('returns true for Uint8Array backed by ArrayBuffer', () => {
        const value = new Uint8Array([1, 2, 3]);

        expect(isArrayBufferView(value)).toBe(true);
    });

    it('returns true for Int32Array backed by ArrayBuffer', () => {
        const value = new Int32Array([1, 2, 3]);

        expect(isArrayBufferView(value)).toBe(true);
    });

    it('returns true for DataView backed by ArrayBuffer', () => {
        const value = new DataView(new ArrayBuffer(8));

        expect(isArrayBufferView(value)).toBe(true);
    });

    it('returns false for ArrayBuffer itself', () => {
        const value = new ArrayBuffer(8);

        expect(isArrayBufferView(value)).toBe(false);
    });

    it('returns false for Blob', () => {
        const value = new Blob(['test']);

        expect(isArrayBufferView(value)).toBe(false);
    });

    it('returns false for string', () => {
        expect(isArrayBufferView('test')).toBe(false);
    });

    it('returns false for plain object', () => {
        expect(isArrayBufferView({byteLength: 8})).toBe(false);
    });

    it('returns false for null', () => {
        expect(isArrayBufferView(null)).toBe(false);
    });

    it('returns false for undefined', () => {
        expect(isArrayBufferView(undefined)).toBe(false);
    });

    it('returns false for SharedArrayBuffer-backed view when SharedArrayBuffer is available', () => {
        if (typeof SharedArrayBuffer === 'undefined') {
            expect(true).toBe(true);
            return;
        }

        const value = new Uint8Array(new SharedArrayBuffer(8));

        expect(isArrayBufferView(value)).toBe(false);
    });
});
