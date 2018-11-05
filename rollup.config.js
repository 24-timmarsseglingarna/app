import resolve from 'rollup-plugin-node-resolve';
import commonjs from 'rollup-plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import eslint from 'rollup-plugin-eslint';

export default {
    input: './src/js/main.js',
    output: {
        file: 'build/24h.js',
        format: 'iife',
        name: 'tf'
    },
    plugins: [
        resolve(),
        commonjs(),
        eslint.eslint(), // see .eslintrc.js
        (process.env.NODE_ENV === 'production' && uglify.uglify()),
    ]
};
