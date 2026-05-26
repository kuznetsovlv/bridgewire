# BridgeWire

Transport-agnostic client for HTTP and WebSocket communication.

BridgeWire provides a fluent builder API for creating typed transports over `fetch` and `WebSocket`. It is designed to keep request lifecycle handling, subscriptions, timeouts, parsing, and transport selection in one consistent API.

[Coverage report](https://kuznetsovlv.github.io/bridgewire/)

## Status

BridgeWire is under active development.

Current support:

- Fetch-based transport
- WebSocket-based transport
- Typed request and response data
- Request lifecycle statuses
- Transport-level subscriptions
- Request-level message, error, abort, and settled events
- Timeout handling
- Content-type based default fetch response parser
- Explicit payload parser selection through `PayloadDataType`
- GitHub Actions CI
- HTML coverage report via GitHub Pages

## Installation

After the package is published:

```bash
npm install bridgewire
```

For local development:

```bash
git clone https://github.com/kuznetsovlv/bridgewire.git
cd bridgewire
npm install
```

## Basic usage

```ts
import getBridgeWireBuilder, {
    HTTPMethod,
    PayloadDataType,
    Protocol,
    TransportType,
} from 'bridgewire';

type UserQuery = {
    id: string;
};

type UserResponse = {
    id: string;
    name: string;
};

const transport = getBridgeWireBuilder<UserQuery, UserResponse>()
    .withTransport(TransportType.FETCH)
    .withProtocol(Protocol.HTTPS)
    .withHost('api.example.com')
    .withPath('/users')
    .withMethod(HTTPMethod.GET)
    .withDataType(PayloadDataType.JSON)
    .build();

const unsubscribeMessage = transport.onMessage((id, data) => {
    console.log('Message from request:', id, data);
});

const unsubscribeError = transport.onRequestError((id, error) => {
    console.error('Request error:', id, error);
});

const request = transport.send({
    id: '42',
});

console.log(request?.status);
```

For `GET`, `HEAD`, `DELETE`, and `OPTIONS`, plain object request data is merged into the URL query string.

```ts
transport.send({
    page: '1',
    search: 'react',
});
```

This produces a request URL similar to:

```text
https://api.example.com/users?page=1&search=react
```

## Fetch POST example

```ts
import getBridgeWireBuilder, {
    HTTPMethod,
    PayloadDataType,
    Protocol,
    TransportType,
} from 'bridgewire';

type CreateUserRequest = {
    name: string;
};

type CreateUserResponse = {
    id: string;
    name: string;
};

const transport = getBridgeWireBuilder<CreateUserRequest, CreateUserResponse>()
    .withTransport(TransportType.FETCH)
    .withProtocol(Protocol.HTTPS)
    .withHost('api.example.com')
    .withPath('/users')
    .withMethod(HTTPMethod.POST)
    .withHeader('Content-Type', 'application/json')
    .withDataType(PayloadDataType.JSON)
    .withTimeout(5000)
    .build();

transport.onMessage((id, data) => {
    console.log('Created user:', id, data);
});

transport.onSettled((id, status, error) => {
    console.log('Request settled:', id, status, error);
});

transport.send({
    name: 'Leonid',
});
```

For `POST`, `PUT`, and `PATCH`, plain object request data is serialized to JSON.

Native Fetch body values are passed through:

- `string`
- `FormData`
- `Blob`
- `ArrayBuffer`
- `ArrayBufferView`
- `URLSearchParams`

## WebSocket example

```ts
import getBridgeWireBuilder, {
    PayloadDataType,
    Protocol,
    TransportType,
} from 'bridgewire';

type ClientMessage = {
    type: 'ping';
};

type ServerMessage = {
    type: 'pong';
};

const transport = getBridgeWireBuilder<ClientMessage, ServerMessage>()
    .withTransport(TransportType.WEBSOCKET)
    .withProtocol(Protocol.WSS)
    .withHost('example.com')
    .withPath('/socket')
    .withDataType(PayloadDataType.JSON)
    .withTimeout(5000)
    .build();

transport.onMessage((id, data) => {
    console.log('WebSocket message:', id, data);
});

transport.onRequestError((id, error) => {
    console.error('WebSocket request error:', id, error);
});

transport.onError((error) => {
    console.error('Transport error:', error);
});

const request = transport.send({
    type: 'ping',
});
```

The current WebSocket model represents a socket stream. While the socket request is active, multiple incoming messages can be emitted through the same request.

When `PayloadDataType.JSON` is used, incoming messages are parsed with `JSON.parse`.

## Builder API

The main entry point is:

```ts
getBridgeWireBuilder<RequestData, ResponseData>();
```

The builder supports fluent configuration:

```ts
const transport = getBridgeWireBuilder<RequestData, ResponseData>()
    .withTransport(TransportType.FETCH)
    .withProtocol(Protocol.HTTPS)
    .withHost('api.example.com')
    .withPort(443)
    .withPath('/api')
    .withQuery({page: '1'})
    .withHash('top')
    .withMethod(HTTPMethod.GET)
    .withHeader('Accept', 'application/json')
    .withTimeout(5000)
    .build();
```

### Transport configuration

```ts
.withTransport(TransportType.FETCH)
.withTransport(TransportType.WEBSOCKET)
```

If transport is omitted, BridgeWire infers it from the configured or default protocol:

- `http` / `https` -> Fetch
- `ws` / `wss` -> WebSocket

### URL configuration

```ts
.withProtocol(Protocol.HTTPS)
.withHost('api.example.com')
.withPort(443)
.withPath('/users')
.withQuery({ page: '1', tag: ['react', 'typescript'] })
.withHash('section')
.withUrl('https://api.example.com/users?page=1#section')
```

`withUrl` accepts URL-like strings and applies parsed URL parts to the builder.

### Fetch configuration

```ts
.withMethod(HTTPMethod.POST)
.withHeaders({ Accept: 'application/json' })
.withHeader('Content-Type', 'application/json')
.withReferrer('about:client')
.withReferrerPolicy('strict-origin-when-cross-origin')
.withMode(FetchMode.CORS)
.withCredentials(FetchCredentials.SAME_ORIGIN)
.withCache(FetchCache.NO_CACHE)
.withRedirect(FetchRedirect.FOLLOW)
.withIntegrity('sha256-...')
.withKeepAlive()
```

### WebSocket configuration

```ts
.withSoap()
.withWamp()
```

These methods enable the corresponding WebSocket subprotocol flags.

### Payload data type

```ts
.withDataType(PayloadDataType.JSON)
.withDataType(PayloadDataType.TEXT)
.withDataType(PayloadDataType.BLOB)
.withDataType(PayloadDataType.FORM_DATA)
.withDataType(PayloadDataType.ARRAY_BUFFER)
```

For Fetch, the data type selects the response parser.

For WebSocket, `PayloadDataType.JSON` parses incoming messages with `JSON.parse`, and `PayloadDataType.ARRAY_BUFFER` sets socket `binaryType` to `arraybuffer`.

## Request lifecycle

Requests can have the following statuses:

```ts
RequestStatus.Pending;
RequestStatus.Completed;
RequestStatus.Failed;
RequestStatus.Aborted;
RequestStatus.TimedOut;
```

A request is considered settled when it reaches one of these terminal states:

- `Completed`
- `Failed`
- `Aborted`
- `TimedOut`

## Transport lifecycle

Transports can have the following statuses:

```ts
TransportStatus.Disconnected;
TransportStatus.Connecting;
TransportStatus.Connected;
TransportStatus.Closing;
TransportStatus.Error;
```

## Subscriptions

Transport-level subscriptions:

```ts
transport.onMessage((id, data) => {
    console.log(id, data);
});

transport.onRequestError((id, error) => {
    console.error(id, error);
});

transport.onAbort((id) => {
    console.log('Aborted:', id);
});

transport.onSettled((id, status, error) => {
    console.log('Settled:', id, status, error);
});

transport.onError((error) => {
    console.error('Transport error:', error);
});
```

Each subscription returns an unsubscribe function:

```ts
const unsubscribe = transport.onMessage((id, data) => {
    console.log(id, data);
});

unsubscribe();
```

## Timeouts

Timeouts can be configured at builder level:

```ts
const transport = getBridgeWireBuilder<RequestData, ResponseData>()
    .withTimeout(5000)
    .build();
```

They can also be overridden per request:

```ts
transport.send(data, {
    timeout: 1000,
});
```

For Fetch, timeout aborts the underlying fetch request.

For WebSocket, timeout currently applies to the connection opening phase.

## Compatibility rules

BridgeWire validates some incompatible configuration combinations:

- `http` / `https` protocols are compatible with Fetch transport
- `ws` / `wss` protocols are compatible with WebSocket transport
- `FormData` payload type is not compatible with WebSocket transport
- `FormData` payload type is not compatible with `ws` / `wss` protocols

## Public API

Recommended public imports:

```ts
import getBridgeWireBuilder, {
    FetchCache,
    FetchCredentials,
    FetchMode,
    FetchRedirect,
    HTTPMethod,
    PayloadDataType,
    Protocol,
    RequestStatus,
    TransportStatus,
    TransportType,
} from 'bridgewire';

import type {
    BridgeWireTransportAbortCallback,
    BridgeWireTransportCallback,
    BridgeWireTransportSettledCallback,
    ErrorCallback,
    Query,
    RequestId,
    RequestOptions,
    UnsubscribeMethod,
} from 'bridgewire';
```

Internal implementation details should not be considered stable public API.

## Development

Install dependencies:

```bash
npm install
```

Run tests:

```bash
npm run test
```

Run tests in watch mode:

```bash
npm run test:watch
```

Run coverage:

```bash
npm run coverage
```

Open the local HTML coverage report:

```bash
xdg-open coverage/index.html
```

Run lint:

```bash
npm run lint
```

Format files:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

Build package:

```bash
npm run build
```

Run full local check:

```bash
npm run check
```

## CI

The project uses GitHub Actions for:

- formatting check
- ESLint
- unit tests
- coverage generation
- package build
- coverage report deployment to GitHub Pages

Coverage report:

```text
https://kuznetsovlv.github.io/bridgewire/
```

## Release workflow

This project uses Changesets.

Create a changeset:

```bash
npm run changeset
```

Version packages:

```bash
npm run version-packages
```

Release:

```bash
npm run release
```

Before publishing, review the public exports and make sure only stable API is exported.

## Project structure

```text
src/
  BridgeWireBuilder.ts
  index.ts
  types.ts

  BridgeWireTransport/
    BridgeWireTransport.ts
    FetchBridgeWireTransport.ts
    WebSocketBridgeWireTransport.ts

  Request/
    Request.ts
    FetchRequest.ts
    WebSocketRequest.ts

  utils/
    compatibilityAsserts.ts
    isArrayBufferView.ts
    subscribe.ts
    url.ts
```

## Notes

BridgeWire is still evolving. The current API is usable, but some details may change before the first stable release.

Important areas to review before publishing:

- public exports
- README examples
- generated declaration files
- package contents
- compatibility rules
- WebSocket transport semantics
- header normalization
- coverage and CI status

## License

This project is licensed under the [MIT License](./LICENSE).

## Author

Created by [Leonid Kuznetsov](https://www.linkedin.com/in/leonid-kuznetsov-651a50126/)
