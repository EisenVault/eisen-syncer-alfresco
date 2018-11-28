const path = require('path');
const fs = require('fs');

// Create the 'certificates' folder if not exists
if (!fs.existsSync(path.resolve('./certificates'))) {
    fs.mkdirSync(path.resolve('./certificates'));
}

// Make a fresh DB
fs.copyFileSync(
    path.resolve('./server/database/sample.syncer.db'),
    path.resolve('./server/database/syncer.db'));