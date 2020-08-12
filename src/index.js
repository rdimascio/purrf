/* eslint-disable no-mixed-spaces-and-tabs */

import Logger from './log';
import round from './helpers/round';
import autoBind from 'auto-bind';

export default class Purrf {
	constructor(parameters) {
		autoBind(this);

		const defaultParameters = {
			include: [], // {string[]}
			exclude: [], // {string[]}
			config: {}, // {object}
			types: ['resource', 'navigation', 'paint'], // {string[]} - accepted values are: resource|navigation|paint

			// if `!config`, this param will handle the format
			// of the metrics when logging to the console.
			format: 'json', // {string} - one of string|json|table|csv
			log: true
		};

		this.params = {
			...defaultParameters,
			...parameters
		};

		this._entries = [];
		this._hasLogged = false;
		this._logger =
			this.params.log && Object.keys(this.params.config).length > 0 ?
				this.config() :
				console;

		setTimeout(this.start);
		this._watch();
	}

	/**************************************/
	/** ******* Private methods ************/
	/**************************************/

	/**
	 * Configure AWS CloudWatch credentials.
	 * @returns {object}
	 */
	config() {
		const {
			region,
			logGroup,
			logStream,
			accessKeyId,
			secretAccessKey
		} = this.params.config;

		return region && logGroup && logStream && accessKeyId && secretAccessKey ?
			new Logger({
				region,
				logGroup,
				logStream,
				accessKeyId,
				secretAccessKey
			  }) :
			this._logger;
	}

	/**
	 * Get all performance entries.
	 * @returns {object[]}
	 */
	get entries() {
		return this._entries;
	}

	/**
	 * Update performance entries.
	 * @param {object[]} entries - A list of performance entries.
	 * @returns {void}
	 */
	set entries(entries) {
		const newSet = [...this._entries, ...entries];

		this._entries = newSet.filter(
			(entry, index, entries) =>
				entries.findIndex(
					item =>
						item.name === entry.name &&
						item.performance.start === entry.performance.start
				) === index
		);
	}

	getEntries() {
		const response = {
			string: this._formatMessage,
			table: this._formatTable,
			csv: this._formatCsv
		};

		const output = this.entries.map((entry, index) =>
			response[this.params.format] ?
				response[this.params.format](entry, index) :
				entry
		);

		return this.params.format === 'csv' || this.params.format === 'string' ?
			output.join('') :
			output;
	}

	log() {
		this._hasLogged = true;
		this._logger[
			Object.prototype.hasOwnProperty.call(this._logger, 'table') &&
			this.params.format === 'table' ?
				'table' :
				'log'
		](this.getEntries());
	}

	/**
	 * Measure a custom mark against a resource PerformanceEntry.
	 * @param {string} name - Unique namefor measurement.
	 * @param {string} url - URL of the resource PerformanceEntry.
	 */
	measure(name, url) {
		if (!this.params.types.includes('resource')) {
			return;
		}

		const entry = this._getLatestEntryByName(url);

		if (!entry) {
			throw new ReferenceError(`${url} is not a valid PerformanceEntry`);
		}

		this.entries = [
			this._processCustomEntry({
				name,
				entry,
				url
			})
		];

		if (this._hasLogged && this.params.log) {
			this.log();
		}

		return this;
	}

	/**
	 * Get all PerformanceEntries.
	 * @returns {object}
	 */
	start() {
		this.params.types
			.filter(type => type !== 'navigation')
			.forEach(type => {
				this.entries = window.performance
					.getEntriesByType(type)
					.map(entry => this._processEntry(entry))
					.filter(Boolean);
			});

		/* eslint-disable-next-line no-unused-expressions */
		document.readyState === 'complete' ?
			this._onLoad() :
			document.addEventListener('readystatechange', this._onLoad);

		return this;
	}

	/**************************************/
	/** ******* Private methods ************/
	/**************************************/

	_formatCsv(entry, index) {
		let message =
			index === 0 ? 'Name, Duration, Request time, Render time\n' : '';

		/* eslint-disable-next-line no-return-assign */
		return (message += `${
			entry.type === 'navigation' ? window.location.href : entry.name
		}, ${this._round(
			entry.type === 'paint' ?
				entry.performance.start :
				entry.performance.duration.total ?? entry.performance.duration
		)}, ${
			entry.type === 'custom' ?
				this._round(entry.performance.duration.response) :
				0
		}, ${
			entry.type === 'custom' ?
				this._round(entry.performance.duration.render) :
				0
		}\n`);
	}

	_formatMessage(entry) {
		if (entry.type === 'navigation') {
			return `Document plus resources took ${this._round(
				entry.performance.dom.complete
			)} seconds. Document content took ${this._round(
				entry.performance.dom.contentLoaded
			)} seconds.\n`;
		}

		if (entry.type === 'custom') {
			return `${entry.name} finished in ${this._round(
				entry.performance.duration.total
			)} seconds. Response took ${this._round(
				entry.performance.duration.response
			)} seonds. Render took ${this._round(
				entry.performance.duration.render
			)} seconds.\n`;
		}

		return `${entry.name || window.location.href} took ${this._round(
			entry.type === 'paint' ?
				entry.performance.start :
				entry.performance.duration
		)} seconds.\n`;
	}

	/* eslint-disable-next-line no-unused-vars */
	_formatTable(entry, index) {
		const data = {
			name: entry.type === 'navigation' ? window.location.href : entry.name,
			duration: this._round(
				entry.type === 'paint' ?
					entry.performance.start :
					entry.performance.duration
			)
		};

		const customData = {
			duration: this._round(entry.performance.duration.total),
			response: this._round(entry.performance.duration.response),
			render: this._round(entry.performance.duration.render)
		};

		return {
			...data,
			...(entry.type === 'custom' ? customData : {})
		};
	}

