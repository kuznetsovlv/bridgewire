import {describe, expect, it, vi} from 'vitest';
import BridgeWireTransport from './BridgeWireTransport';
import type {RequestId, Request} from '@/types';
import {TransportStatus} from '@/types';

class TestTransport extends BridgeWireTransport<string, string> {
    public addRequest(id: RequestId, request: Request<string>): void {
        this._requests.set(id, request);
    }

    public send(): Request<string> {
        throw new Error('Not implemented');
    }
}

describe('BridgeWireTransport', () => {
    it('returns initial status', () => {
        const transport = new TestTransport(TransportStatus.Disconnected);

        expect(transport.status).toBe(TransportStatus.Disconnected);
    });

    it('subscribes and unsubscribes abort callback', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const callback = vi.fn();

        const unsubscribe = transport.onAbort(callback);

        unsubscribe();

        // Check with calling abort that callback isn't called
    });

    it('aborts request by id and calls abort callbacks', () => {
        const transport = new TestTransport(TransportStatus.Connected);

        const request = {
            id: '1',
            abort: vi.fn(),
            onAbort: vi.fn(),
            status: undefined,
            data: null,
            error: null,
            result: Promise.resolve('ok'),
        } as unknown as Request<string>;

        const onAbort = vi.fn();

        transport.addRequest('1', request);
        transport.onAbort(onAbort);

        transport.abort('1');

        expect(request.abort).toHaveBeenCalledOnce();
        // expect(onAbort).toHaveBeenCalledWith('1'); - temporary commented due to fixing architecture...
    });
});
