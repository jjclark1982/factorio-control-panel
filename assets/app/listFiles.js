var es = require('event-stream');
var vfs = require('vinyl-fs');

function listFiles(path, mountPath, callback) {
    var files = [];
    vfs.src(path, {read: false})
    .pipe(es.through(function(file){
        file.dirname = mountPath;
        files.push(file);
    }, function(end){
        callback(null, files);
    }));
}

module.exports = listFiles;
