# BridgeWire

**BridgeWire** is a transport-agnostic client for HTTP and WebSocket communication.

> ⚠️ BridgeWire is currently in early development! The public API is not stable yet.

The goal of the project is to provide a unified interface for sending requests over different transports, such as Fetch and WebSocket, with a clean and extensible architecture.

## Features

Planned features:

- Unified API for HTTP Fetch and WebSocket
- Adapter-based architecture
- Request/response abstraction
- Error handling
- Request cancellation
- Extensible transport layer
- Optional reactive layer with RxJS in the future

## Getting started

Install dependencies:

```bash
npm install
```

## Development

Run tests in watch mode:

```bash
npm run test:watch
```

Run tests once:

```bash
npm run test
```

## Build

Build the library:

```bash
npm run build
```

This will:

- clean the `dist` folder
- build ESM and CJS bundles using Vite
- generate TypeScript declaration files

## Lint and format

Run ESLint:

```bash
npm run lint
```

Format code:

```bash
npm run format
```

Check formatting:

```bash
npm run format:check
```

## Full check

Run all checks:

```bash
npm run check
```

Includes:

- lint
- format check
- tests
- build

## Project structure

```text
src/
  index.ts
  index.test.ts
dist/
```

## Architecture

BridgeWire is designed around the idea of transport abstraction:

- Fetch transport
- WebSocket transport
- Unified client interface

More details will be added as the implementation evolves.

## License

This project is licensed under the [MIT License](./LICENSE).
