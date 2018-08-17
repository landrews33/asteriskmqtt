var winston = require('winston');
var _ = require('lodash');
const config_schema = "";
	

var config = {
		prefix: "",
		no_log_files: 10,
		maxsize: 1024000
};


const config_path = 'logging'

exports.setup = function setup(app, app_config)
{
	_.assign(config, app_config[config_path]);
	//TODO: Ensure prefix includes trailing flash if empty.
}


exports.createLog = function createLog(name)
{
	return winston.createLogger({
		transports : [ new (winston.transports.File)({
			filename : config.prefix + name + '.log',
			maxsize : config.maxsize,
			maxFiles : config.no_log_files,
			tailable : true,
			zippedArchive : true
		}) ]
	});
}

