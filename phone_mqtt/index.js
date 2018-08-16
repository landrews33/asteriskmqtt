var mqtt = require('mqtt');
var winston = require('winston');

var mqttLog = new (winston.Logger)({
	transports : [ new (winston.transports.File)({
		filename : 'mqtt.log',
		maxsize : 1048576,
		maxFiles : 10,
		tailable : true,
		zippedArchive : true
	}) ]
});

var mqttClient;

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
	
	mqttClient = mqtt.connect(config.mqtt.url, {
		"username" : config.mqtt.username,
		"password" : config.mqtt.password
	});
	registerMQTTEventHandlers(mqttClient, ami);
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
