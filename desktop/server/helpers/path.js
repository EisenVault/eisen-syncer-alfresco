const path = require('path');

exports.toUnix = (path) => {
    // Replace windows folder separator with unix style seperator
    return path.replace(/\\/g, '/');
}

// Returns the site-name from a local path 
exports.getSiteNameFromPath = filePath => {
    let explode = filePath.split(path.sep);
    explode = explode.splice(explode.indexOf('documentLibrary') - 1, 1);
    return explode[0] || '';
}