	/**
	 * Get a PerformanceEntry by name.
	 * @param {string} name - A PerformanceEntry name.
	 * @returns {object}
	 */
	_getEntryByName(name) {
		return window.performance
			.getEntries()
			.filter(entry => entry.name === name)[0];
	}

	/**
	 * Get the latest PerformanceEntry by name.
	 * @param {string} name - A PerformanceEntry name.
	 * @returns {object}
	 */
	_getLatestEntryByName(name) {
		const entries = window.performance
			.getEntries()
			.filter(entry => entry.name.includes(name));

		if (!entries || !entries.length > 0) {
			return null;
		}

		return (
			entries
				// eslint-disable-next-line unicorn/no-reduce
				.reduce((previous, current) =>
					previous.responseEnd > current.responseEnd ? previous : current
				)
		);
	}

	_getResourceEntryType(entry) {
		const imageExtensions = ['jpg', 'jpeg', 'png', 'svg', 'gif'];

		const entryTypes = {
			xmlhttprequest: 'XHR',
			fetch: 'XHR',
			img: 'Image',
			link: 'Style',
			css: 'Style',
			script: 'Script'
		};

		const entryExtension = entry.name.split('.').pop();

		if (imageExtensions.includes(entryExtension)) {
			return entryTypes.img;
		}

		return entryTypes[entry.initiatorType] || 'Other';
	}

	/**
	 * Get browser data from `window.navigator`
	 * @returns {object}
	 */
	_getDeviceInfo() {
		return {
			agent: window.navigator.userAgent,
			online: window.navigator.onLine,
			connection: window.navigator.connection?.effectiveType ?? undefined,
			cookies: window.navigator.cookieEnabled,
			language: window.navigator.language,
			ram: window.navigator.deviceMemory ?? undefined,
			cpu: window.navigator.hardwareConcurrency ?? undefined
		};
	}

	/**
	 * Callback for PerformanceObserver.
	 * @param {*} list - PerformanceObserverEntryList.
	 */
	_handlePerformanceEntries(list) {
		this.entries = list
			.getEntries()
			.map(entry => this._processEntry(entry))
			.filter(Boolean);
	}

	_onLoad() {
		if (document.readyState !== 'complete') {
			return;
		}

		setTimeout(() => {
			this.entries = window.performance
				.getEntriesByType('navigation')
				.map(entry => this._processEntry(entry));

			if (this.params.log) {
				this.log();
			}
		}, 1000);
	}

	_processCustomEntry({entry, name, url} = {}) {
		const now = performance.now();
		const start = entry.startTime;
		const end =
			entry.entryType === 'resource' ?
				entry.responseEnd :
				entry.startTime + entry.duration;
		const totalTime = now - start;
		const responseTime = entry.duration;
		const renderTime = now - end;

		return {
			type: 'custom',
			name,
			device: this._getDeviceInfo(),
			performance: {
				url,
				start,
				end: now,
				duration: {
					total: totalTime,
					response: responseTime,
					render: renderTime
				}
			}
		};
	}

	/**
	 * Process the performance entry.
	 * @param {object} entry - A PerformanceEntry object.
	 * @returns {object}
	 */
	_processEntry(entry) {
		// If the `include` argument exists, exclude everything except
		// the URLs that are included.
		if (this.params.include.length > 0) {
			const match = this.params.include.some(inclusion =>
				entry.name.includes(inclusion)
			);

			if (!match) {
				return;
			}
		}

		// If the `exclude` argument exists, include everything except
		// the URLs that are excluded.
		if (this.params.exclude.length > 0) {
			if (this.params.exclude.includes(entry.name)) {
				return;
			}

			const match = this.params.exclude.some(exclusion =>
				entry.name.includes(exclusion)
			);

			if (match) {
				return;
			}
		}

		const data = {
			details: entry.toJSON(),
			device: this._getDeviceInfo(),
			name: entry.name,
			performance: {
				duration: entry.duration,
				start: entry.startTime
			},
			type: entry.entryType
		};

		if (entry.entryType === 'resource') {
			// Don't include any map files.
			if (entry.name.includes('.map')) {
				return;
			}

			// Don't include requests to AWS CloudWatch
			if (
				entry.name ===
				`https://logs.${this.params.config.region}.amazonaws.com/`
			) {
				return;
			}

			return {
				...data,
				name: entry.name || window.location.href,
				resourceType: this._getResourceEntryType(entry),
				performance: {
					...data.performance,
					size: entry.transferSize,
					response: {
						start: entry.responseStart,
						end: entry.responseEnd
					}
				}
			};
		}

		if (entry.entryType === 'navigation') {
			return {
				...data,
				readyState: document.readyState,
				navigationType: entry.type,
				performance: {
					...data.performance,
					size: entry.transferSize,
					dom: {
						complete: entry.domComplete,
						contentLoaded: entry.domContentLoadedEventStart,
						interactive: entry.domInteractive
					}
				}
			};
		}

		if (entry.entryType === 'paint') {
			return data;
		}
	}

	_round(number) {
		return round(number / 1000, 3);
	}

	/**
	 * Observe new resource PerformanceEntries.
	 * @returns {object}
	 */
	_watch() {
		const PERFORMANCE_OBSERVER = new PerformanceObserver(list =>
			this._handlePerformanceEntries(list)
		);

		PERFORMANCE_OBSERVER.observe({entryTypes: [...this.params.types]});

		return this;
	}
}
