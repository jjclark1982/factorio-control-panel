var ansi_up = require('ansi_up');
var child_process = require('child_process');
var es = require('event-stream');

function runCommand(req, res, next) {
    res.runCommand = (cmd, args, env)=> {
        res.type('html');
        res.writeContinue();
        for (var i = 0; i < 20; i++) {
            res.write("                                                  \n");
        }
        res.write('<!DOCTYPE html><html><head><link rel="stylesheet" href="static/main.css"></head><body><pre>');
        res.write('<b>$ '+cmd+' '+args.join(' ')+'\n</b>');

        var child = child_process.spawn(cmd, args, env);
        es.merge([child.stdout, child.stderr])
        .pipe(es.through(function(text){
            var html = ansi_up.ansi_to_html(ansi_up.escape_for_html(''+text));
            this.emit('data', html);
        }, function(end){
            this.emit('data', '</pre><a href=".">Back to Control Panel</a>');
            this.emit('end');
        }))
        .pipe(res);

        // child.on('exit', (code, signal)->
        //     if code isnt 0
        //         res.write('<b>Error '+code+"</b>\n")
        //     res.write('</pre><a href=".">Back to Admin Panel</a>')
        //     res.end()
        // )

        // # support stopping the build if res.connection closes
        // unless req.body.nohup
        //     res.on('close', ->
        //         child.kill('SIGHUP')
        //     )

        return child;
    };
    next();
}

module.exports = runCommand;
