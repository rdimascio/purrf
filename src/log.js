import Cloudwatch from 'aws-sdk/clients/cloudwatchlogs';

export default class Logger {
	constructor(
		{
			region,
			logGroup,
			logStream,
			accessKeyId,
			secretAccessKey
		} = {}) {
		this._region = region;
		this._logGroup = logGroup;
		this._logStream = logStream;
		this._accessKeyId = accessKeyId;
		this._secretAccessKey = secretAccessKey;

		this._token = this.token;
	}

	get token() {
		return localStorage.getItem('cw_token');
	}

	set token(token) {
		localStorage.setItem('cw_token', token);
		this._token = token;
	}

	client() {
		return new Cloudwatch({
			apiVersion: '2014-03-28',
			region: this._region,
			credentials: {
				accessKeyId: this._accessKeyId,
				secretAccessKey: this._secretAccessKey
			}
		});
	}

	/**
     * Log data to AWS CloudWatch.
     * @param {array} params - A list of objects with format:
     *  {
     *      type: <string>,
     *      performance: <object>,
     *      info: <object>
     *  }
     *
     * @returns {Promise<object>}
     */
	async log(events = []) {
		if (!events.length > 0) {
			return;
		}

		const logEvents = events.map(event => ({
			message: JSON.stringify({
				entry: 'Performance',
				type: event.type,
				name: event.info.name,
				device: event.device,
				performance: event.performance,
				info: event.info
			}),
			timestamp: Date.now()
		}));

		const parameters = {
			logEvents,
			logGroupName: this._logGroup,
			logStreamName: this._logStream
		};

		if (this._token) {
			parameters.sequenceToken = this._token;
		}

		return new Promise(resolve => {
			try {
				// Create a new log event using `putLogEvents()`.
				// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#putLogEvents-property
				this.client().putLogEvents(parameters, (error, data) => {
					// If the request fails, it's most likely due to the wrong
					// sequence token, so we need to parse the error message
					// to get the correct token.
					if (
						error &&
                        error.code === 'InvalidSequenceTokenException' &&
                        error.message.includes('The next expected sequenceToken is')
					) {
						// `match()` returns an array, and our token is going to be
						// item 1, so we can use destructuring to save the new token.
						// Notice the comma is taking up item 0.
						[,
							this._token] = error.message.match(/The next expected sequenceToken is: (\w+)/);

						// Now that we have the correct token,
						// we can resolve our promise with a new promise.
						resolve(
							this.log(events)
						);
					} else if (error) {
						throw new Error(error);
					} else {
						console.log(`Successfully logged ${events.length} performance entries 🎉`);

						this.token = data.nextSequenceToken;
						resolve(data);
					}
				});
			} catch (error) {
				throw new Error(error);
			}
		});
	}
}
