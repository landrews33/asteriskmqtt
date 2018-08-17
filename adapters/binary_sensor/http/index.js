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

Device.prototype.returnRequestHandler = function () 
{ 
        mydevice = this;
        return function(request, response)
        {
                console.log(mydevice);
                httpLog.info(request.path + ":" + request.params);
                        response.end("OK");
                        if(mydevice.config.always_on)
                        {
                                mydevice.state=true;
                                deps.mqtt.publishState(mydevice.type, mydevice.name, mydevice);
                                if(mydevice.config.expiry)
                                        {
                                                clearTimeout(mydevice.expiry);
                                                mydevice.expiry = setTimeout(function() {
                                                        mydevice.state=false;
                                                        deps.consoleLog.info("Autoexpiring sensor" + mydevices.name);
                                                        deps.mqtt.publishState(mydevice.type, mydevice.name, mydevice)
                                                        }, mydevice.config.expiry);
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
	routers[this.config.port].get(this.config.path,this.returnRequestHandler());

	
}


