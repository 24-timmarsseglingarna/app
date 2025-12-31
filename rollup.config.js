import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import terser from '@rollup/plugin-terser';
import eslint from '@rollup/plugin-eslint';
import replace from '@rollup/plugin-replace';

const isProd = process.env.NODE_ENV === 'production';
const isWebApp = process.env.WEBAPP === '1';

export default {
  input: './src/js/main.js',
  output: {
    file: 'build/24h.js',
    format: 'iife',
    name: 'tf',
    inlineDynamicImports: true
  },
  plugins: [
    replace({
      preventAssignment: true,
      __WEBAPP__: JSON.stringify(isWebApp),
    }),

    nodeResolve(),
    commonjs(),
    eslint(),

    isProd && terser({
      compress: {
        dead_code: true,
        side_effects: false // w/o this the map isn't displayed...
      }
    }),
  ].filter(Boolean)
};

/*

import nodeResolve from '@rollup/plugin-node-resolve';
import commonjs from '@rollup/plugin-commonjs';
import uglify from 'rollup-plugin-uglify';
import eslint from '@rollup/plugin-eslint';
import jscc from 'rollup-plugin-jscc';

export default {
    input: './src/js/main.js',
    output: {
        file: 'build/24h.js',
        format: 'iife',
        name: 'tf',
        inlineDynamicImports: true
    },
    plugins: [
        nodeResolve(),
        commonjs(),
        eslint(), // see .eslintrc.js
        (process.env.NODE_ENV === 'production' && uglify.uglify({compress:{
            // FIXME: the setting below doesn't help!
            side_effects: false // w/o this the map isn't displayed...
        }})),
        (process.env.WEBAPP === '1' && jscc({
                values: { _WEBAPP: 1 },
         })),
    ]
};
*/
