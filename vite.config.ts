import {dirname, resolve} from 'node:path';
import {fileURLToPath} from 'node:url';
import {defineConfig} from 'vitest/config';
import dts from 'vite-plugin-dts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

export default defineConfig({
    plugins: [
        dts({
            entryRoot: 'src',
            outDirs: ['dist'],
            include: ['src'],
            exclude: ['src/**/*.test.ts', 'src/**/*.spec.ts'],
        }),
    ],
    build: {
        emptyOutDir: true,
        lib: {
            entry: resolve(__dirname, 'src/index.ts'),
            name: 'BridgeWire',
            fileName: 'bridgewire',
            formats: ['es', 'cjs'],
        },
        sourcemap: true,
    },
    test: {
        environment: 'node',
    },
});
