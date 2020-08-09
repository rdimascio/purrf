'use strict';

/* eslint-disable-next-line import/no-extraneous-dependencies */
const path = require('path');
const webpack = require('webpack');
const TerserPlugin = require('terser-webpack-plugin');

// Export a function instead of an object so
// we can access the `mode` argument.
// https://webpack.js.org/configuration/mode/
module.exports = (env, argv) => {
	const DEV = argv.mode === 'development';

	return {
		target: 'web',
		performance: {
			hints: false
		},
		entry: [
			'core-js/stable',
			'regenerator-runtime/runtime',
			path.resolve(__dirname, 'src/index.js')
		],
		output: {
			path: path.resolve(__dirname, 'dist'),
			filename: DEV ? 'index.js' : 'index.min.js',
			libraryTarget: 'umd',
			library: 'Purrf',
			// Prevents webpack from referencing `window` in the UMD build
			// Source: https://git.io/vppgU
			globalObject: 'typeof self !== \'undefined\' ? self : this'
		},
		devtool: 'source-map',
		module: {
			rules: [
				{
					test: /\.js$/,
					exclude: /node_modules/,
					loader: 'babel-loader',
					options: {
						presets: [['@babel/env', {modules: 'commonjs'}]],
						plugins: ['add-module-exports', '@babel/plugin-syntax-dynamic-import']
					}
				}
			]
		},
		optimization: {
			minimize: !DEV,
			minimizer: [
				new TerserPlugin({
					terserOptions: {
						compress: {
							warnings: false
						},
						output: {
							comments: false
						}
					},
					extractComments: false
				})
			]
		},
		plugins: [
			!DEV &&
				new webpack.HashedModuleIdsPlugin()
		].filter(Boolean)
	};
};
