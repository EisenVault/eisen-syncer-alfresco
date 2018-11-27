const path = require('path');
const fs = require('fs');

// Backup the current DB
fs.copyFileSync(
    path.resolve('./server/database/syncer.db'),
    path.resolve('./server/database/backup.syncer.db'));

// Make a fresh DB
fs.copyFileSync(
    path.resolve('./server/database/sample.syncer.db'),
    path.resolve('./server/database/syncer.db'));