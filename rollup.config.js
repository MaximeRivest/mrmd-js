import { nodeResolve } from '@rollup/plugin-node-resolve';

export default [
  // ESM bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.js',
      format: 'esm',
      sourcemap: true,
    },
    plugins: [nodeResolve()],
  },
  // CJS bundle
  {
    input: 'src/index.js',
    output: {
      file: 'dist/index.cjs',
      format: 'cjs',
      sourcemap: true,
    },
    plugins: [nodeResolve()],
  },
  // IIFE bundle for browser <script> tags
  {
    input: 'src/index.js',
    output: {
      file: 'dist/mrmd-js.iife.js',
      format: 'iife',
      name: 'mrmdJs',
      sourcemap: true,
    },
    plugins: [nodeResolve()],
  },
];
