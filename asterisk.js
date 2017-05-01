var mqtt = require('mqtt');
var config = require('./config.json');
var config_schema = require('./schema_config.json');
var ami = {};
var mqttClient;
var channelTracker = {};

function startBridge(config)
{	
	console.log("Connecting to Asterisk");
	ami = new require('asterisk-manager')(config.asterisk.port, config.asterisk.host, config.asterisk.user, config.asterisk.password, true);
	ami.on('connect', function() {
		console.log("Asterisk Connected");
	});
	ami.keepConnected();
	console.log("Connecting to MQTT");
	mqttClient = mqtt.connect(config.mqtt.url, {"username":config.mqtt.username,"password":config.mqtt.password});

	registerAMIEventHandlers(ami);
	registerMQTTEventHandlers(mqttClient,ami);
}

function registerMQTTEventHandlers(mqttClient,ami)
{
	var publishPresence = function()
	{
		var lines = config.lines;
		for (var i = 0; i < lines.length; i++) {
			console.log("Publishing Presence for " + lines[i].id );
			mqttClient.publish(lines[i].status_topic, JSON.stringify(lines[i]));
			mqttClient.publish("discovery/announce", JSON.stringify(lines[i]));
		}
	}

	var publishStateAndSubscribe = function()
	{
		publishPresence();
		var lines = config.lines;
	        for (var i = 0; i < lines.length; i++) {
			mqttClient.publish(lines[i].status_topic, '{"state":"Idle"}', {"qos":2});
			mqttClient.subscribe(lines[i].command_topic);
		}
	}

	mqttClient.on('connect', publishStateAndSubscribe);
	setInterval(publishPresence, 300000);


	mqttClient.on('message', function (topic, message) {
		console.log("Topic" + topic);
		console.log("Message" + message);	

	});
}


function registerAMIEventHandlers(ami)
{
        var singleEvent = config.singleeventpercall;
	var callInbound = function(event) {
		if(singleEvent && channelTracker.hasOwnProperty(event.uniqueid))
		{
			console.log("Channel " + event.uniqueid + "already seen - ignoring");
		}
		var callEvent = {};
		callEvent.srcnum=event.calleridnum
		callEvent.srcname=event.calleridname
		callEvent.destnum=event.destcalleridnum
		callEvent.destname=event.destcalleridname
		callEvent.identifier=event.channel
		callEvent.extendedInfo=event
		//Todo: Include timestamp
		channelTracker[event.uniqueid] = {"status":"ringing"};
		var clearChannel = function()
		{
			if(channelTracker.hasOwnProperty(event.uniqueid) && channelTracker[event.uniqueid].status == "ringing")
			{
				channelTracker[event.uniqueid].status = "orphan";
				setTimeout(clearChannel, 120000);
			} else if (channelTracker.hasOwnProperty(event.uniqueid) && channelTracker[event.uniqueid].status == "oprhan")
			{
				delete channelTracker[event.uniqueid];
			}
		}
		setTimeout(clearChannel, 120000);
		console.log('Publishing Dial Event')
		console.log(event);
		//Todo: Line lookup
	        mqttClient.publish(line[0].status_topic, '{"state":"ringing","callerid":"'+event.calleridnum+'","callername":"'+event.calleridname+'"}', {"qos":2});

	}
	
	ami.on('dialbegin', callInbound);
	var hangUp = function(event)
	{
		if(event.uniqueid == event.linkedid)
		{
			console.log("Primary Hangup");
		}
		console.log(event);
	}
	//ami.on('pickup', call);
	//ami.on('hangup', call);
	var extStatus = function(event)
	{
		console.log(event);
	}
	ami.on('dialend', extStatus);
	ami.on('dial', extStatus);
	ami.on('hangup', hangUp);
	ami.on('join', extStatus);
	ami.on('pickup', extStatus);

}

try
{
	var validate = require('jsonschema').validate;
	validate(config,config_schema, {"throwError":true} ); 
} catch (err)
{
	console.log(err.message);
	process.exit(1);
}
startBridge(config);
