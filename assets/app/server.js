#!/usr/bin/env node

var express = require('express');
var serveIndex = require('serve-index');
var bodyParser = require('body-parser');
var child_process = require('child_process');
var es = require('event-stream');
var pug = require('pug');
var fs = require('fs');

var paths = {};
paths.base = '/usr/local/factorio';
paths.saves = paths.base+'/saves';
paths.mods = paths.base+'/mods';
paths.exe = paths.base+'/bin/x64/factorio';

var runningServer = null;

var app = express();

app.use('/saves', serveIndex(paths.saves, {icons: true}));
app.use('/saves', express.static(paths.saves));
app.use('/mods', serveIndex(paths.mods, {icons: true}));
app.use('/mods', express.static(paths.mods));
app.use('/static', express.static(__dirname+'/static'));
var admin = express.Router();
app.use('/', admin);

admin.get('/', function(req, res, next){
    fs.readdir(paths.saves, function(err, files){
        if (err && err.code != 'ENOENT') {
            return next(err);
        }
        files = files || [];
        var saves = [];
        for (var i = 0; i < files.length; i++) {
            var filename = files[i];
            if (filename[0] == '.') {
                continue;
            }
            var save = {
                path: '/saves/'+filename,
                title: filename.replace(/\.zip$/, '')
            }
            saves.push(save);
        }
        var options = {
            pretty: true,
            cache: false
        };
        adminTemplate = pug.compileFile('./admin.pug', options);
        context = {
            runningServer: runningServer,
            saves: saves,
            mods: []
        };
        html = adminTemplate(context);
        res.send(html);
    });
});

admin.get('/version', function(req, res, next){
    res.runCommand(paths.exe, ['--version']);
});

admin.use(function(req, res, next){
    // require password to make changes
    if (req.method == POST) {

    }
    next();
});

admin.use(bodyParser.urlencoded({extended: false}));

admin.use(function(req, res, next){
    res.runCommand = function(cmd, args, env) {
        res.type('html');
        res.writeContinue();
        for (var i = 0; i < 20; i++) {
            res.write("                                                  \n");
        }
        res.write('<!DOCTYPE html><html><body><pre>');
        res.write('<b>$ '+cmd+' '+args.join(' ')+'\n</b>');

        var child = child_process.spawn(cmd, args, env);
        es.merge([child.stdout, child.stderr])
        .pipe(es.through(function(text){
            this.emit('data', text);
        }, function(end){
            this.emit('data', '</pre><a href=".">Back to Control Panel</a>');
            this.emit('end');
        }))
        .pipe(res);

        return child;
    };
    next();
});

admin.post('/create-save', function(req, res, next){
    var saveName = req.body.saveName;
    if (saveName) {
        res.runCommand(paths.exe, ['--create', saveName]);
    }
    else {
        res.status(400).send("You must specify a save name");
    }
});

admin.post('/upload-save', function(req, res, next){
    res.status(501).send("Not implemented");
});

admin.post('/transload-mod', function(req, res, next){
    res.status(501).send("Not implemented");
});

admin.post('/upload-mod', function(req, res, next){
    res.status(501).send("Not implemented");
});

admin.post('/start-server', function(req, res, next){
    var saveName = req.body.saveName;
    if (runningServer != null) {
        res.send("sorry, server is already running");
    }
    else {
        var supportedArgs = {
            saveName: '--start-server',
            latencyMS: '--latency-ms',
            autosaveInterval: '--autosave-interval',
            autosaveSlots: '--autosave-slots',
            port: '--port'
        }
        var supportedFlags = {
            disallowCommands: '--disallow-commands',
            peerToPeer: '--peer-to-peer',
            noAutoPause: '--no-auto-pause'
        }

        var args = [];
        for (var i in supportedArgs) {
            if (req.body[i]) {
                args.push(supportedArgs[i]);
                args.push(req.body[i]);
            }
        }
        for (var i in supportedFlags) {
            if (req.body[i]) {
                args.push(supportedFlags[i]);
            }
        }

        runningServer = res.runCommand(paths.exe, args);
        runningServer.startDate = new Date();
        runningServer.port = req.body.port || '34197';
        runningServer.on('exit', function(code, signal){
            runningServer = null;
        });
    }
});

admin.post('/stop-server', function(req, res, next){
    if (runningServer == null) {
        res.send("sorry, server is not running");
    }
    else {
        runningServer.kill('SIGTERM')
        res.send("server stopped, maybe");
    }
});

app.use('/', express.static(__dirname));

var server = app.listen(process.env.PORT || 8000, function(){
    console.log('HTTP server is running on port %s', server.address().port);
});
