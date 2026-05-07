import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import tseslint from 'typescript-eslint';
import eslintConfigPrettier from 'eslint-config-prettier';

export default defineConfig(
    js.configs.recommended,
    tseslint.configs.recommended,
    {
        rules: {
            'no-console': ['warn', {allow: ['warn', 'error']}],
            'prefer-const': 'error',
        },
    },
    {
        ignores: ['dist', 'node_modules'],
    },
    eslintConfigPrettier
);
