const { promisify } = require('util');
const { get, post, patch, del } = require('request');

const [getPm, postPm, patchPm, deletePm] = [get, post, patch, del].map(promisify);

module.exports = { getPm, postPm, patchPm, deletePm };