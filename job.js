const Gpio = require('pigpio').Gpio;
const http = require('https');
const dataService = require('./data.service');
const dotenv = require('dotenv');

dotenv.config();

const PINES = dataService.get().map(d => d.id);

const gpios = PINES.map(pin => new Gpio(pin, {mode: Gpio.OUTPUT}));

const ENDPOINT_URL = process.env.ENDPOINT_URL;

const endpointUrl = ENDPOINT_URL;
let isFirst = true;
let previousState = null;

const makeHttpRequest = () => {
    const options = {
      method: 'GET',
      headers: {
        'Content-Type': 'application/json',
      },
    };
  
    const req = http.request(endpointUrl, options, (res) => {
      let data = '';
      res.on('data', (chunk) => {
        data += chunk;
      });
      res.on('end', () => {
        data = JSON.parse(data);
        if (isFirst) {
            isFirst = false;
            previousState = data;
            data.forEach(d => {
                const index = PINES.findIndex(gpio => gpio === d.id);
                gpios[index].pwmWrite(d.intensity);
            });
            return;
        }
        data.forEach(d => {
            const index = previousState.findIndex(prev => prev.id === d.id);
            if (previousState[index].intensity !== d.intensity) {
                const gpioIndex = PINES.findIndex(gpio => gpio === d.id);
                gpios[gpioIndex].pwmWrite(d.intensity);
            }
        });

        previousState = data;
        console.log(data.map(d => `${d.name}(${d.id}): ${d.intensity}`).join(', '));
      });
    });

    req.on('error', (error) => {
      console.error(`Error making request: ${error.message}`);
    });
  
    req.end();
};

const interval = 5 * 1000;

// Set up the interval to make the HTTP request
const intervalId = setInterval(makeHttpRequest, interval);

process.on('SIGINT', _ => {
  gpios.forEach(gpio => {
    gpio.digitalWrite(0);
    // gpio.unexport();
  });
});
