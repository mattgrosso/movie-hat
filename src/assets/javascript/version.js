const fs = require('fs');
const dotenv = require('dotenv');

// Load the environment variables
dotenv.config();

// Get the current version number
let version = process.env.VUE_APP_VERSION;

// Increment the version number
version = version.split('.').map((num, index, arr) => {
  if (index === 2) {
    num = parseInt(num) + 1;
    if (num >= 100) {
      num = 0;
      arr[1] = parseInt(arr[1]) + 1;
    }
    return num;
  }
  return num;
}).join('.');

// Update the .env file
const envConfig = dotenv.parse(fs.readFileSync('.env'));
envConfig.VUE_APP_VERSION = version;
fs.writeFileSync('.env', Object.entries(envConfig).map(([key, value]) => `${key}=${value}`).join('\n'));

console.log(`Version updated to ${version}`);