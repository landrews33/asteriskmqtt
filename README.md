# asteriskmqtt
Asterisk AMI to MQTT Bridge 

This is a daemon that connects to the Asterisk Manager interface and a MQTT Broker to allow the status of lines/extensions to be published to MQTT and calls to be initiated via MQTT.

## Getting Started

1. Run npm install to download dependencies.
2. Copy examples/config.json to the root directory and modify to reflect your environment.
3. nohup nodejs ./asterisk.js



