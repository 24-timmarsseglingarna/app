export default [
    {
        files: ['**/*.js'],
        languageOptions: {
            ecmaVersion: 2015,
            sourceType: 'module',
            globals: {
                // browser
                window: 'readonly',
                document: 'readonly',

                // your globals
                $: 'readonly',
                moment: 'readonly',

                // from cordova
                Connection: 'readonly',
                SafariViewController: 'readonly',
                device: 'readonly',

                // from pod.js
                basePodSpec: 'readonly',

                // from rollup replace
                __WEBAPP__: 'readonly',
            },
        },

        rules: {
            // eslint:recommended equivalent
            'no-console': 0,
            'no-extra-semi': 0,
            'no-redeclare': ['error', { builtinGlobals: true }],

            indent: [
                'error',
                4,
                {
                    FunctionDeclaration: { parameters: 'first' },
                    CallExpression: { arguments: 'first' },
                    ObjectExpression: 'first',
                    ArrayExpression: 'first',
                    ImportDeclaration: 'first',
                    ignoreComments: true,
                },
            ],

            'linebreak-style': ['error', 'unix'],
            quotes: ['error', 'single'],
            semi: ['error', 'always'],
        },
    },
];
