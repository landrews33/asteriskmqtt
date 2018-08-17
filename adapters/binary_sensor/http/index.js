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

Device.prototype.requestHandler = function(request, response)
	{
		httpLog.info(request.path + ":" + request.params);
			response.end("OK");
			if(this.config.always_on)
			{
				this.state=true;
				mqtt.publishState(this.type, this.name, device);
				if(device.config.expiry)
					{
						clearTimeout(this.expiry);
						this.expiry = setTimeout(function() { 
							this.state=false;
							deps.consoleLog.info("Autoexpiring sensor" + this.name);
							deps.mqtt.publishState(this.type, this.name, device)
							}, this.config.expiry);
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
	this.config=device.config;
	this.name=device.name;
	this.type=device.type;
	this.friendly_name=device.friendly_name;
	this.discovery_config={"name":this.friendly_name};
	this.state_provider=this.state_provider;
	deps.consoleLog.info(this.type);
	deps.mqtt.registerAdapter(this.type, this.name, this);
	//Enable port reuse!
	if(!routers.hasOwnProperty(this.config.port))
	{
		routers[this.config.port] = new Router();
		var server = http.createServer(routers[this.config.port]);
		server.listen(this.config.port, (err) => {
			  if (err) {
				    return deps.consoleLog.info('something bad happened', err)
				  }

			  deps.consoleLog.info('HTTP server is listening on' + this.config.port);
				})
	}
	console.log(this.config.path);
	routers[this.config.port].get(this.config.path,this.requestHandler);

	
}


