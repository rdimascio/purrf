/* eslint-disable import/no-anonymous-default-export */

import path from 'path';
import {uglify} from 'rollup-plugin-uglify';
import {getBabelOutputPlugin} from '@rollup/plugin-babel';

import pkg from './package.json';

const config = {
	input: 'src/index.js',
	plugins: [],
	output: {
		exports: 'default',
		sourcemap: true
	}
};

const umd = {
	...config,
	output: {
		...config.output,
		file: pkg.unpkg,
		format: 'umd',
		name: pkg.name
	},
	plugins: [
		...config.plugins,
		getBabelOutputPlugin({
			configFile: path.resolve(__dirname, '.babelrc'),
			allowAllFormats: true
		}),
		uglify({
			compress: {
				pure_getters: true, // eslint-disable-line camelcase
				unsafe: true,
				unsafe_comps: true // eslint-disable-line camelcase
			}
		})
	]
};

const web = {
	...config,
	output: [
		{
			...config.output,
			file: pkg.main,
			format: 'cjs'
		},
		{
			...config.output,
			file: pkg.module,
			format: 'es'
		}
	]
};

export default [umd, web];
