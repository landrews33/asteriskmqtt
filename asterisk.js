var config = require('./config.json');
var config_schema = require('./schema_config.json');
var winston = require('winston');
var phone_mqtt = require('./phone_mqtt/');

var deps = {};

deps.logger = require('core/logging');
deps.logger.setup(config);

deps.consoleLog = logger.createLog('mqtthub');


var asteriskLog = logger.createLog('asterisk');
var ami = {};

var channelTracker = {};
var eventTracker = {};
var channelMap = {};
var lines;

function startBridge(config) {
	consoleLog.info("Connecting to Asterisk");
	ami = new require('asterisk-manager')(config.asterisk.port,
			config.asterisk.host, config.asterisk.user,
			config.asterisk.password, true);
	ami.on('connect', function() {
		consoleLog.info("Asterisk Connected");
	});
	phone_mqtt.startPhoneMqtt(config);
	ami.keepConnected();
	registerAMIEventHandlers(ami);
	consoleLog.info("Connecting to MQTT");
	
}

function registerAMIEventHandlers(ami) {
	
	var singleEvent = config.singleeventpercall;
	
	var callInbound = function(event) {
		asteriskLog.info(event);
		if (singleEvent && eventTracker.hasOwnProperty(event.linkedid)) {
			consoleLog.info("Unique Event ID " + event.linkedid
					+ "already seen - ignoring");
			return;
		}
		var callEvent = {};
		callEvent.srcnum = event.calleridnum
		callEvent.srcname = event.calleridname
		callEvent.destnum = event.destcalleridnum
		callEvent.destname = event.destcalleridname
		callEvent.identifier = event.channel
		callEvent.extendedInfo = event
		// Todo: Include timestamp
		eventTracker[event.uniqueid] = {
			"status" : "ringing"
		};
		var clearEvent = function() {
			if (eventTracker.hasOwnProperty(event.linkedid)) {
				delete eventTracker[event.linkedid];
			}
		}
		var clearChannel = function() {
			if (channelTracker.hasOwnProperty(event.channel)
					&& channelTracker[event.channel].status == "ringing") {
				channelTracker[event.channel].status = "orphan";
				setTimeout(clearChannel, 120000);
			} else if (channelTracker.hasOwnProperty(event.channel)
					&& channelTracker[event.channel].status == "orphan") {
				delete channelTracker[event.channel];
			}
		}
		setTimeout(clearEvent, 120000);
		setTimeout(clearChannel, 120000);
		consoleLog.info('Publishing Ringing Event to MQTT')
		// Channel is DialString-integer
		var line = channelMap[event.channel.substring(0, event.channel
				.indexOf('-'))];
		if (typeof line == 'object') {
			var did = did_for_event(event);
			// TODO: Detect outbound
			consoleLog.info("DID:" + did);
			
			phone_mqtt.updateLineState(did.id, 'ringing', 'inbound', event.calleridnum, event.calleridname);
			
			channelTracker[event.channel] = {};
			channelTracker[event.channel].did = did;
			channelTracker[event.channel].callerid = event.calleridnum;
			channelTracker[event.channel].callername = event.calleridname;
			channelTracker[event.channel].direction = 'inbound';
			channelTracker[event.channel].status = 'ringing';
		}
	}

	ami.on('dialbegin', callInbound);
	var dialEnd = function(event) {
		asteriskLog.info(event);
		if (event.uniqueid == event.linkedid) {
			consoleLog.info("Primary Dial End on :"
					+ JSON.stringify(channelTracker[event.channel]));
			if (typeof channelTracker[event.channel] == 'object') {
				var channel = channelTracker[event.channel];
				consoleLog.info("Setting " + channel.did.did + " to onhook");
				channelTracker[event.channel].status = "onhook";
				phone_mqtt.updateLineState(did.id, 'missed_call', 'inbound', channel.calleridnum, channel.calleridname);
				
			
			}

		}
		consoleLog.info(event);
	}
	var hangUp = function(event) {
		asteriskLog.info(event);
		if (event.uniqueid == event.linkedid) {
			consoleLog.info("Primary Hangup on :"
					+ JSON.stringify(channelTracker[event.channel]));
			if (typeof channelTracker[event.channel] == 'object') {
				// Need to identify missed calls.
				consoleLog.info(channelTracker[event.channel].did);
				consoleLog.info("Setting "
						+ channelTracker[event.channel].did.did + " to onhook");
				phone_mqtt.updateLineState(did.id, 'onhook', null, null, null);

				delete channelTracker[event.channel];
			}

		}
		console.log(event);
	}
	// ami.on('pickup', call);
	ami.on('hangup', hangUp);
	var extStatus = function(event) {
		asteriskLog.log(event);
	}
	var dialComplete = function(event) {

	}
	ami.on('dialend', dialEnd);
	// ami.on('dial', extStatus);
	ami.on('hangup', hangUp);
	ami.on('join', extStatus);
	ami.on('pickup', extStatus);

}

function did_for_event(event) {
	var line = channelMap[event.channel
			.substring(0, event.channel.indexOf('-'))];
	if (typeof line == 'object') {
		var status_topic = "";
		if (line.dids.length > 1) {
			for (var j = 0; j < line.dids.length; j++) {
				consoleLog.info(typeof line.dids[j].channel_cidprefix);
				if (typeof line.dids[j].channel_cidprefix == 'string') {
					if (event.calleridname
							.indexOf(line.dids[j].channel_cidprefix) > -1) {
						return line.dids[j];
					}
				}
			}
		}
		return line.dids[0];
	}
}

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
startBridge(config);
