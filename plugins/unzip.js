const fs = require('fs');
const Vinyl = require('vinyl');
const yauzl = require("yauzl");
const StatMode = require('stat-mode');
const fileType = require('file-type');
const stripDirs = require('strip-dirs');

const FileFormatError = require('../errors/FileFormatError');

function _getStat(entry) {
  const IFMT = 61440;
  const IFDIR = 16384;
  const IFLNK = 40960;
  const madeBy = entry.versionMadeBy >> 8;
  let stat = new fs.Stats();
  // convert external file attr int into a fs stat mode int
  stat.mode = (entry.externalFileAttributes >> 16) & 0xFFFF;
  let statMode = new StatMode(stat);

  if ((stat.mode & IFMT) === IFLNK) {
    statMode.isSymbolicLink(true);
  }
  // check for windows weird way of specifying a directory
  // https://github.com/maxogden/extract-zip/issues/13#issuecomment-154494566
  else if ((stat.mode & IFMT) === IFDIR || (madeBy === 0 && entry.externalFileAttributes === 16)) {
    statMode.isDirectory(true);
  }
  else {
    statMode.isFile(true);
  }
  return stat;
}

function unzip(file, streamDestVinyl, options) {
  options = options || {};
  return new Promise((resolve, reject) => {

    fs.stat(file.path, (err, stats) => {
      if (err || !stats || stats.isDirectory()) {
        return reject(new FileFormatError());
      }

      fs.open(file.path, 'r', (err, fd) => {
        if (err) return reject(err);

        fs.read(fd, new Buffer(262), 0, 262, 0, (err, bytesRead, buffer) => {
          if (err) return reject(err);

          let type = fileType(buffer);
          if (!type || type.ext !== 'zip') {
            fs.close(fd, err => {
              if (err) return reject(err);
              reject(new FileFormatError());
            });
            return;
          }
          // Free the buffer
          buffer = null;

          // Start reading the zip file
          yauzl.fromFd(fd, { lazyEntries: true, autoClose: true }, (err, zipfile) => {
            if (err) return reject(err);

            zipfile.readEntry();
            zipfile.on("entry", entry => {
              if (options.strip) {
                try {
                  entry.fileName = stripDirs(entry.fileName, options.strip);
                } catch (err) {
                  return reject(new Error('The option "strip" must be a natural number or 0, but received "' + options.strip + '"'));
                }
              }

              let stat = _getStat(entry);
              let vinylOptions = {
                path: entry.fileName,
                stat: stat
              };

              function _writeVinylToStream(vinylOptions, stream) {
                stream.write(new Vinyl(vinylOptions));
              }

              if (stat.isDirectory() || stat.isSymbolicLink()) {
                _writeVinylToStream(vinylOptions, streamDestVinyl);
                zipfile.readEntry();
              }
              else {
                zipfile.openReadStream(entry, (err, readStream) => {
                  if (err) return reject(err);

                  readStream.on('end', _ => {
                    zipfile.readEntry();
                  });

                  vinylOptions.contents = readStream;
                  _writeVinylToStream(vinylOptions, streamDestVinyl);
                });
              }
            });

            zipfile.on("end", _ => {
              resolve();
            });

          });

        });
      });
    });

  });
}

module.exports = (options) => (file, streamDestVinyl) => unzip(file, streamDestVinyl, options);