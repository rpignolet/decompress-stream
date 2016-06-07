const fs = require('fs');
const Vinyl = require('vinyl');
const tar = require('tar-stream');
const StatMode = require('stat-mode');
const fileType = require('file-type');
const stripDirs = require('strip-dirs');

const FileFormatError = require('../errors/FileFormatError');

function untarStream(streamDestVinyl, deferred, options) {
  options = options || {};
  let extract = tar.extract();

  extract.on('entry', (header, stream, callback) => {
    // header is the tar header
    // stream is the content body (might be an empty stream)
    // call next when you are done with this entry
    
    if (options.strip) {
      try {
        header.name = stripDirs(header.name, options.strip);
      } catch (err) {
        return deferred.reject(new Error('The option "strip" must be a natural number or 0, but received "' + options.strip + '"'));
      }
    }

    let stat = new fs.Stats();
    let statMode = new StatMode(stat);
    let vinylOptions = {
      path: header.name
    };
    stat.mode = header.mode;

    if (header.type === 'directory') {
      statMode.isDirectory(true);
    }
    else if (header.type === 'symlink') {
      statMode.isSymbolicLink(true);
    }
    else {
      statMode.isFile(true);
      vinylOptions.contents = stream;
      // Prevent the execution of the real callback after
      let realCallback = callback;
      callback = () => { };

      stream.on('end', _ => {
        realCallback(); // ready for next entry
      });
    }
    vinylOptions.stat = stat;

    streamDestVinyl.write(new Vinyl(vinylOptions));
    callback();
  });

  extract.on('error', err => {
    deferred.reject(err);
  });

  extract.on('finish', _ => {
    // all entries read
    deferred.resolve();
  });

  return extract;
}

function untar(file, streamDestVinyl, options) {
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
          if (!type || type.ext !== 'tar') {
            fs.close(fd, err => {
              if (err) return reject(err);
              reject(new FileFormatError());
            });
            return;
          }
          // Free the buffer
          buffer = null;

          fs.createReadStream(null, { fd: fd }).pipe(untarStream(streamDestVinyl, deferred, options));
        })
      });
    });

  });
}

module.exports = (options) => (file, streamDestVinyl) => untar(file, streamDestVinyl, options);
module.exports.stream = untarStream;