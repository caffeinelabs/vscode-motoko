import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import jest from 'eslint-plugin-jest';

export default [
    {
        ignores: [
            'node_modules/',
            'out/',
            'dist/',
            '__mocks__/',
            'scripts/',
            'test/',
        ],
    },
    {
        files: ['**/*.ts'],
        ...eslint.configs.recommended,
    },
    ...tseslint.configs.recommended.map((config) => ({
        ...config,
        files: ['**/*.ts'],
    })),
    {
        files: ['**/*.ts'],
        rules: {
            'no-extra-semi': 'warn',
            'prefer-const': 'warn',
            '@typescript-eslint/no-explicit-any': 'off',
            '@typescript-eslint/no-unused-vars': 'off',
            '@typescript-eslint/no-empty-object-type': 'off',
            '@typescript-eslint/no-require-imports': 'off',
        },
    },
    {
        files: ['**/*.spec.ts'],
        ...jest.configs['flat/recommended'],
        rules: {
            ...jest.configs['flat/recommended'].rules,
            'jest/no-commented-out-tests': 'off',
        },
    },
];
