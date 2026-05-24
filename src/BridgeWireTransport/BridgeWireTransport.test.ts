import {describe, expect, it, vi} from 'vitest';
import BridgeWireTransport from './BridgeWireTransport';
import type {Nullable, RequestId} from '@/types';
import {RequestStatus, TransportStatus} from '@/types';
import {Request} from '@/Request';

class TestRequest<Data> extends Request<Data> {
    public constructor(id: RequestId, status = RequestStatus.Pending) {
        super(id, status);
    }

    public processData(data: Data, status = RequestStatus.Pending): void {
        this._processData(data, status);
    }

    public fail(error: Error): void {
        this._processError(error);
    }

    public complete(): void {
        this._processComplete();
    }

    public timeout(timeout: number): void {
        this._processTimeout(timeout);
    }

    public abort(): void {
        this._processAbort();
    }
}

class TestTransport extends BridgeWireTransport<string, string> {
    public constructor(status: TransportStatus) {
        super(status);
    }

    public registerRequest(request: Request<string>): void {
        this._registerRequest(request);
    }

    public emitError(error: Error): void {
        this._emitError(error);
    }

    public hasRequest(id: RequestId): boolean {
        return this._requests.has(id);
    }

    public get requestCount(): number {
        return this._requests.size;
    }

    public send(data: string): Nullable<Request<string>> {
        const request = new TestRequest<string>(data);

        this._registerRequest(request);

        return request;
    }
}

