import {describe, expect, it, vi} from 'vitest';
import Request from './Request';
import type {RequestId} from '@/types';
import {RequestStatus} from '@/types';

class TestRequest<Data> extends Request<Data> {
    public constructor(id: RequestId, status = RequestStatus.Pending) {
        super(id, status);
    }

    public processData(data: Data, status = RequestStatus.Completed): void {
        this._processData(data, status);
    }

    public fail(error: Error): void {
        this._processError(error);
    }

    public abort(): void {
        this._processAbort();
    }
}

describe('Request', () => {
    it('stores request id and initial status', () => {
        const request = new TestRequest<string>('request-1');

        expect(request.id).toBe('request-1');
        expect(request.status).toBe(RequestStatus.Pending);
    });

    it('uses the provided initial status', () => {
        const request = new TestRequest<string>(
            'request-1',
            RequestStatus.Completed
        );

        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('has null data and error by default', () => {
        const request = new TestRequest<string>('request-1');

        expect(request.data).toBeNull();
        expect(request.error).toBeNull();
    });

    it('stores received data and updates request status', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('response-data', RequestStatus.Completed);

        expect(request.data).toBe('response-data');
        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.error).toBeNull();
    });

    it('uses Completed status by default when processing data', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('response-data');

        expect(request.data).toBe('response-data');
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('supports custom status when processing data', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('partial-data', RequestStatus.Pending);

        expect(request.data).toBe('partial-data');
        expect(request.status).toBe(RequestStatus.Pending);
    });

    it('emits message events when processing data', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onMessage(callback);
        request.processData('response-data', RequestStatus.Completed);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith('response-data');
    });

    it('notifies multiple message subscribers', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        request.onMessage(firstCallback);
        request.onMessage(secondCallback);

        request.processData('response-data', RequestStatus.Completed);

        expect(firstCallback).toHaveBeenCalledTimes(1);
        expect(firstCallback).toHaveBeenCalledWith('response-data');

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith('response-data');
    });

    it('allows message subscribers to unsubscribe', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        const unsubscribe = request.onMessage(callback);

        unsubscribe();
        request.processData('response-data', RequestStatus.Completed);

        expect(callback).not.toHaveBeenCalled();
    });

    it('keeps other message subscribers after one subscriber unsubscribes', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        const unsubscribeFirst = request.onMessage(firstCallback);
        request.onMessage(secondCallback);

        unsubscribeFirst();
        request.processData('response-data', RequestStatus.Completed);

        expect(firstCallback).not.toHaveBeenCalled();

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith('response-data');
    });

    it('stores the latest received data', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('first-data', RequestStatus.Pending);
        request.processData('second-data', RequestStatus.Completed);

        expect(request.data).toBe('second-data');
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('stores request error and marks request as failed', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Request failed');

        request.fail(error);

        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Failed);
    });

    it('does not clear previously received data when request fails', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Request failed');

        request.processData('response-data', RequestStatus.Pending);
        request.fail(error);

        expect(request.data).toBe('response-data');
        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Failed);
    });

    it('emits error events when processing error', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();
        const error = new Error('Request failed');

        request.onError(callback);
        request.fail(error);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(error);
    });

    it('notifies multiple error subscribers', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        const error = new Error('Request failed');

        request.onError(firstCallback);
        request.onError(secondCallback);

        request.fail(error);

        expect(firstCallback).toHaveBeenCalledTimes(1);
        expect(firstCallback).toHaveBeenCalledWith(error);

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith(error);
    });

    it('allows error subscribers to unsubscribe', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();
        const error = new Error('Request failed');

        const unsubscribe = request.onError(callback);

        unsubscribe();
        request.fail(error);

        expect(callback).not.toHaveBeenCalled();
        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Failed);
    });

    it('keeps other error subscribers after one subscriber unsubscribes', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();
        const error = new Error('Request failed');

        const unsubscribeFirst = request.onError(firstCallback);
        request.onError(secondCallback);

        unsubscribeFirst();
        request.fail(error);

        expect(firstCallback).not.toHaveBeenCalled();

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith(error);
    });

    it('stores the latest error', () => {
        const request = new TestRequest<string>('request-1');
        const firstError = new Error('First error');
        const secondError = new Error('Second error');

        request.fail(firstError);
        request.fail(secondError);

        expect(request.error).toBe(secondError);
        expect(request.status).toBe(RequestStatus.Failed);
    });

    it('marks request as aborted', () => {
        const request = new TestRequest<string>('request-1');

        request.abort();

        expect(request.status).toBe(RequestStatus.Aborted);
    });

    it('does not clear data or error when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Request failed');

        request.processData('response-data', RequestStatus.Pending);
        request.fail(error);
        request.abort();

        expect(request.data).toBe('response-data');
        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Aborted);
    });

    it('emits abort events when processing abort', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onAbort(callback);
        request.abort();

        expect(callback).toHaveBeenCalledTimes(1);
    });

    it('notifies multiple abort subscribers', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        request.onAbort(firstCallback);
        request.onAbort(secondCallback);

        request.abort();

        expect(firstCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    it('allows abort subscribers to unsubscribe', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        const unsubscribe = request.onAbort(callback);

        unsubscribe();
        request.abort();

        expect(callback).not.toHaveBeenCalled();
        expect(request.status).toBe(RequestStatus.Aborted);
    });

    it('keeps other abort subscribers after one subscriber unsubscribes', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        const unsubscribeFirst = request.onAbort(firstCallback);
        request.onAbort(secondCallback);

        unsubscribeFirst();
        request.abort();

        expect(firstCallback).not.toHaveBeenCalled();
        expect(secondCallback).toHaveBeenCalledTimes(1);
    });

    it('does not call message subscribers when request fails', () => {
        const request = new TestRequest<string>('request-1');
        const messageCallback = vi.fn();
        const error = new Error('Request failed');

        request.onMessage(messageCallback);
        request.fail(error);

        expect(messageCallback).not.toHaveBeenCalled();
    });

    it('does not call message subscribers when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const messageCallback = vi.fn();

        request.onMessage(messageCallback);
        request.abort();

        expect(messageCallback).not.toHaveBeenCalled();
    });

    it('does not call error subscribers when request receives data', () => {
        const request = new TestRequest<string>('request-1');
        const errorCallback = vi.fn();

        request.onError(errorCallback);
        request.processData('response-data', RequestStatus.Completed);

        expect(errorCallback).not.toHaveBeenCalled();
    });

    it('does not call abort subscribers when request receives data', () => {
        const request = new TestRequest<string>('request-1');
        const abortCallback = vi.fn();

        request.onAbort(abortCallback);
        request.processData('response-data', RequestStatus.Completed);

        expect(abortCallback).not.toHaveBeenCalled();
    });

    it('does not call abort subscribers when request fails', () => {
        const request = new TestRequest<string>('request-1');
        const abortCallback = vi.fn();
        const error = new Error('Request failed');

        request.onAbort(abortCallback);
        request.fail(error);

        expect(abortCallback).not.toHaveBeenCalled();
    });

    it('does not call error subscribers when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const errorCallback = vi.fn();

        request.onError(errorCallback);
        request.abort();

        expect(errorCallback).not.toHaveBeenCalled();
    });
});
