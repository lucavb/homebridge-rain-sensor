var Service;
var Characteristic;
var HomebridgeAPI;
var Gpio = require('onoff').Gpio;
var ads1x15 = require('./node-ads1x15/index'); // i2c module does not compile on the raspberry pi
// you will need to place it in a folder here and try to satisfy it's dependencies. check out the node-i2c repo for hints
var inherits = require('util').inherits;

module.exports = function(homebridge) {
    Service = homebridge.hap.Service;
    Characteristic = homebridge.hap.Characteristic;
    HomebridgeAPI = homebridge;

    homebridge.registerAccessory("homebridge-rain-sensor", "homebridgeRainSensor", HomebridgeRainSensor);
};

function HomebridgeRainSensor(log, config) {
    /*
    example configuration
        {
            "accessory" : "HomebridgeRainSensor",
            "name" : "Fiscus Benjamina 'Natasja'",
            "pinRead" : 25,
            "pinVCC" : 23,
            "serial" : "882F49F96115"
        }
    */
    var that = this;
    this.log = log;
    this.name = config.name;
    this.pinVCC = new Gpio(config.pinVCC, 'out');

    this.adc = new ads1x15(config.adsChip || 1);
    this.channel = config.adcChannel || 0;
    this.samplesPerSecond =  config.samplesPerSecond || '250';
    this.progGainAmp = config.progGainAmp || '4096';

    this.wetValue = config.wetValue || 0;
    this.dryValue = config.dryValue || 32767;

    // info service
    this.informationService = new Service.AccessoryInformation();

    this.informationService
        .setCharacteristic(Characteristic.Manufacturer, config.manufacturer ||  "Vani")
        .setCharacteristic(Characteristic.Model, config.model || "Y1")
        .setCharacteristic(Characteristic.SerialNumber, config.serial || "F93825D440FA");




    // moisture characteristic
    RainCharacteristic = function() {
        Characteristic.call(this, 'Rain', '2AAF1520-CB21-404F-855D-4A17D0DC3A4C');
        this.setProps({
            format: Characteristic.Formats.UINT8,
            unit: Characteristic.Units.PERCENTAGE,
            maxValue: 100,
            minValue: 0,
            minStep: 0.1,
            perms: [Characteristic.Perms.READ, Characteristic.Perms.NOTIFY]
        });
        this.value = this.getDefaultValue();
    };

    inherits(RainCharacteristic, Characteristic);

    RainCharacteristic.UUID = '2AAF1520-CB21-404F-855D-4A17D0DC3A4C';


    // moisture sensor
    RainSensor = function(displayName, subtype) {
        Service.call(this, displayName, 'E8254BA3-E374-4BEC-8AD5-46747CF9271C', subtype);

        // Required Characteristics
        this.addCharacteristic(RainCharacteristic);

        // Optional Characteristics
        // none at this point
    };

    inherits(RainSensor, Service);

    RainSensor.UUID = 'E8254BA3-E374-4BEC-8AD5-46747CF9271C';

    this.rainSensor = new RainSensor(this.name);
    this.rainSensor.getCharacteristic(RainCharacteristic)
        .on('get', this.getRain.bind(this));
}

HomebridgeRainSensor.prototype.getRain = function(callback) {
    var that = this;
    that.pinVCC.writeSync(1);
    setTimeout(function() {
        // giving the sensors some time to get started
        if(!that.adc.busy) {
            that.adc.readADCSingleEnded(that.channel, that.progGainAmp, that.samplesPerSecond, function(err, data) {
                that.pinVCC.write(0);
                if(err) {
                    throw err;
                }
                var value = Math.abs(data);
                var percent = ((value - that.wetValue) / (that.dryValue - that.wetValue)) * 100;
                percent = (percent > 100) ? 100 : percent;
                percent = (percent < 0) ? 0 : percent;
                percent = 100 - percent;
                callback(null, percent);
            });
        }
    }, 250);
}

HomebridgeRainSensor.prototype.getServices = function() {
    return [this.informationService, this.rainSensor];
};