describe('BridgeWireTransport', () => {
    it('returns initial status', () => {
        const transport = new TestTransport(TransportStatus.Disconnected);

        expect(transport.status).toBe(TransportStatus.Disconnected);
    });

    it('registers request in active request collection', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');

        transport.registerRequest(request);

        expect(transport.hasRequest('request-1')).toBe(true);
        expect(transport.requestCount).toBe(1);
    });

    it('registers request created by send', () => {
        const transport = new TestTransport(TransportStatus.Connected);

        const request = transport.send('request-1');

        expect(request).toBeInstanceOf(TestRequest);
        expect(request?.id).toBe('request-1');
        expect(transport.hasRequest('request-1')).toBe(true);
    });

    it('forwards request message events with request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onMessage = vi.fn();

        transport.registerRequest(request);
        transport.onMessage(onMessage);

        request.processData('response-data');

        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith('request-1', 'response-data');
    });

    it('allows message subscribers to unsubscribe', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onMessage = vi.fn();

        transport.registerRequest(request);

        const unsubscribe = transport.onMessage(onMessage);

        unsubscribe();
        request.processData('response-data');

        expect(onMessage).not.toHaveBeenCalled();
    });

    it('forwards request error events with request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onRequestError = vi.fn();
        const error = new Error('Request failed');

        transport.registerRequest(request);
        transport.onRequestError(onRequestError);

        request.fail(error);

        expect(onRequestError).toHaveBeenCalledOnce();
        expect(onRequestError).toHaveBeenCalledWith('request-1', error);
    });

    it('allows request error subscribers to unsubscribe', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onRequestError = vi.fn();

        transport.registerRequest(request);

        const unsubscribe = transport.onRequestError(onRequestError);

        unsubscribe();
        request.fail(new Error('Request failed'));

        expect(onRequestError).not.toHaveBeenCalled();
    });

    it('forwards request abort events with request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onAbort = vi.fn();

        transport.registerRequest(request);
        transport.onAbort(onAbort);

        request.abort();

        expect(onAbort).toHaveBeenCalledOnce();
        expect(onAbort).toHaveBeenCalledWith('request-1');
    });

    it('allows abort subscribers to unsubscribe', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onAbort = vi.fn();

        transport.registerRequest(request);

        const unsubscribe = transport.onAbort(onAbort);

        unsubscribe();
        request.abort();

        expect(onAbort).not.toHaveBeenCalled();
    });

    it('forwards request settled events with request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onSettled = vi.fn();

        transport.registerRequest(request);
        transport.onSettled(onSettled);

        request.complete();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(
            'request-1',
            RequestStatus.Completed,
            null
        );
    });

    it('forwards failed settled event with latest error', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onSettled = vi.fn();
        const error = new Error('Request failed');

        transport.registerRequest(request);
        transport.onSettled(onSettled);

        request.fail(error);

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(
            'request-1',
            RequestStatus.Failed,
            error
        );
    });

    it('allows settled subscribers to unsubscribe', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onSettled = vi.fn();

        transport.registerRequest(request);

        const unsubscribe = transport.onSettled(onSettled);

        unsubscribe();
        request.complete();

        expect(onSettled).not.toHaveBeenCalled();
    });

    it('removes request from active collection when request is settled', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');

        transport.registerRequest(request);

        request.complete();

        expect(transport.hasRequest('request-1')).toBe(false);
        expect(transport.requestCount).toBe(0);
    });

    it('removes request from active collection when request is aborted', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');

        transport.registerRequest(request);

        request.abort();

        expect(transport.hasRequest('request-1')).toBe(false);
        expect(transport.requestCount).toBe(0);
    });

    it('aborts request by id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const abortSpy = vi.spyOn(request, 'abort');

        transport.registerRequest(request);

        transport.abort('request-1');

        expect(abortSpy).toHaveBeenCalledOnce();
        expect(request.status).toBe(RequestStatus.Aborted);
        expect(transport.hasRequest('request-1')).toBe(false);
    });

    it('aborts requests by ids', () => {
        const transport = new TestTransport(TransportStatus.Connected);

        const firstRequest = new TestRequest<string>('request-1');
        const secondRequest = new TestRequest<string>('request-2');
        const thirdRequest = new TestRequest<string>('request-3');

        const firstAbortSpy = vi.spyOn(firstRequest, 'abort');
        const secondAbortSpy = vi.spyOn(secondRequest, 'abort');
        const thirdAbortSpy = vi.spyOn(thirdRequest, 'abort');

        transport.registerRequest(firstRequest);
        transport.registerRequest(secondRequest);
        transport.registerRequest(thirdRequest);

        transport.abort(['request-1', 'request-3']);

        expect(firstAbortSpy).toHaveBeenCalledOnce();
        expect(secondAbortSpy).not.toHaveBeenCalled();
        expect(thirdAbortSpy).toHaveBeenCalledOnce();

        expect(transport.hasRequest('request-1')).toBe(false);
        expect(transport.hasRequest('request-2')).toBe(true);
        expect(transport.hasRequest('request-3')).toBe(false);
    });

    it('aborts all active requests when ids are omitted', () => {
        const transport = new TestTransport(TransportStatus.Connected);

        const firstRequest = new TestRequest<string>('request-1');
        const secondRequest = new TestRequest<string>('request-2');

        const firstAbortSpy = vi.spyOn(firstRequest, 'abort');
        const secondAbortSpy = vi.spyOn(secondRequest, 'abort');

        transport.registerRequest(firstRequest);
        transport.registerRequest(secondRequest);

        transport.abort();

        expect(firstAbortSpy).toHaveBeenCalledOnce();
        expect(secondAbortSpy).toHaveBeenCalledOnce();

        expect(transport.requestCount).toBe(0);
    });

    it('does nothing when aborting unknown request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const abortSpy = vi.spyOn(request, 'abort');

        transport.registerRequest(request);

        expect(() => transport.abort('unknown-request')).not.toThrow();

        expect(abortSpy).not.toHaveBeenCalled();
        expect(transport.hasRequest('request-1')).toBe(true);
    });

    it('does not call abort subscribers when aborting unknown request id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const onAbort = vi.fn();

        transport.onAbort(onAbort);

        transport.abort('unknown-request');

        expect(onAbort).not.toHaveBeenCalled();
    });

    it('does not call abort subscribers after unsubscribe when aborting by id', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const request = new TestRequest<string>('request-1');
        const onAbort = vi.fn();

        transport.registerRequest(request);

        const unsubscribe = transport.onAbort(onAbort);

        unsubscribe();
        transport.abort('request-1');

        expect(onAbort).not.toHaveBeenCalled();
    });

    it('emits transport-level error and marks transport as error', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const onError = vi.fn();
        const error = new Error('Transport failed');

        transport.onError(onError);

        transport.emitError(error);

        expect(transport.status).toBe(TransportStatus.Error);
        expect(onError).toHaveBeenCalledOnce();
        expect(onError).toHaveBeenCalledWith(error);
    });

    it('allows transport-level error subscribers to unsubscribe', () => {
        const transport = new TestTransport(TransportStatus.Connected);
        const onError = vi.fn();

        const unsubscribe = transport.onError(onError);

        unsubscribe();
        transport.emitError(new Error('Transport failed'));

        expect(transport.status).toBe(TransportStatus.Error);
        expect(onError).not.toHaveBeenCalled();
    });
});
