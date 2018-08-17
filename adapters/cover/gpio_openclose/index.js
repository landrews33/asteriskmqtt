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
	if(message == payload_open)
	{
		this.close.writeSync(Gpio.LOW);
		this.open.writeSync(Gpio.HIGH);

	}
	else if(message == payload_close)
		{
		this.open.writeSync(Gpio.LOW);
		this.close.writeSync(Gpio.HIGH);
		}
	else if(message == payload_stop)
		{

			this.open.writeSync(Gpio.LOW);
			this.close.writeSync(Gpio.LOW);
		}
	else
        {
                deps.consoleLog.info("Message " + message + " cannot be parsed.");
        }
}

const payload_open = "OPEN";

const payload_close = "CLOSE";

const payload_stop = "STOP";


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
	this.open = new Gpio(this.config.open_gpio, 'out');
	this.close = new Gpio(this.config.close_gpio, 'out');

	deps.consoleLog.info(this.type);
	deps.mqtt.registerAdapter(this.type, this.name, this);

	
}


