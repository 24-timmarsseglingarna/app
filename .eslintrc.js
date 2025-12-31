module.exports = {
    "env": {
        "browser": true,
        "es6": true
    },
    "extends": "eslint:recommended",
    "parserOptions": {
        "ecmaVersion": 2015,
        "sourceType": "module"
    },
    "globals": {
        "$": true,
        "moment": true,
        // from cordova
        "Connection": true,
        "SafariViewController": true,
        "device": true,
        // from pod.js
        "basePodSpec": true,
        // frm rollup.config.js
        __WEBAPP__: 'readonly'
    },
    "rules": {
        // don't warn about console.log
        "no-console": 0,
        "no-extra-semi": 0, // FIXME, git sed
        "no-redeclare": ["error", { "builtinGlobals": true }],
        "indent": [
            "error",
            4,
            {"FunctionDeclaration": {"parameters": "first"},
             "CallExpression": {"arguments": "first"},
             "ObjectExpression": "first",
             "ArrayExpression": "first",
             "ImportDeclaration": "first",
             "ignoreComments": true
            }
        ],
        "linebreak-style": [
            "error",
            "unix"
        ],
        "quotes": [
            "error",
            "single"
        ],
        "semi": [
            "error",
            "always"
        ]
    }
};
