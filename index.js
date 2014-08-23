var fs = require('fs');

function load() {
    var dir = __dirname + '/plugins/';
    fs.readdir(dir, function (err, files) {
        if (err) {
            throw err;
        }

        files.map(function (file) {
            if (fs.lstatSync(dir + file).isDirectory() && fs.lstatSync(dir + file + '/index.js').isFile()) {
                new (require(dir + file))();
            }
        });
    });
};

module.exports.load = load;
