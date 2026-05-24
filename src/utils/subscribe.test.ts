import {describe, expect, it, vi} from 'vitest';

import subscribe from './subscribe';

describe('subscribe', () => {
    it('adds callback to set', () => {
        const set = new Set<() => void>();
        const callback: () => void = vi.fn();

        subscribe(callback, set);

        expect(set.has(callback)).toBe(true);
    });

    it('returns unsubscribe method that removes callback from set', () => {
        const set = new Set<() => void>();
        const callback: () => void = vi.fn();

        const unsubscribe = subscribe(callback, set);

        unsubscribe();

        expect(set.has(callback)).toBe(false);
    });

    it('allows calling unsubscribe multiple times safely', () => {
        const set = new Set<() => void>();
        const callback: () => void = vi.fn();

        const unsubscribe = subscribe(callback, set);

        unsubscribe();
        unsubscribe();

        expect(set.has(callback)).toBe(false);
    });
});
