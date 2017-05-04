var mqtt = require('mqtt');
var config = require('./config.json');
var config_schema = require('./schema_config.json');
var ami = {};
var mqttClient;
var channelTracker = {};
var channelMap={};
var lines;

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
		for (var i = 0; i < lines.length; i++) {
			for(var j=0; j< lines[i].dids.length;j++)
			{
				console.log("Publishing Presence for " + lines[i].dids[j].id );
				mqttClient.publish(lines[i].dids[j].status_topic, JSON.stringify(lines[i].dids[j]));
				mqttClient.publish("discovery/announce", JSON.stringify(lines[i].dids[j]));
			}
		}
	}

	var publishStateAndSubscribe = function()
	{
		publishPresence();
	        for (var i = 0; i < lines.length; i++) {
                        for(var j=0; j<lines[i].dids.length;j++)
			{
				console.log("Publishing State for " + lines[i].dids[j].status_topic);
				mqttClient.publish(lines[i].dids[j].status_topic, '{"state":"idle"}', {"qos":2});
				mqttClient.subscribe(lines[i].dids[j].command_topic);
			}
		}
	}

	mqttClient.on('connect', publishStateAndSubscribe);
	mqttClient.on('disconnect', function() { console.log("Disconnected")})
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
		if(singleEvent && channelTracker.hasOwnProperty(event.linkedid))
		{
			console.log("Channel " + event.linkedid + "already seen - ignoring");
			return;
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
			if(channelTracker.hasOwnProperty(event.linkedid) && channelTracker[event.linkedid].status == "ringing")
			{
				channelTracker[event.linkedid].status = "orphan";
				setTimeout(clearChannel, 120000);
			} else if (channelTracker.hasOwnProperty(event.linkedid) && channelTracker[event.linkedid].status == "orphan")
			{
				delete channelTracker[event.linkedid];
			}
		}
		setTimeout(clearChannel, 120000);
		console.log('Publishing Dial Event')
		console.log(event);
		var lines = config.lines
		//Channel is DialString-integer
		var line = channelMap[event.channel.substring(0,event.channel.indexOf('-'))];
		if(typeof line == 'object')
		{
			var did = did_for_event(event);
			//TODO: Detect outbound
			console.log(did);
		        mqttClient.publish(did.status_topic, '{"state":"ringing","direction":"inbound","callerid":"'+event.calleridnum+'","callername":"'+event.calleridname+'"}', {"qos":2});
			channelTracker[event.uniqueid] = {};
			channelTracker[event.uniqueid].did = did;
			channelTracker[event.uniqueid].status = 'ringing';
		}
	}
	
	ami.on('dialbegin', callInbound);
	var hangUp = function(event)
	{
		if(event.uniqueid == event.linkedid)
		{
			console.log("Primary Hangup");
			if(typeof channelTracker[event.uniqueid] == 'object')
			{
				console.log("Setting to idle");
				mqttClient.publish(channelTracker[event.uniqueid].did.status_topic, '{"state":"idle"}');
			}
			
		}
		console.log(event);
	}
	//ami.on('pickup', call);
	//ami.on('hangup', call);
	var extStatus = function(event)
	{
		console.log(event);
	}
	var dialComplete = function(event)
	{
		
	}
	ami.on('dialend', extStatus);
	ami.on('dial', extStatus);
	ami.on('hangup', hangUp);
	ami.on('join', extStatus);
	ami.on('pickup', extStatus);

}

function did_for_event(event)
{
	 var line = channelMap[event.channel.substring(0,event.channel.indexOf('-'))];
         if(typeof line == 'object')
         {
               var status_topic = "";
               if(line.dids.length > 1)
               {
                       for(var j=0; j<line.dids.length; j++)
                       {
                               console.log(typeof line.dids[j].channel_cidprefix);
                               if(typeof line.dids[j].channel_cidprefix == 'string')
                               {
                                        if(event.calleridname.indexOf(line.dids[j].channel_cidprefix) > -1)
                                        {
                                        	return line.dids[j];
					}
                                }
                        }
                }
		return line.dids[0];
        }
}

try
{
	var validate = require('jsonschema').validate;
	validate(config,config_schema, {"throwError":true} ); 
	lines = config.lines;
	//Populate channel map so we can determine which line a Dial event belongs to.  
        for (var i = 0; i < lines.length; i++) {
		channelMap[lines[i].channel] = lines[i];
	}
} catch (err)
{
	console.log(err.message);
	process.exit(1);
}
startBridge(config);
