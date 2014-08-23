var fs = require('fs');

function load() {
    fs.readdir('./plugins/', function (err, files) {
        if (err) {
            throw err;
        }

        files.map(function (file) {
            if (fs.lstatSync('./plugins/' + file).isDirectory() && fs.lstatSync('./plugins/' + file + '/index.js').isFile()) {
                new (require('./plugins/' + file))();
            }
        });
    });
};

module.exports.load = load;