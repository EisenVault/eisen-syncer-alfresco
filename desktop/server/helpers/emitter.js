var events = require('events');
var em = new events.EventEmitter();
em.setMaxListeners(999999);
process.setMaxListeners(Infinity);
module.exports.emitter = em;