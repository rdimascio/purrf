/* eslint-disable no-undef, unicorn/no-nested-ternary, unicorn/explicit-length-check, unicorn/no-fn-reference-in-iterator, new-cap, import/no-anonymous-default-export */

import Logger from './log';

export default class {
	constructor({include = [], exclude = [], config = {}} = {}) {
		this._config = config;
		this._include = include;
		this._exclude = exclude;

		this._logger = console;

		if (Object.keys(this._config).length) {
			this.config();
		}

		this.start();
		this.watch();
	}

	/**
	 * @returns {object}
	 */
	config() {
		const {
			region,
			logGroup,
			logStream,
			accessKeyId,
			secretAccessKey
		} = this._config;

		if (region && logGroup && logStream && accessKeyId && secretAccessKey) {
			this._logger = Logger({
				region,
				logGroup,
				logStream,
				accessKeyId,
				secretAccessKey
			});
		}

		return this;
	}

	/**
	 * @returns {object}
	 */
	start() {
		this._logger.log(
			window.performance.getEntriesByType('resource').map(this._processEntry)
		);

		return this;
	}

	/**
	 * @returns {object}
	 */
	watch() {
		const PERFORMANCE_OBSERVER = new PerformanceObserver(
			this._handlePerformanceEntries
		);

		PERFORMANCE_OBSERVER.observe({type: 'resource'});

		return this;
	}

	// Private methods

	_handlePerformanceEntries(list) {
		this._logger.log(list.getEntries().map(this._processEntry));
	}

	/**
	 * Process the performance entry.
	 * @param {object} entry - A PerformanceEntry object
	 * @returns {object}
	 */
	_processEntry(entry) {
		// If the `include` argument exists, exclude everything except
		// the URLs that are included.
		if (this._include.length && !this._include.includes(entry.name)) {
			return;
		}

		// If the `exclude` argument exists, include everything except
		// the URLs that are excluded.
		if (this._exclude.length && this._exclude.includes(entry.name)) {
			return;
		}

		// Don't include any map files.
		if (entry.name.includes('.map')) {
			return;
		}

		// Don't include requests to AWS CloudWatch
		if (
			Object.prototype.hasOwnProperty.call(this._logger, 'client') &&
			entry.name === `https://logs.${this._config.region}.amazonaws.com/`
		) {
			return;
		}

		return {
			type:
				entry.initiatorType === 'xmlhttprequest' ||
				entry.initiatorType === 'fetch' ?
					'XML' :
					entry.initiatorType === 'img' ||
                        entry.name.includes('.jpg') ||
                        entry.name.includes('.jpeg') ||
                        entry.name.includes('.png') ||
                        entry.name.includes('.svg') ?
						'Image' :
						entry.initiatorType === 'link' || entry.initiatorType === 'css' ?
							'Style' :
							entry.initiatorType === 'script' ?
								'Script' :
								'Other',
			performance: {
				url: entry.name,
				start: entry.startTime,
				duration: entry.duration,
				size: entry.transferSize,
				response: {
					start: entry.responseStart,
					end: entry.responseEnd
				}
			},
			device: {
				agent: window.navigator.userAgent,
				connection: window.navigator.connection.effectiveType,
				cookies: window.navigator.cookieEnabled,
				language: window.navigator.language,
				ram: window.navigator.deviceMemory ?? undefined,
				cpu: window.navigator.hardwareConcurrency ?? undefined
			},
			info: entry
		};
	}
}
