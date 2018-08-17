var _ = require('lodash');
var Router = require('node-simple-router');
const http = require('http')
const config_schema = "";
	
var routers = {};
var deps;
var httpLog;

Device.prototype.state_provider = function()
{
		return this.state ? "ON" : "OFF";
}
	
exports.create_device = function(app_deps, device_config)
{
	return new Device(app_deps, device_config);
}

function requestHandler(device, mqtt)
{
	return function(request, response)
	{
		httpLog.info(request.path + ":" + request.params);
			response.end("OK");
			if(device.config.always_on)
			{
				this.state=true;
				mqtt.publishState(device.type, device.name, "ON");
				if(device.config.expiry)
					{
						clearTimeout(this.expiry);
						this.expiry = setTimeout(function() { 
							deps.consoleLog.info("Autoexpiring sensor" + device.name);
							mqtt.publishState(device.type, device.name, "OFF")
							}, device.config.expiry);
					}
			}
	}
}


function Device(app_deps, device)
{
	this.state=false;
	if(!deps) {
		deps=app_deps;
		httpLog = deps.logger.createLog('http');
	}
	this.device=device;
	this.device.discovery_config=app_deps.configgen(this.device.type, this.device.friendly_name);
	this.device.state_provider=this.state_provider;
	deps.consoleLog.info(this.device.type);
	deps.mqtt.registerAdapter(this.device.type, this.device.name, this.device);
	//Enable port reuse!
	if(!routers.hasOwnProperty(this.device.config.port))
	{
		routers[this.device.config.port] = new Router();
		var server = http.createServer(routers[this.device.config.port]);
		server.listen(this.device.config.port, (err) => {
			  if (err) {
				    return deps.consoleLog.info('something bad happened', err)
				  }

			  deps.consoleLog.info('HTTP server is listening on' + this.device.config.port);
				})
	}
	console.log(this.device.config.path);
	routers[this.device.config.port].get(this.device.config.path,requestHandler(this.device, deps.mqtt));

	
}


