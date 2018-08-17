var config = require('./config.json');
var config_schema = require('./schema_config.json');
var winston = require('winston');
var _ = require('lodash');
/**

try {
	var validate = require('jsonschema').validate;
	validate(config, config_schema, {
		"throwError" : true
	});
	lines = config.lines;
	consoleLog.info("Creating Channel Map");
	// Populate channel map so we can determine which line a Dial event belongs
	// to.
	for (var i = 0; i < lines.length; i++) {
		channelMap[lines[i].channel] = lines[i];
	}
} catch (err) {
	console.log(err.message);
	process.exit(1);
}

**/
var deps = {};
var devices = {};

deps.configgen = function(type, friendly_name, unit, value_template)
{
	var device_config = {};
	//device_config.device_class = type;
	device_config.name = friendly_name;
	if(unit)
	{
		device_config.unit_of_measurement = unit;
	}
	if(value_template)
	{
		device_config.value_template = value_template;
	}
	return JSON.stringify(device_config);
}
deps.logger = require('./core/logging');
deps.logger.setup(deps, config);

deps.consoleLog = deps.logger.createLog('mqtthub');
deps.mqtt = require('./core/mqtt');
deps.mqtt.setup(deps, config);

_.forEach(config.devices, function(device)
{
	if(!devices[device.type])
		{
		devices[device.type] = {};
		}
	devices[device.type][device.name] = require('./adapters/' + device.type + '/' + device.adapter).create_device(deps,device);
	
});
