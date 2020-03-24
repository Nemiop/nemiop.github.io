const { watch } = require('gulp');
const webpack = require('webpack');
const path = require('path');

const compiler = webpack({
  mode: 'development',
  entry: './index.js',
  output: {
    filename: 'bundle.js',
    path: path.resolve(__dirname)
  }
});

function bundle() {
  return new Promise((resolve, reject) => {
    compiler.run((err, stats) => {
      if (err) {
        console.error(err);
        reject(err);
      }
      console.log(stats.toString({
        colors: true
      }));
      resolve();
    });
  });
}

function watchFiles() {
  watch(['./index.js', './scenes/*.js'], { ignoreInitial: false }, bundle);
}

exports.default = watchFiles;
exports.bundle = bundle;
