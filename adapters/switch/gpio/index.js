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

function switchGpio(message)
{
	var filteredMessage = standardFilter(message);
	if(filteredMessage)
	{
		this.state = filteredMessage;
		this.io.writeSync(this.state ? Gpio.HIGH : Gpio.LOW);
		mqtt.publishState(this.device.type, this.device.name, this.state_provider());	
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
	this.device=device;
	this.device.discovery_config={"name":this.device.friendly_name};
	this.device.state_provider=this.state_provider;
	this.filter=standardFilter;
	this.io = new Gpio(this.device.config.gpio, 'out');
	this.device.cmd_handler=switchGpio;

	deps.consoleLog.info(this.device.type);
	deps.mqtt.registerAdapter(this.device.type, this.device.name, this.device);

	
}


