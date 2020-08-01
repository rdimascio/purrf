import Logger from './log';
import autoBind from 'auto-bind';

export default class Purrf {
	constructor({include = [], exclude = [], config = {}} = {}) {
		autoBind(this);

		this._config = config;
		this._include = include;
		this._exclude = exclude;

		this._logger = console;

		if (Object.keys(this._config).length > 0) {
			this.config();
		}

		this.start();
		this.watch();
	}

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
		} = this._config;

		if (region && logGroup && logStream && accessKeyId && secretAccessKey) {
			this._logger = new Logger({
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
	 * Get all PerformanceEntries.
	 * @returns {object}
	 */
	start() {
		this._logger.log(
			window.performance.getEntriesByType('resource').map(
				entry => this._processEntry(entry)
			)
		);

		return this;
	}

	/**
	 * Observe new resource PerformanceEntries.
	 * @returns {object}
	 */
	watch() {
		const PERFORMANCE_OBSERVER = new PerformanceObserver(
			list => this._handlePerformanceEntries(list)
		);

		PERFORMANCE_OBSERVER.observe({type: 'resource'});

		return this;
	}

	/**
	 * Measure a custom mark against a resource PerformanceEntry.
	 * @param {string} name - Unique namefor measurement.
	 * @param {string} url - URL of the resource PerformanceEntry.
	 */
	measure(name, url) {
		const now = performance.now();
		const resource = this._getEntryByName(url);

		if (!resource) {
			throw new ReferenceError(`${url} is not a valid PerformanceEntry`);
		}

		const start = resource.startTime;
		const end =
			resource.entryType === 'resource' ?
				resource.responseEnd :
				resource.startTime + resource.duration;

		this._logger.log({
			entry: 'Performance',
			type: 'Custom',
			name,
			device: this._getDeviceInfo(),
			performance: {
				url,
				start,
				end: now,
				duration: {
					total: now - start,
					response: now - end
				}
			}
		});

		return this;
	}

	/**
	 * Get a PerformanceEntry by name.
	 * @param {string} name - A PerformanceEntry name.
	 */
	_getEntryByName(name) {
		return window.performance
			.getEntries()
			.filter(entry => entry.name === name)[0];
	}

	_getEntryType(entry) {
		const imageExtensions = ['jpg', 'jpeg', 'png', 'svg', 'gif'];

		const entryTypes = {
			xmlhttprequest: 'XML',
			fetch: 'XML',
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
		this._logger.log(list.getEntries()
			.map(entry => this._processEntry(entry))
			.filter(Boolean));
	}

	/**
	 * Process the performance entry.
	 * @param {object} entry - A PerformanceEntry object.
	 * @returns {object}
	 */
	_processEntry(entry) {
		// If the `include` argument exists, exclude everything except
		// the URLs that are included.
		if (this._include.length > 0 && !this._include.includes(entry.name)) {
			return;
		}

		// If the `exclude` argument exists, include everything except
		// the URLs that are excluded.
		if (this._exclude.length > 0 && this._exclude.includes(entry.name)) {
			return;
		}

		// Don't include any map files.
		if (entry.name.includes('.map')) {
			return;
		}

		// Don't include requests to AWS CloudWatch
		if (entry.name === `https://logs.${this._config.region}.amazonaws.com/`) {
			return;
		}

		return {
			type: this._getEntryType(entry),
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
			device: this._getDeviceInfo(),
			info: entry
		};
	}
}
