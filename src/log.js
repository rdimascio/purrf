import {AwsClient} from 'aws4fetch';

export default class Logger {
	constructor({
		region,
		logGroup,
		logStream,
		accessKeyId,
		secretAccessKey
	} = {}) {
		this._client = null;
		this._region = region;
		this._service = 'logs';
		this._logGroup = logGroup;
		this._logStream = logStream;
		this._accessKeyId = accessKeyId;
		this._secretAccessKey = secretAccessKey;

		this.MAX_RETRY_COUNT = 3;

		this._token = this.token;
		this._client = new AwsClient({
			accessKeyId,
			secretAccessKey,
			region,
			service: this._service
		});
	}

	get token() {
		return localStorage.getItem('cw_token');
	}

	set token(token) {
		localStorage.setItem('cw_token', token);
		this._token = token;
	}

	get client() {
		return this._client;
	}

	get headers() {
		return {
			'X-Amz-Target': 'Logs_20140328.PutLogEvents',
			Accept: 'application/json',
			'Content-Type': 'application/x-amz-json-1.1'
		};
	}

	get url() {
		return `https://${this._service}.${this._region}.amazonaws.com`;
	}

	/**
	 * Log data to AWS CloudWatch.
	 * @param {array} params - A list of objects with format:
	 *  {
	 *      type: <string>,
	 * 		nam: <string>,
	 *      performance: <object>,
	 *      details: <object>
	 *  }
	 *
	 * @returns {Promise<object>}
	 */
	async log(events = [], retryCount = 0) {
		if (!events.length > 0) {
			return;
		}

		const logEvents = events.map(event => ({
			message: JSON.stringify({
				entry: 'Performance',
				type: event.type,
				name: event.name,
				device: event.device,
				performance: event.performance,
				details: event.details
			}),
			timestamp: Date.now()
		}));

		const payload = {
			logEvents,
			logGroupName: this._logGroup,
			logStreamName: this._logStream
		};

		if (this._token) {
			payload.sequenceToken = this._token;
		}

		const options = await this.client.sign(this.url, {
			headers: this.headers,
			body: JSON.stringify(payload)
		});

		const putLogs = async resolve => {
			try {
				const request = await fetch(options);
				const response = await request.json();

				if (response.nextSequenceToken) {
					console.log(
						`Successfully logged ${events.length} performance entries 🎉`
					);

					this.token = response.nextSequenceToken;
					resolve(response);
				} else {
					const token = response.expectedSequenceToken;

					if (token) {
						this.token = token;
						resolve(this.log(events, ++retryCount));
					} else {
						console.error(response);
					}
				}
			} catch (error) {
				throw new Error(error);
			}
		};

		return retryCount > this.MAX_RETRY_COUNT ?
			Promise.resolve(null) :
			new Promise(putLogs);
	}
}
