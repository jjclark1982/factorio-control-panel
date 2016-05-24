var fs = require('fs');
var request = require('request');
var contentDisposition = require('content-disposition');
var sysPath = require('path');
var sysURL = require('url');
var debug = require('debug')('transload');

function transload(options) {
    return (req, res, next)=>{
        var fileURL = req.body.fileURL;
        debug('requesting %s', fileURL);
        request(fileURL)
        .on('error', next)
        .on('response', (response)=>{
            var dispo = contentDisposition.parse(response.headers['content-disposition']);
            var filename = dispo.parameters.filename;
            if (!filename) {
                filename = sysPath.basename(sysURL.parse(fileURL).pathname);
            }
            var filePath = sysPath.join(options.dir, filename);
            debug('writing %s', filePath);
            response.pipe(fs.createWriteStream(filePath));
            res.send('installed '+filename);
        })
    }
}

module.exports = transload;
