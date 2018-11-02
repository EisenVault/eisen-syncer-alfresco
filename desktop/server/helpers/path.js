exports.toUnix = (path) => {
    // Replace windows folder separator with unix style seperator
    return path.replace(/\\/g, '/');
}