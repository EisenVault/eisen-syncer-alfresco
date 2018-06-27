const Cryptr = require("cryptr");
const cryptr = new Cryptr("nufejPIJ77v72GGNF12H");

exports.encrypt = data => {
  return cryptr.encrypt(data);
};

exports.decrypt = data => {
  return cryptr.decrypt(data);
};
