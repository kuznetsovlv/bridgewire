import {afterEach, describe, expect, it, vi} from 'vitest';

import {HTTPMethod, RequestStatus} from '@/types';

import FetchRequest, {defaultResponseParser} from './FetchRequest';

const url = new URL('https://example.com/api');

function createJsonResponse(data: unknown, init?: ResponseInit): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'content-type': 'application/json',
        },
        ...init,
    });
}

function createTextResponse(data: string, init?: ResponseInit): Response {
    return new Response(data, {
        status: 200,
        headers: {
            'content-type': 'text/plain',
        },
        ...init,
    });
}

async function waitForPromises(): Promise<void> {
    for (let i = 0; i < 10; i += 1) {
        await Promise.resolve();
    }
}

describe('defaultResponseParser', () => {
    it('parses 204 response as undefined', async () => {
        const response = new Response(null, {
            status: 204,
        });

        const data = await defaultResponseParser<undefined>(response);

        expect(data).toBeUndefined();
    });

    it('parses 205 response as undefined', async () => {
        const response = new Response(null, {
            status: 205,
        });

        const data = await defaultResponseParser<undefined>(response);

        expect(data).toBeUndefined();
    });

    it('parses json response', async () => {
        const response = createJsonResponse({ok: true});

        const data = await defaultResponseParser<{ok: boolean}>(response);

        expect(data).toEqual({ok: true});
    });

    it('parses json response with charset', async () => {
        const response = new Response(JSON.stringify({ok: true}), {
            status: 200,
            headers: {
                'content-type': 'application/json; charset=utf-8',
            },
        });

        const data = await defaultResponseParser<{ok: boolean}>(response);

        expect(data).toEqual({ok: true});
    });

    it('parses text response', async () => {
        const response = createTextResponse('hello');

        const data = await defaultResponseParser<string>(response);

        expect(data).toBe('hello');
    });

    it('parses multipart form data response', async () => {
        const formData = new FormData();

        formData.append('name', 'Leonid');

        const response = new Response(formData, {
            status: 200,
        });

        const data = await defaultResponseParser<FormData>(response);

        expect(data.get('name')).toBe('Leonid');
    });

    it('parses unknown content type as blob', async () => {
        const response = new Response('binary-like-data', {
            status: 200,
            headers: {
                'content-type': 'application/octet-stream',
            },
        });

        const data = await defaultResponseParser<Blob>(response);

        expect(data).toBeInstanceOf(Blob);
        expect(await data.text()).toBe('binary-like-data');
    });

    it('parses missing content type as blob', async () => {
        const response = new Response(new Uint8Array([100, 97, 116, 97]), {
            status: 200,
        });

        const data = await defaultResponseParser<Blob>(response);

        expect(data).toBeInstanceOf(Blob);
        expect(await data.text()).toBe('data');
    });
});

