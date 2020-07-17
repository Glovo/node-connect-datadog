const hotShots = require("hot-shots");

module.exports = function (options) {
	const datadog = options.dogstatsd || new hotShots.StatsD("localhost", 8125);
	const stat = options.stat || "node.express.router";
	const tags = options.tags || [];
	const path = options.path || false;
	const base_url = options.base_url || false;
	const method = options.method || false;
	const protocol = options.protocol || false;
	const response_code = options.response_code || false;
	const DELIM = options.delim || '-';
	const REGEX_PIPE = /\|/g;
	const route_name_mapper = options.route_name_mapper || null

	/**
	 * Checks if str is a regular expression and stringifies it if it is.
	 * Returns a string with all instances of the pipe character replaced with
	 * the delimiter.
	 * @param  {*}       str  The string to check for pipe chars
	 * @return {string}       The input string with pipe chars replaced
	 */
	function replacePipeChar(str) {
		if (str instanceof RegExp) {
			str = str.toString();
		}

		return str && str.replace(REGEX_PIPE, DELIM);
	}

	function getRoute(req, base_url) {
		const routePath = req.route && req.route.path ? req.route.path : '';
		const baseUrl = (base_url !== false) ? req.baseUrl : '';
		return baseUrl + replacePipeChar(routePath);
	}

	return function (req, res, next) {
		if (!req._startTime) {
			req._startTime = new Date();
		}

		let end = res.end;
		res.end = function (chunk, encoding) {
			res.end = end;
			res.end(chunk, encoding);

			let statTags = [...tags];
			
			const route = getRoute(req, base_url);
			if (route.length > 0) {
				statTags.push(`route:${route}`);
			}

			if (method !== false) {
				statTags.push(`method:${req.method.toLowerCase()}`);
			}

			if (protocol && req.protocol) {
				statTags.push(`protocol:${req.protocol}`);
			}

			if (path !== false) {
				statTags.push(`path:${req.path}`);
			}

			if (route_name_mapper !== null && typeof route_name_mapper === 'function') {
				const routeName = route_name_mapper(req.path)
				statTags.push(`route_name:${routeName}`)
			}

			if (response_code) {
				statTags.push(`response_code:${res.statusCode}`);
				datadog.increment(`${stat}.response_code.${res.statusCode}`, 1, statTags);
				datadog.increment(`${stat}.response_code.all`, 1, statTags);
			}

			datadog.histogram(`${stat}.response_time`, new Date() - req._startTime, 1, statTags);
		};

		next();
	};
};
