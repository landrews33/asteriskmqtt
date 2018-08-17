var _ = require('lodash');
const Gpio = require('onoff').Gpio;
const config_schema = "";
	
var deps;

Device.prototype.state_provider = function()
{
		return this.state ? "ON" : "OFF";
}
	
exports.create_device = function(app_deps, device_config)
{
	return new Device(app_deps, device_config);
}

Device.prototype.cmd_handler = function(message)
{
	var filteredMessage = this.filter(message);
	if(filteredMessage)
	{
		this.state = filteredMessage;
		this.io.writeSync(this.state ? Gpio.HIGH : Gpio.LOW);
		mqtt.publishState(this.device.type, this.device.name, this.state_provider());	
	}	
	else
        {
                deps.consoleLog.info("Message " + message + " cannot be parsed.");
        }
}

const payload_on = "ON";

const payload_off = "OFF";

function standardFilter(message)
{
	if(message == payload_on)
		{
			return true;
		}
	else if(message == payload_off)
		{
			return false;
		}
	else
		{
		return undefined;
		}
}


function Device(app_deps, device)
{
	this.state=false;
	if(!deps) {
		deps=app_deps;
	}
	this.type=device.type;
	this.name = device.name;
	this.config = device.config;
	this.friendly_name = device.friendly_name;
	this.discovery_config={"name":this.friendly_name};
	//In future this will be overridden;
	this.filter=standardFilter;
	this.io = new Gpio(this.config.gpio, 'out');

	deps.consoleLog.info(this.type);
	deps.mqtt.registerAdapter(this.type, this.name, device);

	
}


