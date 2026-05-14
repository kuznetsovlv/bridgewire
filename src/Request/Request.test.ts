import {describe, expect, it, vi} from 'vitest';
import Request from './Request';
import {RequestStatus} from '@/types';
import type {RequestId} from '@/types';

class TestRequest<Data> extends Request<Data> {
    constructor(id: RequestId, status = RequestStatus.Pending) {
        super(id, status);
    }

    public emitMessage(data: Data): void {
        this._emitMessage(data);
    }

    public emitError(error: Error): void {
        this._emitError(error);
    }

    public abort(): void {
        this._status = RequestStatus.Aborted;
        this._emitAbort();
    }
}

describe('Request', () => {
    describe('Getters', () => {
        it('returns request id', () => {
            const request = new TestRequest<string>('request-1');

            expect(request.id).toBe('request-1');
        });

        it('returns initial status', () => {
            const request = new TestRequest<string>(
                'request-1',
                RequestStatus.Pending
            );

            expect(request.status).toBe(RequestStatus.Pending);
        });

        it('returns null data before message is emitted', () => {
            const request = new TestRequest<string>('request-1');

            expect(request.data).toBeNull();
        });

        it('returns null error before error is emitted', () => {
            const request = new TestRequest<string>('request-1');

            expect(request.error).toBeNull();
        });
    });

    describe('_emitMessage', () => {
        it('stores latest emitted message data', () => {
            const request = new TestRequest<string>('request-1');

            request.emitMessage('first');
            request.emitMessage('second');

            expect(request.data).toBe('second');
        });

        it('notifies message subscribers when message is emitted', () => {
            const request = new TestRequest<string>('request-1');
            const onMessage = vi.fn();

            request.onMessage(onMessage);

            request.emitMessage('response');

            expect(onMessage).toHaveBeenCalledOnce();
            expect(onMessage).toHaveBeenCalledWith('response');
        });

        it('does not notify unsubscribed message subscriber', () => {
            const request = new TestRequest<string>('request-1');
            const onMessage = vi.fn();

            const unsubscribe = request.onMessage(onMessage);

            unsubscribe();
            request.emitMessage('response');

            expect(onMessage).not.toHaveBeenCalled();
        });

        it('does not change status when message is emitted', () => {
            const request = new TestRequest<string>(
                'request-1',
                RequestStatus.Pending
            );

            request.emitMessage('response');

            expect(request.status).toBe(RequestStatus.Pending);
        });
    });

    describe('_emmitError', () => {
        it('stores latest emitted error', () => {
            const request = new TestRequest<string>('request-1');
            const firstError = new Error('First error');
            const secondError = new Error('Second error');

            request.emitError(firstError);
            request.emitError(secondError);

            expect(request.error).toBe(secondError);
        });

        it('notifies error subscribers when error is emitted', () => {
            const request = new TestRequest<string>('request-1');
            const onError = vi.fn();
            const error = new Error('Request failed');

            request.onError(onError);

            request.emitError(error);

            expect(onError).toHaveBeenCalledOnce();
            expect(onError).toHaveBeenCalledWith(error);
        });

        it('does not notify unsubscribed error subscriber', () => {
            const request = new TestRequest<string>('request-1');
            const onError = vi.fn();

            const unsubscribe = request.onError(onError);

            unsubscribe();
            request.emitError(new Error('Request failed'));

            expect(onError).not.toHaveBeenCalled();
        });

        it('does not change status when error is emitted', () => {
            const request = new TestRequest<string>(
                'request-1',
                RequestStatus.Pending
            );

            request.emitError(new Error('Request failed'));

            expect(request.status).toBe(RequestStatus.Pending);
        });
    });

    describe('_emitAbort', () => {
        it('notifies abort subscribers when request is aborted', () => {
            const request = new TestRequest<string>('request-1');
            const onAbort = vi.fn();

            request.onAbort(onAbort);

            request.abort();

            expect(onAbort).toHaveBeenCalledOnce();
        });

        it('updates status when request is aborted', () => {
            const request = new TestRequest<string>('request-1');

            request.abort();

            expect(request.status).toBe(RequestStatus.Aborted);
        });

        it('does not notify unsubscribed abort subscriber', () => {
            const request = new TestRequest<string>('request-1');
            const onAbort = vi.fn();

            const unsubscribe = request.onAbort(onAbort);

            unsubscribe();
            request.abort();

            expect(onAbort).not.toHaveBeenCalled();
        });
    });
});