describe('FetchRequest', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts fetch with provided options', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        new FetchRequest('request-1', {
            url,
            method: HTTPMethod.POST,
            headers: {
                'content-type': 'application/json',
            },
            body: JSON.stringify({name: 'Leonid'}),
        });

        expect(fetchMock).toHaveBeenCalledOnce();
        expect(fetchMock).toHaveBeenCalledWith(
            url,
            expect.objectContaining({
                method: HTTPMethod.POST,
                headers: {
                    'content-type': 'application/json',
                },
                body: JSON.stringify({name: 'Leonid'}),
                signal: expect.any(AbortSignal),
            })
        );
    });

    it('has pending status before fetch resolves', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {url});

        expect(request.id).toBe('request-1');
        expect(request.status).toBe(RequestStatus.Pending);
        expect(request.settled).toBe(false);
        expect(request.data).toBeNull();
        expect(request.error).toBeNull();
    });

    it('completes request with parsed json data', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest<{ok: boolean}>('request-1', {
            url,
        });

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.settled).toBe(true);
        expect(request.data).toEqual({ok: true});
        expect(request.error).toBeNull();
    });

    it('emits message on successful response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest<{ok: boolean}>('request-1', {
            url,
        });

        const onMessage = vi.fn();

        request.onMessage(onMessage);

        await waitForPromises();

        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith({ok: true});
    });

    it('emits settled event on successful response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest<{ok: boolean}>('request-1', {
            url,
        });

        const onSettled = vi.fn();

        request.onSettled(onSettled);

        await waitForPromises();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(RequestStatus.Completed, null);
    });

    it('uses custom response parser', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createTextResponse('42')
        );

        const responseParser = vi.fn(async (response: Response) => {
            const text = await response.text();

            return Number(text);
        });

        const request = new FetchRequest<number>('request-1', {
            url,
            responseParser,
        });

        await waitForPromises();

        expect(responseParser).toHaveBeenCalledOnce();
        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.settled).toBe(true);
        expect(request.data).toBe(42);
    });

    it('fails request on non-ok response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('Not found', {
                status: 404,
                statusText: 'Not Found',
            })
        );

        const request = new FetchRequest('request-1', {url});

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(new Error('Error 404: Not Found'));
    });

    it('emits error on non-ok response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('Server error', {
                status: 500,
                statusText: 'Internal Server Error',
            })
        );

        const request = new FetchRequest('request-1', {url});
        const onError = vi.fn();

        request.onError(onError);

        await waitForPromises();

        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][0]).toEqual(
            new Error('Error 500: Internal Server Error')
        );
    });

    it('emits settled event on non-ok response', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('Server error', {
                status: 500,
                statusText: 'Internal Server Error',
            })
        );

        const request = new FetchRequest('request-1', {url});
        const onSettled = vi.fn();

        request.onSettled(onSettled);

        await waitForPromises();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled.mock.calls[0][0]).toBe(RequestStatus.Failed);
        expect(onSettled.mock.calls[0][1]).toEqual(
            new Error('Error 500: Internal Server Error')
        );
    });

    it('fails request when fetch rejects', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue(
            new Error('Network error')
        );

        const request = new FetchRequest('request-1', {url});

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(new Error('Network error'));
    });

    it('normalizes non-error fetch rejection', async () => {
        vi.spyOn(globalThis, 'fetch').mockRejectedValue('Network error');

        const request = new FetchRequest('request-1', {url});

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(new Error('Network error'));
    });

    it('fails request when response parser throws', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest('request-1', {
            url,
            responseParser: async () => {
                throw new Error('Parse error');
            },
        });

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Failed);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(new Error('Parse error'));
    });

    it('emits settled event when response parser throws', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest('request-1', {
            url,
            responseParser: async () => {
                throw new Error('Parse error');
            },
        });

        const onSettled = vi.fn();

        request.onSettled(onSettled);

        await waitForPromises();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled.mock.calls[0][0]).toBe(RequestStatus.Failed);
        expect(onSettled.mock.calls[0][1]).toEqual(new Error('Parse error'));
    });

    it('aborts pending request and emits abort event', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {url});
        const onAbort = vi.fn();

        request.onAbort(onAbort);

        request.abort();

        expect(request.status).toBe(RequestStatus.Aborted);
        expect(request.settled).toBe(true);
        expect(onAbort).toHaveBeenCalledOnce();
    });

    it('emits settled event when request is aborted', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {url});
        const onSettled = vi.fn();

        request.onSettled(onSettled);

        request.abort();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(RequestStatus.Aborted, null);
    });

    it('passes abort signal to fetch', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {url});

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.signal).toBeInstanceOf(AbortSignal);
        expect(init?.signal?.aborted).toBe(false);

        request.abort();

        expect(init?.signal?.aborted).toBe(true);
    });

    it('does not emit abort more than once', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {url});
        const onAbort = vi.fn();
        const onSettled = vi.fn();

        request.onAbort(onAbort);
        request.onSettled(onSettled);

        request.abort();
        request.abort();

        expect(onAbort).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledOnce();
    });

    it('does not abort completed request', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest<{ok: boolean}>('request-1', {
            url,
        });

        const onAbort = vi.fn();

        request.onAbort(onAbort);

        await waitForPromises();

        request.abort();

        expect(request.status).toBe(RequestStatus.Completed);
        expect(onAbort).not.toHaveBeenCalled();
    });

    it('does not fail request after abort rejection', async () => {
        vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });

        const request = new FetchRequest('request-1', {url});

        request.abort();

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.Aborted);
        expect(request.settled).toBe(true);
        expect(request.error).toBeNull();
    });

    it('marks request as timed out when timeout expires', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {
            url,
            timeout: 1000,
        });

        vi.advanceTimersByTime(1000);

        expect(request.status).toBe(RequestStatus.TimedOut);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(
            new Error('Request timed out after 1000ms')
        );
    });

    it('emits error when request times out', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {
            url,
            timeout: 1000,
        });

        const onError = vi.fn();

        request.onError(onError);

        vi.advanceTimersByTime(1000);

        expect(onError).toHaveBeenCalledOnce();
        expect(onError.mock.calls[0][0]).toEqual(
            new Error('Request timed out after 1000ms')
        );
    });

    it('emits settled event when request times out', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {
            url,
            timeout: 1000,
        });

        const onSettled = vi.fn();

        request.onSettled(onSettled);

        vi.advanceTimersByTime(1000);

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(
            RequestStatus.TimedOut,
            new Error('Request timed out after 1000ms')
        );
    });

    it('does not mark timed out request as failed after abort rejection', async () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => {
            return new Promise((_resolve, reject) => {
                init?.signal?.addEventListener('abort', () => {
                    reject(new DOMException('Aborted', 'AbortError'));
                });
            });
        });

        const request = new FetchRequest('request-1', {
            url,
            timeout: 1000,
        });

        vi.advanceTimersByTime(1000);

        await waitForPromises();

        expect(request.status).toBe(RequestStatus.TimedOut);
        expect(request.settled).toBe(true);
        expect(request.error).toEqual(
            new Error('Request timed out after 1000ms')
        );
    });

    it('clears timeout after successful response', async () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const request = new FetchRequest<{ok: boolean}>('request-1', {
            url,
            timeout: 1000,
        });

        await waitForPromises();

        vi.advanceTimersByTime(1000);

        expect(request.status).toBe(RequestStatus.Completed);
        expect(request.settled).toBe(true);
        expect(request.data).toEqual({ok: true});
    });

    it('clears timeout after manual abort', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const request = new FetchRequest('request-1', {
            url,
            timeout: 1000,
        });

        request.abort();

        vi.advanceTimersByTime(1000);

        expect(request.status).toBe(RequestStatus.Aborted);
        expect(request.settled).toBe(true);
    });
});
