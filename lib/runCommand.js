var ansi_up = require('ansi_up');
var child_process = require('child_process');
var es = require('event-stream');

module.exports.header = '<!DOCTYPE html><html><head><link rel="stylesheet" href="static/main.css"></head><body><pre>';
module.exports.footer = '</pre><a href=".">Back to Control Panel</a>';

function pipeOutput(child, res) {
    res.type('html');
    res.writeContinue();
    for (var i = 0; i < 20; i++) {
        res.write("                                                  \n");
    }
    res.write(module.exports.header);

    es.merge([child.stdout, child.stderr])
    .pipe(es.through(function(text){
        var html = ansi_up.ansi_to_html(ansi_up.escape_for_html(''+text));
        this.emit('data', html);
    }, function(end){
        this.emit('data', module.exports.footer);
        this.emit('end');
    }))
    .pipe(res);
}
module.exports.pipeOutput = pipeOutput;

function middleware(req, res, next) {
    res.runCommand = (cmd, args, env)=> {
        var child = child_process.spawn(cmd, args, env);
        child.on('error', (err)=>{
            res.write('<b>'+err.toString()+'</b>');
        });

        pipeOutput(child, res);
        res.write('<b>$ '+cmd+' '+args.join(' ')+'</b>\n');

        return child;
    };
    next();
}
module.exports.middleware = middleware;
