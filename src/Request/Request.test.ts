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

    public nonTerminalError(error: Error): void {
        this._processError(error, false);
    }

    public timeout(timeout: number): void {
        this._processTimeout(timeout);
    }

    public complete(): void {
        this._processComplete();
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

    it('is not settled by default', () => {
        const request = new TestRequest<string>('request-1');

        expect(request.settled).toBe(false);
    });

    it('is settled when created with terminal status', () => {
        const request = new TestRequest<string>(
            'request-1',
            RequestStatus.Completed
        );

        expect(request.settled).toBe(true);
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
        expect(request.settled).toBe(false);
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

    it('stores the latest received data before request is settled', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('first-data', RequestStatus.Pending);
        request.processData('second-data', RequestStatus.Pending);

        expect(request.data).toBe('second-data');
        expect(request.status).toBe(RequestStatus.Pending);
    });

    it('marks request as settled when completed with data', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('response-data', RequestStatus.Completed);

        expect(request.settled).toBe(true);
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('emits settled event when completed with data', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onSettled(callback);
        request.processData('response-data', RequestStatus.Completed);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });

    it('does not emit settled event for non-terminal data', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onSettled(callback);
        request.processData('response-data', RequestStatus.Pending);

        expect(callback).not.toHaveBeenCalled();
        expect(request.settled).toBe(false);
    });

    it('allows settled subscribers to unsubscribe', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        const unsubscribe = request.onSettled(callback);

        unsubscribe();
        request.complete();

        expect(callback).not.toHaveBeenCalled();
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('keeps other settled subscribers after one subscriber unsubscribes', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        const unsubscribeFirst = request.onSettled(firstCallback);
        request.onSettled(secondCallback);

        unsubscribeFirst();
        request.complete();

        expect(firstCallback).not.toHaveBeenCalled();

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith(
            RequestStatus.Completed,
            null
        );
    });

    it('stores request error and marks request as failed', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Request failed');

        request.fail(error);

        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
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

    it('emits settled event when request fails', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();
        const error = new Error('Request failed');

        request.onSettled(callback);
        request.fail(error);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(RequestStatus.Failed, error);
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

    it('supports non-terminal errors', () => {
        const request = new TestRequest<string>('request-1');
        const errorCallback = vi.fn();
        const settledCallback = vi.fn();
        const error = new Error('Parser failed');

        request.onError(errorCallback);
        request.onSettled(settledCallback);

        request.nonTerminalError(error);

        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);

        expect(errorCallback).toHaveBeenCalledTimes(1);
        expect(errorCallback).toHaveBeenCalledWith(error);
        expect(settledCallback).not.toHaveBeenCalled();
    });

    it('continues receiving data after non-terminal error', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Parser failed');

        request.nonTerminalError(error);
        request.processData('response-data', RequestStatus.Pending);

        expect(request.data).toBe('response-data');
        expect(request.error).toBe(error);
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('stores latest non-terminal error before request is settled', () => {
        const request = new TestRequest<string>('request-1');
        const firstError = new Error('First error');
        const secondError = new Error('Second error');

        request.nonTerminalError(firstError);
        request.nonTerminalError(secondError);

        expect(request.error).toBe(secondError);
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
    });

    it('stores timeout error and marks request as timed out', () => {
        const request = new TestRequest<string>('request-1');

        request.timeout(1000);

        expect(request.error).toEqual(
            new Error('Request timed out after 1000ms')
        );
        expect(request.status).toBe(RequestStatus.TimedOut);
        expect(request.settled).toBe(true);
    });

    it('does not clear previously received data when request times out', () => {
        const request = new TestRequest<string>('request-1');

        request.processData('response-data', RequestStatus.Pending);
        request.timeout(1000);

        expect(request.data).toBe('response-data');
        expect(request.error).toEqual(
            new Error('Request timed out after 1000ms')
        );
        expect(request.status).toBe(RequestStatus.TimedOut);
    });

    it('emits error events when processing timeout', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onError(callback);
        request.timeout(1000);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
            new Error('Request timed out after 1000ms')
        );
    });

    it('emits settled event when request times out', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onSettled(callback);
        request.timeout(1000);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(
            RequestStatus.TimedOut,
            new Error('Request timed out after 1000ms')
        );
    });

    it('notifies multiple error subscribers when request times out', () => {
        const request = new TestRequest<string>('request-1');
        const firstCallback = vi.fn();
        const secondCallback = vi.fn();

        request.onError(firstCallback);
        request.onError(secondCallback);

        request.timeout(1000);

        expect(firstCallback).toHaveBeenCalledTimes(1);
        expect(firstCallback).toHaveBeenCalledWith(
            new Error('Request timed out after 1000ms')
        );

        expect(secondCallback).toHaveBeenCalledTimes(1);
        expect(secondCallback).toHaveBeenCalledWith(
            new Error('Request timed out after 1000ms')
        );
    });

    it('allows error subscribers to unsubscribe before timeout', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        const unsubscribe = request.onError(callback);

        unsubscribe();
        request.timeout(1000);

        expect(callback).not.toHaveBeenCalled();
        expect(request.error).toEqual(
            new Error('Request timed out after 1000ms')
        );
        expect(request.status).toBe(RequestStatus.TimedOut);
    });

    it('marks request as aborted', () => {
        const request = new TestRequest<string>('request-1');

        request.abort();

        expect(request.status).toBe(RequestStatus.Aborted);
        expect(request.settled).toBe(true);
    });

    it('does not clear data or error when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Parser failed');

        request.processData('response-data', RequestStatus.Pending);
        request.nonTerminalError(error);
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

    it('emits settled event when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onSettled(callback);
        request.abort();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(RequestStatus.Aborted, null);
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

    it('marks request as completed without data', () => {
        const request = new TestRequest<string>('request-1');

        request.complete();

        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.settled).toBe(true);
        expect(request.data).toBeNull();
        expect(request.error).toBeNull();
    });

    it('emits settled event when request completes without data', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();

        request.onSettled(callback);
        request.complete();

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });

    it('does not call message subscribers when request fails', () => {
        const request = new TestRequest<string>('request-1');
        const messageCallback = vi.fn();
        const error = new Error('Request failed');

        request.onMessage(messageCallback);
        request.fail(error);

        expect(messageCallback).not.toHaveBeenCalled();
    });

    it('does not call message subscribers when request times out', () => {
        const request = new TestRequest<string>('request-1');
        const messageCallback = vi.fn();

        request.onMessage(messageCallback);
        request.timeout(1000);

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

    it('does not call abort subscribers when request times out', () => {
        const request = new TestRequest<string>('request-1');
        const abortCallback = vi.fn();

        request.onAbort(abortCallback);
        request.timeout(1000);

        expect(abortCallback).not.toHaveBeenCalled();
    });

    it('does not call error subscribers when request is aborted', () => {
        const request = new TestRequest<string>('request-1');
        const errorCallback = vi.fn();

        request.onError(errorCallback);
        request.abort();

        expect(errorCallback).not.toHaveBeenCalled();
    });

    it('ignores data after request is settled', () => {
        const request = new TestRequest<string>('request-1');

        request.complete();
        request.processData('late-data', RequestStatus.Pending);

        expect(request.data).toBeNull();
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('ignores terminal error after request is settled', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Request failed');

        request.complete();
        request.fail(error);

        expect(request.error).toBeNull();
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('ignores non-terminal error after request is settled', () => {
        const request = new TestRequest<string>('request-1');
        const error = new Error('Parser failed');

        request.complete();
        request.nonTerminalError(error);

        expect(request.error).toBeNull();
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('ignores timeout after request is settled', () => {
        const request = new TestRequest<string>('request-1');

        request.complete();
        request.timeout(1000);

        expect(request.error).toBeNull();
        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('ignores abort after request is settled', () => {
        const request = new TestRequest<string>('request-1');

        request.complete();
        request.abort();

        expect(request.status).toBe(RequestStatus.Completed);
    });

    it('does not emit settled event more than once', () => {
        const request = new TestRequest<string>('request-1');
        const callback = vi.fn();
        const error = new Error('Request failed');

        request.onSettled(callback);

        request.complete();
        request.fail(error);
        request.abort();
        request.timeout(1000);

        expect(callback).toHaveBeenCalledTimes(1);
        expect(callback).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });
});
