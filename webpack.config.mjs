import path from 'node:path';
import {createRequire} from 'node:module';
const require = createRequire(import.meta.url);

export default function webpackConfig({rootDir, outputDir, mode}) {
  return {
    context: rootDir,
    mode,
    target: 'browserslist',
    entry: {main: './src/js/index.js'},
    output: {
      path: path.join(outputDir, 'js'),
      filename: '[name].js',
      chunkFilename: 'chunks/[name].[contenthash:8].js',
      publicPath: 'auto',
      clean: true
    },
    devtool: mode === 'development' ? 'source-map' : false,
    optimization: {splitChunks: {chunks: 'async'}, runtimeChunk: false, emitOnErrors: false},
    module: {rules: [{
      test: /\.js$/,
      exclude: /node_modules/,
      use: {
        loader: require.resolve('babel-loader'),
        options: {
          babelrc: false,
          configFile: false,
          presets: [[require.resolve('@babel/preset-env'), {modules: false}]]
        }
      }
    }]},
    resolve: {alias: {
      '%modules%': path.join(rootDir, 'src/blocks/modules'),
      '%components%': path.join(rootDir, 'src/blocks/components')
    }}
  };
}
