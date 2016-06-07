const fs = require('fs');
const zlib = require('zlib');
const fileType = require('file-type');
const Untar = require('./untar');

const FileFormatError = require('../errors/FileFormatError');

function untargz(file, streamDestVinyl, options) {
  options = options || {};
  return new Promise((resolve, reject) => {
    let deferred = {
      resolve: resolve,
      reject: reject
    };

    fs.stat(file.path, (err, stats) => {
      if (err || !stats || stats.isDirectory()) {
        return reject(new FileFormatError());
      }

      fs.open(file.path, 'r', (err, fd) => {
        if (err) return reject(err);

        fs.read(fd, new Buffer(262), 0, 262, 0, (err, bytesRead, buffer) => {
          if (err) return reject(err);

          let type = fileType(buffer);
          if (!type || type.ext !== 'gz') {
            fs.close(fd, err => {
              if (err) return reject(err);
              reject(new FileFormatError());
            });
            return;
          }
          // Free the buffer
          buffer = null;

          fs.createReadStream(null, { fd: fd }).pipe(zlib.createGunzip()).pipe(Untar.stream(streamDestVinyl, deferred, options));
        })
      });
    });

  });
}

module.exports = (options) => (file, streamDestVinyl) => untargz(file, streamDestVinyl, options);