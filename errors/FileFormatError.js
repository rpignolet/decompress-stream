const ExtendableError = require('es6-error');

class FileFormatError extends ExtendableError {}

module.exports = FileFormatError;