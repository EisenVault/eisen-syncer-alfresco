const Cryptr = require("cryptr");
const machineID = require("node-machine-id");
const cryptr = new Cryptr(machineID.machineIdSync());

exports.encrypt = data => {
  return cryptr.encrypt(data);
};

exports.decrypt = data => {
  try {
    return cryptr.decrypt(data);
  } catch (error) {
    console.log('error', error);
    return '';
  }
};
