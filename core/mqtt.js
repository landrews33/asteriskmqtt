var mqtt = require('mqtt');
var winston = require('winston');
var _ = require('lodash');

var deps;

var mqttClient;

const config_path = 'mqtt';
var config = {
	
	"log_file":"mqtt",
	"url":"mqtts://localhost:1883", 
	"username":"mqttusername",
	"password":"mqttpassword",
	"global_prefix": "home"
};

var mqttClient;
var mqttLog;
var devices = {};
var global_listener = false;
var global_listeners = [];
var global_command_types = {};

function registerMQTTEventHandlers(mqttClient) {
	

	mqttClient.on('disconnect', function() {
		mqttLog.info("Disconnected from MQTT Broker")
	});
	
	mqttClient.on('error', function() {
		mqttLog.info('Error connecting to MQTT');
	});

	mqttClient.on('connect', subscribeAndPublishAll);

	setInterval(publishDiscoveryAll, 1800000);
	
}


exports.setup = function setup(app_deps, app_config)
{
	deps = app_deps;
	_.assign(config, app_config[config_path]);
	mqttLog = deps.logger.createLog(config.log_file);
	mqttClient = mqtt.connect(config.url, {
		"username" : config.username,
		"password" : config.password
	});
	registerMQTTEventHandlers(mqttClient);
	deps.consoleLog.info("MQTT Module Loaded");
}

//As standard we published for and subscribe to:
//config topic in form globalprefix / type / name / config
//command topic in form globalprefix / type / name / cmd
//state topic in form globalprefix / type / name / cmd
//COnfig needs to be provided containing global_cmd, global_listener, state_provider, discovery_config, cmd_handler
//If global_cmd is true we will also subscribe to globalprefix / type / cmd
//If global_listener is true will mqtt messages will be sent including local.
exports.registerAdapter = function(type, name, adapter_config)
{

	if(!devices[type])
		{
		devices[type] = {};
		}
	devices[type][name] = adapter_config;

	if(mqttClient.connected)
	{
		if(!global_listener && adapter_config.global_listener)
		{
			global_listener = true;
			mqttClient.subscribe(global_prefix + '/#');
			
		}
		if(!global_listener && adapter_config.global_cmd && !global_command_types[type])
		{
			mqttClient.subscribe(global_prefix + '/' + type + '/#');
		}
		if(!global_listener)
		{
			mqttClient.subscribe(global_prefix + '/' + type + '/' + name + '/cmd')
		}
		publishDiscovery(type, name, adapter_config.discovery_config);
		publishState(type, name, adapter_config.state_provider);
	}
}

exports.publishState = function(type, name, message)
{
	mqttClient.publish(config.global_prefix + '/' + type + '/' + name +'/state', message);
}

function subscribeAndPublishAll()
{
	if(mqttClient.connected)
	{
		if(global_listener)
		{
			mqttClient.subscribe(config.global_prefix + '/#');
		}
		_.forOwn(devices, function(value, type, object)
		{		
			if(!global_listener && global_command_types[type])
			{
				mqttClient.subscribe(config.global_prefix + '/' + type + '/#');
			}
			_.forOwn(value, function (value, name, object)
			{
					publishDiscovery(type, name, value.discovery_config);
					console.log(value);
					publishState(type, name, value.state_provider);
					if(!global_listener)
					{
						mqttClient.subscribe(config.global_prefix + '/' + type + '/' + name + '/cmd')
					}
			})
		});
	}
}

function publishDiscoveryAll()
{
	if(mqttClient.connected)
	{
		_.forOwn(devices, function(value, top_key, object)
		{
			_.forOwn(value, function (value, key, object)
			{
					console.log(value);
					publishDiscovery(top_key, key, value.discovery_config);
			})
		});
	}
}

function publishDiscovery(type, name, discovery_config)
{
		console.log(devices);
		mqttLog.info('Publishing to ' + type + '/' + name + '/config');
		mqttClient.publish(config.global_prefix + '/' + type + '/' + name +'/config', discovery_config);
}

function publishState(type, name, state_provider)
{
		mqttLog.info('Publishing to ' + type + '/' + name + '/state');
		mqttClient.publish(config.global_prefix + '/' + type + '/' + name +'/state', state_provider());
}

function messageHandler(topic, message)
{
		mqttLog.info('Received' + topic + ':' + message);
		var components = topic.split('/');
		//First send to any global listeners;
		
	
		if(devices[components[1]])
			{
				if(components[2] == "cmd")
				{
					//We have a global cmd
				}
				if(devices[components[1]][components[2]] && components[3] == "cmd")
					{
						if(typeof(devices[components[1]][components[2]].config.cmd_handler) == 'function')
							{
								devices[components[1]][components[2]].config.cmd_handler(message);
							}
					}
			}
}

/**Specific to phone
var lines = {};

var registerEvent = function(handler) {

};

var publishPresence = function() {
	for (var line in lines) {
	    if (object.hasOwnProperty(line)) {
		mqttLog.info("Publishing Presence for " + line.id);
		//
			mqttClient.publish(line.status_topic, JSON
					.stringify(line));
	    }
	}
}

var startPhoneMqtt = function(config) {
	// In future this should be indepenent of the asterisk format.
	for (var i = 0; i < config.lines.length; i++) {
		for (var j = 0; j < config.lines[i].dids.length; j++) {
			lines[config.lines[i].dids[j].id] = config.lines[i].dids[j];
		}
	}
	
	//Set initial state
	for (var line in lines) {
	    if (object.hasOwnProperty(line)) {
	    	line.status_topic='onhook'
	    }
	}
	
}

function registerMQTTEventHandlers(mqttClient, ami) {
	mqttClient.on('error', function() {
		mqttLog.info('Error connecting to MQTT');
	});

	mqttClient.on('connect', publishStateAndSubscribe);


	
	var publishStateAndSubscribe = function() {
		for (var line in lines) {
		    if (object.hasOwnProperty(line)) {
				mqttClient.subscribe(line.command_topic);
		    }
		}
		publishPresence();
	}

	mqttClient.on('disconnect', function() {
		consoleLog.info("Disconnected from MQTT Broker")
	});
	
	setInterval(publishPresence, 1800000);
	
	mqttClient.on('message', function(topic, message) {
		mqttLog.info("Topic" + topic);
		mqttLog.info("Message" + message);

	});
};

var updateLineState = function(line_id, status, direction, callerid, calleridnum)
{
	var line = lines[line_id];
	if(line)
	{
		line.status = status;
		line.direction = direction;
		line.callerid = callerid;
		line.calleridnum = calleridnum;
		mqttClient.publish(line.status_topic, JSON
				.stringify(line));
	}
};

var updateVMState = function(line_id, vm_count)
{
	var line= lines[line_id];
	if(line)
		{
			if(lines.vm_count != vm_count)
				{
				line.vm_count=vm_count;

				mqttClient.publish(line.status_topic, JSON
					.stringify(line));
				}
		}
};

exports.startPhoneMqtt = startPhoneMqtt;
exports.updateLineState = updateLineState;
exports.updateVMState = updateVMState;
**/
