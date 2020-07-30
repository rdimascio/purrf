import Cloudwatch from 'aws-sdk/clients/cloudwatchlogs';

const Logger = (({
	region,
	logGroup,
	logStream,
	accessKeyId,
	secretAccessKey
} = {}) => {
	let SEQUENCE_TOKEN = null;

	const client = new Cloudwatch({
		apiVersion: '2014-03-28',
		region,
		credentials: {
			accessKeyId,
			secretAccessKey
		}
	});

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
	const log = async (events = []) => {
		const logEvents = events.map(event => ({
			message: JSON.stringify({
				entry: 'Performance',
				type: event.type,
				device: event.device,
				performance: event.performance,
				info: event.info
			}),
			timestamp: Date.now()
		}));

		const parameters = {
			logEvents,
			logGroup,
			logStream
		};

		if (SEQUENCE_TOKEN) {
			parameters.sequenceToken = SEQUENCE_TOKEN;
		}

		return new Promise(resolve => {
			try {
				// Create a new log event using `putLogEvents()`.
				// https://docs.aws.amazon.com/AWSJavaScriptSDK/latest/AWS/CloudWatchLogs.html#putLogEvents-property
				client.putLogEvents(parameters, (error, data) => {
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
							SEQUENCE_TOKEN] = error.message.match(/The next expected sequenceToken is: (\w+)/);

						// Now that we have the correct token,
						// we can resolve our promise with a new promise.
						resolve(
							log({events})
						);
					} else {
						SEQUENCE_TOKEN = data.nextSequenceToken;
						resolve(data);
					}
				});
			} catch (error) {
				throw new Error(error);
			}
		});
	};

	return {
		client,
		log
	};
})();

export default Logger;
