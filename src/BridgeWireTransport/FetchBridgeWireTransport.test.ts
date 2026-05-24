import {afterEach, describe, expect, it, vi} from 'vitest';

import {
    FetchCache,
    FetchCredentials,
    FetchMode,
    FetchRedirect,
    HTTPMethod,
    PayloadDataType,
    Protocol,
    RequestStatus,
    TransportStatus,
} from '@/types';

import FetchBridgeWireTransport from './FetchBridgeWireTransport';

const urlData = {
    protocol: Protocol.HTTPS,
    host: 'example.com',
    port: 443,
    path: '/api/users',
    query: {},
};

async function waitForPromises(): Promise<void> {
    for (let i = 0; i < 10; ++i) {
        await Promise.resolve();
    }
}

function createJsonResponse(data: unknown): Response {
    return new Response(JSON.stringify(data), {
        status: 200,
        headers: {
            'content-type': 'application/json',
        },
    });
}

describe('FetchBridgeWireTransport', () => {
    afterEach(() => {
        vi.useRealTimers();
        vi.restoreAllMocks();
    });

    it('starts with Connected status', () => {
        const transport = new FetchBridgeWireTransport<
            Record<string, string>,
            unknown
        >({
            urlData,
            method: HTTPMethod.GET,
        });

        expect(transport.status).toBe(TransportStatus.Connected);
    });

    it('creates and registers GET request', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<
            Record<string, string>,
            unknown
        >({
            urlData,
            method: HTTPMethod.GET,
        });

        const request = transport.send({page: '1'});

        expect(request).not.toBeNull();
        expect(request?.status).toBe(RequestStatus.Pending);
    });

    it('sends object data as query params for GET', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<
            Record<string, string>,
            unknown
        >({
            urlData: {
                ...urlData,
                query: {
                    existing: 'yes',
                },
            },
            method: HTTPMethod.GET,
        });

        transport.send({
            page: '1',
            search: 'react',
        });

        expect(fetchMock).toHaveBeenCalledOnce();

        const [url, init] = fetchMock.mock.calls[0];

        expect((url as URL).toString()).toBe(
            'https://example.com/api/users?existing=yes&page=1&search=react'
        );
        expect(init?.method).toBe(HTTPMethod.GET);
        expect(init?.body).toBeUndefined();
    });

    it('keeps configured query for primitive GET data', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<string, unknown>({
            urlData: {
                ...urlData,
                query: {
                    existing: 'yes',
                },
            },
            method: HTTPMethod.GET,
        });

        transport.send('ignored');

        const [url, init] = fetchMock.mock.calls[0];

        expect((url as URL).toString()).toBe(
            'https://example.com/api/users?existing=yes'
        );
        expect(init?.method).toBe(HTTPMethod.GET);
        expect(init?.body).toBeUndefined();
    });

    it('sends DELETE request with query params', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<
            Record<string, string>,
            unknown
        >({
            urlData,
            method: HTTPMethod.DELETE,
        });

        transport.send({id: '42'});

        const [url, init] = fetchMock.mock.calls[0];

        expect((url as URL).toString()).toBe(
            'https://example.com/api/users?id=42'
        );
        expect(init?.method).toBe(HTTPMethod.DELETE);
        expect(init?.body).toBeUndefined();
    });

    it('uses raw response parser for HEAD', async () => {
        const response = new Response(null, {
            status: 200,
            headers: {
                'x-total-count': '10',
            },
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

        const transport = new FetchBridgeWireTransport<undefined, Response>({
            urlData,
            method: HTTPMethod.HEAD,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBe(response);
    });

    it('uses raw response parser for OPTIONS', async () => {
        const response = new Response(null, {
            status: 204,
            headers: {
                allow: 'GET,POST,OPTIONS',
            },
        });

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

        const transport = new FetchBridgeWireTransport<undefined, Response>({
            urlData,
            method: HTTPMethod.OPTIONS,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBe(response);
    });

    it('sends plain object data as JSON body for POST', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<{name: string}, unknown>(
            {
                urlData,
                method: HTTPMethod.POST,
            }
        );

        transport.send({name: 'Leonid'});

        const [url, init] = fetchMock.mock.calls[0];

        expect((url as URL).toString()).toBe('https://example.com/api/users');
        expect(init?.method).toBe(HTTPMethod.POST);
        expect(init?.body).toBe(JSON.stringify({name: 'Leonid'}));
    });

    it('sends plain object data as JSON body for PUT', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<{name: string}, unknown>(
            {
                urlData,
                method: HTTPMethod.PUT,
            }
        );

        transport.send({name: 'Leonid'});

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.method).toBe(HTTPMethod.PUT);
        expect(init?.body).toBe(JSON.stringify({name: 'Leonid'}));
    });

    it('sends plain object data as JSON body for PATCH', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<{name: string}, unknown>(
            {
                urlData,
                method: HTTPMethod.PATCH,
            }
        );

        transport.send({name: 'Leonid'});

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.method).toBe(HTTPMethod.PATCH);
        expect(init?.body).toBe(JSON.stringify({name: 'Leonid'}));
    });

    it('passes supported fetch body values through for POST', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const body = new URLSearchParams({
            name: 'Leonid',
        });

        const transport = new FetchBridgeWireTransport<
            URLSearchParams,
            unknown
        >({
            urlData,
            method: HTTPMethod.POST,
        });

        transport.send(body);

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.body).toBe(body);
    });

    it('supports ArrayBuffer body values', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const body = new ArrayBuffer(3);

        const transport = new FetchBridgeWireTransport<ArrayBuffer, unknown>({
            urlData,
            method: HTTPMethod.POST,
        });

        transport.send(body);

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.body).toBe(body);
    });

    it('supports ArrayBufferView body values', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const body = new Uint8Array([1, 2, 3]);

        const transport = new FetchBridgeWireTransport<Uint8Array, unknown>({
            urlData,
            method: HTTPMethod.POST,
        });

        transport.send(body);

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.body).toBe(body);
    });

    it('uses empty string body for null POST data', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<null, unknown>({
            urlData,
            method: HTTPMethod.POST,
        });

        transport.send(null);

        const [, init] = fetchMock.mock.calls[0];

        expect(init?.body).toBe('');
    });

    it('passes configured fetch options to FetchRequest', () => {
        const fetchMock = vi
            .spyOn(globalThis, 'fetch')
            .mockReturnValue(new Promise(() => {}));

        const headers = {
            accept: 'application/json',
        };

        const transport = new FetchBridgeWireTransport<{name: string}, unknown>(
            {
                urlData,
                method: HTTPMethod.POST,
                headers,
                referrer: 'about:client',
                referrerPolicy: 'strict-origin-when-cross-origin',
                mode: FetchMode.CORS,
                credentials: FetchCredentials.SAME_ORIGIN,
                cache: FetchCache.NO_CACHE,
                redirect: FetchRedirect.FOLLOW,
                integrity: 'sha256-test',
                keepalive: true,
                timeout: 1000,
            }
        );

        transport.send({name: 'Leonid'});

        const [, init] = fetchMock.mock.calls[0];

        expect(init).toEqual(
            expect.objectContaining({
                method: HTTPMethod.POST,
                headers,
                referrer: 'about:client',
                referrerPolicy: 'strict-origin-when-cross-origin',
                mode: FetchMode.CORS,
                credentials: FetchCredentials.SAME_ORIGIN,
                cache: FetchCache.NO_CACHE,
                redirect: FetchRedirect.FOLLOW,
                integrity: 'sha256-test',
                keepalive: true,
            })
        );
    });

    it('allows request options to override transport timeout', () => {
        vi.useFakeTimers();

        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<undefined, unknown>({
            urlData,
            method: HTTPMethod.GET,
            timeout: 1000,
        });

        const request = transport.send(undefined, {
            timeout: 2000,
        });

        vi.advanceTimersByTime(1000);

        expect(request?.status).toBe(RequestStatus.Pending);

        vi.advanceTimersByTime(999);

        expect(request?.status).toBe(RequestStatus.Pending);

        vi.advanceTimersByTime(1);

        expect(request?.status).toBe(RequestStatus.TimedOut);
    });

    it('uses TEXT parser when data type is TEXT', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('hello', {
                status: 200,
                headers: {
                    'content-type': 'application/octet-stream',
                },
            })
        );

        const transport = new FetchBridgeWireTransport<undefined, string>({
            urlData,
            method: HTTPMethod.GET,
            dataType: PayloadDataType.TEXT,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBe('hello');
    });

    it('uses JSON parser when data type is JSON', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const transport = new FetchBridgeWireTransport<
            undefined,
            {ok: boolean}
        >({
            urlData,
            method: HTTPMethod.GET,
            dataType: PayloadDataType.JSON,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toEqual({ok: true});
    });

    it('uses BLOB parser when data type is BLOB', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('blob-data', {
                status: 200,
                headers: {
                    'content-type': 'text/plain',
                },
            })
        );

        const transport = new FetchBridgeWireTransport<undefined, Blob>({
            urlData,
            method: HTTPMethod.GET,
            dataType: PayloadDataType.BLOB,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBeInstanceOf(Blob);
        expect(await request?.data?.text()).toBe('blob-data');
    });

    it('uses ARRAY_BUFFER parser when data type is ARRAY_BUFFER', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response(new Uint8Array([1, 2, 3]), {
                status: 200,
            })
        );

        const transport = new FetchBridgeWireTransport<undefined, ArrayBuffer>({
            urlData,
            method: HTTPMethod.GET,
            dataType: PayloadDataType.ARRAY_BUFFER,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBeInstanceOf(ArrayBuffer);

        const buffer = request?.data as ArrayBuffer;

        expect(Array.from(new Uint8Array(buffer))).toEqual([1, 2, 3]);
    });

    it('uses FORM_DATA parser when data type is FORM_DATA', async () => {
        const formData = new FormData();

        formData.append('name', 'Leonid');

        const response = new Response('', {
            status: 200,
        });

        const formDataSpy = vi
            .spyOn(response, 'formData')
            .mockResolvedValue(formData);

        vi.spyOn(globalThis, 'fetch').mockResolvedValue(response);

        const transport = new FetchBridgeWireTransport<undefined, FormData>({
            urlData,
            method: HTTPMethod.GET,
            dataType: PayloadDataType.FORM_DATA,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(formDataSpy).toHaveBeenCalledOnce();
        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toBe(formData);
        expect(request?.data?.get('name')).toBe('Leonid');
    });

    it('uses FetchRequest default parser when data type is omitted', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const transport = new FetchBridgeWireTransport<
            undefined,
            {ok: boolean}
        >({
            urlData,
            method: HTTPMethod.GET,
        });

        const request = transport.send(undefined);

        await waitForPromises();

        expect(request?.status).toBe(RequestStatus.Completed);
        expect(request?.data).toEqual({ok: true});
    });

    it('forwards message events from created request', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const transport = new FetchBridgeWireTransport<
            undefined,
            {ok: boolean}
        >({
            urlData,
            method: HTTPMethod.GET,
        });

        const onMessage = vi.fn();

        transport.onMessage(onMessage);

        const request = transport.send(undefined);

        await waitForPromises();

        expect(onMessage).toHaveBeenCalledOnce();
        expect(onMessage).toHaveBeenCalledWith(request?.id, {ok: true});
    });

    it('forwards settled events from created request', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            createJsonResponse({ok: true})
        );

        const transport = new FetchBridgeWireTransport<
            undefined,
            {ok: boolean}
        >({
            urlData,
            method: HTTPMethod.GET,
        });

        const onSettled = vi.fn();

        transport.onSettled(onSettled);

        const request = transport.send(undefined);

        await waitForPromises();

        expect(onSettled).toHaveBeenCalledOnce();
        expect(onSettled).toHaveBeenCalledWith(
            request?.id,
            RequestStatus.Completed,
            null
        );
    });

    it('forwards request error events from created request', async () => {
        vi.spyOn(globalThis, 'fetch').mockResolvedValue(
            new Response('Server error', {
                status: 500,
                statusText: 'Internal Server Error',
            })
        );

        const transport = new FetchBridgeWireTransport<undefined, unknown>({
            urlData,
            method: HTTPMethod.GET,
        });

        const onRequestError = vi.fn();

        transport.onRequestError(onRequestError);

        const request = transport.send(undefined);

        await waitForPromises();

        expect(onRequestError).toHaveBeenCalledOnce();
        expect(onRequestError.mock.calls[0][0]).toBe(request?.id);
        expect(onRequestError.mock.calls[0][1]).toEqual(
            new Error('Error 500: Internal Server Error')
        );
    });

    it('forwards abort events from created request', () => {
        vi.spyOn(globalThis, 'fetch').mockReturnValue(new Promise(() => {}));

        const transport = new FetchBridgeWireTransport<undefined, unknown>({
            urlData,
            method: HTTPMethod.GET,
        });

        const onAbort = vi.fn();

        transport.onAbort(onAbort);

        const request = transport.send(undefined);

        request?.abort();

        expect(onAbort).toHaveBeenCalledOnce();
        expect(onAbort).toHaveBeenCalledWith(request?.id);
    });
});
