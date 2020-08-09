/* eslint-disable no-mixed-spaces-and-tabs */

import Logger from './log';
import round from './helpers/round';
import autoBind from 'auto-bind';

export default class Purrf {
	constructor(parameters) {
		autoBind(this);

		const defaultParameters = {
			include: [],
			exclude: [],
			config: {},
			types: ['resource', 'navigation', 'paint'],
			pretty: false
		};

		this.params = {
			...defaultParameters,
			...parameters
		};

		this._logger = console;

		if (Object.keys(this.params.config).length > 0) {
			this.config();
		}

		setTimeout(this.start);
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
		} = this.params.config;

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
		this.params.types
			.filter(type => type !== 'navigation')
			.forEach(type => {
				window.performance
					.getEntriesByType(type)
					.map(entry => this._processEntry(entry))
					.filter(Boolean)
					.forEach(entry => {
						this._logger.log(entry);
					});
			});

		window.addEventListener('load', () => {
			if (!this.params.types.includes('navigation')) {
				return;
			}

			window.performance
				.getEntriesByType('navigation')
				.map(entry => this._processEntry(entry))
				.forEach(entry => {
					this._logger.log(entry);
				});
		});

		return this;
	}

	/**
	 * Observe new resource PerformanceEntries.
	 * @returns {object}
	 */
	watch() {
		const PERFORMANCE_OBSERVER = new PerformanceObserver(list =>
			this._handlePerformanceEntries(list)
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
		if (!this.params.types.includes('resource')) {
			return;
		}

		const now = performance.now();
		const resource = this._getLatestEntryByName(url);

		if (!resource) {
			throw new ReferenceError(`${url} is not a valid PerformanceEntry`);
		}

		const start = resource.startTime;
		const end =
			resource.entryType === 'resource' ?
				resource.responseEnd :
				resource.startTime + resource.duration;
		const totalTime = now - start;
		const responseTime = resource.duration;
		const processingTime = now - end;

		const message = this.params.pretty ?
			`"${name}" finished in ${round(
				totalTime / 1000,
				3
			  )} seconds. Response took ${round(
				responseTime / 1000,
				3
			  )} seconds. Processing took ${round(processingTime / 1000, 3)} seconds.` :
			{
				entry: 'Performance',
				type: 'Custom',
				name,
				device: this._getDeviceInfo(),
				performance: {
					url,
					start,
					end: now,
					duration: {
						total: totalTime,
						response: responseTime,
						processing: processingTime
					}
				}
			  };

		this._logger.log(message);

		return this;
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

		if (!entries) {
			return null;
		}

		return (
			entries
				// eslint-disable-next-line unicorn/no-reduce
				.reduce((previous, current) =>
					previous.startTime > current.startTime ? previous : current
				)
		);
	}

	_getResourceEntryType(entry) {
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
		list
			.getEntries()
			.map(entry => this._processEntry(entry))
			.filter(Boolean)
			.forEach(entry => this._logger.log(entry));
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

		const message = (name, duration = entry.duration) =>
			`${name} took ${round(duration / 1000, 3)} seconds.`;
		const data = {
			type: entry.entryType,
			performance: {
				url: entry.name,
				start: entry.startTime,
				duration: entry.duration
			},
			device: this._getDeviceInfo(),
			info: entry.toJSON()
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

			return this.params.pretty ?
				message(entry.name) :
				{
					...data,
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
			return this.params.pretty ?
				message(entry.name || window.location.href) :
				{
					...data,
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
			return this.params.pretty ?
				message(entry.name || window.location.href, entry.startTime) :
				data;
		}
	}
}
