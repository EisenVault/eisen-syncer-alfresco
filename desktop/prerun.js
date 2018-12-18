const path = require('path');
const fs = require('fs');

// Make a fresh DB
fs.copyFileSync(
    path.resolve('./server/database/sample.syncer.db'),
    path.resolve('./server/database/syncer.db'));