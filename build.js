const esbuild = require('esbuild');
const path = require('path');

const isWatch = process.argv.includes('--watch');

const buildOptions = {
  entryPoints: [path.join(__dirname, 'webview', 'index.jsx')],
  bundle: true,
  outfile: path.join(__dirname, 'webview', 'bundle.js'),
  platform: 'browser',
  target: 'es2020',
  format: 'iife',
  loader: {
    '.jsx': 'jsx'
  },
  jsx: 'automatic',
  define: {
    'process.env.NODE_ENV': '"production"'
  },
  minify: !isWatch,
  sourcemap: isWatch
};

async function build() {
  try {
    if (isWatch) {
      const ctx = await esbuild.context(buildOptions);
      await ctx.watch();
      console.log('Watching for changes...');
    } else {
      await esbuild.build(buildOptions);
      console.log('Build complete!');
    }
  } catch (error) {
    console.error('Build failed:', error);
    process.exit(1);
  }
}

build();
