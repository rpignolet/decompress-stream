const stream = require('stream');
const vfs = require('vinyl-fs');
const streamToArray = require('stream-to-array');

const FileFormatError = require('./errors/FileFormatError');

class Decompress {
  constructor(options) {
    this.files = [];
    this.plugins = [];
    this.dirs = [];
  }

  src(files) {
    if (!Array.isArray(files)) {
      files = [files];
    }
    this.files.push(...files);
    return this;
  }

  dest(dirs) {
    if (!Array.isArray(dirs)) {
      dirs = [dirs];
    }
    this.dirs.push(...dirs);
    return this;
  }

  use(plugin) {
    this.plugins.push(plugin);
    return this;
  }

  run() {
    let vfsReadStreamSrcFiles = vfs.src(this.files, {
      // Prevent vinyl-fs from creating the stream
      read: false
    });

    // Use to send Vinyl file to vfs.dest
    let streamDestVinyl = new stream.PassThrough({
      objectMode: true,
      allowHalfOpen: false
    });

    function _executeSeries(functions) {
      let func = functions.shift();
      if (typeof func !== 'function') {
        return Promise.resolve();
      }
      return func()
        .catch(err => {
          if (err instanceof FileFormatError) {
            return _executeSeries(functions);
          }
          return Promise.reject(err);
        })
    }

    /**
     * For each files, execute all plugins.
     */
    let _executePlugins = (files, fileStreamDest) => {
      var promisesFiles = files.map(file => {
        var functionsPlugins = this.plugins.map(plugin => {
          return () => plugin(file, fileStreamDest);
        });
        return _executeSeries(functionsPlugins);
      });
      return Promise.all(promisesFiles);
    }

    let vfsStreamDest = vfs.dest(this.dirs[0]);

    // The 'end' of the vfs.dest stream means the end of writing files
    let promiseVfsDestFinish = new Promise((resolve, reject) => {
      vfsStreamDest.on('error', err => {
        reject(err);
      });

      vfsStreamDest.on('end', _ => {
        resolve();
      });
    });

    streamDestVinyl.pipe(vfsStreamDest);

    return streamToArray(vfsReadStreamSrcFiles)
      .then(files => {
        return _executePlugins(files, streamDestVinyl);
      })
      .then(_ => {
        streamDestVinyl.end();
        return promiseVfsDestFinish;
      });
  }
}

module.exports = Decompress;