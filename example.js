const path = require('path');
const Decompress = require('.');
const unzip = require('./plugins/unzip');
const untar = require('./plugins/untar');
const untargz = require('./plugins/untargz');
const cp = require('./plugins/cp');

let instance = new Decompress();

instance
  .src(path.join(__dirname, 'test.zip'))
  .dest('test')
  .use(unzip({strip: 1}))
  .use(untargz({strip: 1}))
  .use(untar({strip: 1}))
  .use(cp())
  .run()
  .then(_ => {
    console.log('Decompress done');
  })
  .catch(err => {
    console.log('Decompress error', err);
  });