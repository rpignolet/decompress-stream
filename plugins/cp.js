const path = require('path');
const fs = require('fs-extra');
const through2 = require('through2');
const Vinyl = require('vinyl');

function _writeVinylToStream(vinylOptions, streamDestVinyl) {
  return new Promise((resolve, reject) => {
    let isFile = vinylOptions.stat && vinylOptions.stat.isFile();

    if (isFile) {
      let streamFileContents = fs.createReadStream(vinylOptions.path);
      streamFileContents.on('end', _ => {
        return resolve();
      });
      vinylOptions.contents = streamFileContents;
    }

    streamDestVinyl.write(new Vinyl(vinylOptions));
    if (!isFile) {
      return resolve();
    }
  });
}

function cp(file, streamDestVinyl) {
  return new Promise((resolve, reject) => {
    fs.stat(file.path, (err, stats) => {
      if (err || !stats) {
        return resolve();
      }
      else if (stats.isFile()) {
        let vinylOptions = {
          cwd: path.dirname(file.path),
          path: file.path,
          stat: stats
        };

        _writeVinylToStream(vinylOptions, streamDestVinyl).then(_ => {
          return resolve();
        });
        return;
      }
      else if (!stats.isDirectory()) {
        return resolve();
      }

      let _streamWriteVinylToStream = through2.obj(function (item, enc, next) {
        let vinylOptions = {
          cwd: file.path,
          path: item.path,
          stat: item.stats
        };

        _writeVinylToStream(vinylOptions, streamDestVinyl).then(_ => {
          next();
        });
      }, function (callback) {
        resolve();
        callback();
      });

      fs.walk(file.path).pipe(_streamWriteVinylToStream);
    });
  });
}

module.exports = () => (file, streamDestVinyl) => cp(file, streamDestVinyl);
