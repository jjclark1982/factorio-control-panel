#!/usr/bin/env node

var express = require('express');
var serveIndex = require('serve-index');
var bodyParser = require('body-parser');
var child_process = require('child_process');
var es = require('event-stream');
var pug = require('pug');

var factorioDir = '/usr/local/factorio';
var factorioExe = factorioDir+'/bin/x64/factorio';
var runningServer = null;

var app = express();

app.use('/saves', serveIndex(factorioDir+'/saves', {icons: true}));
app.use('/saves', express.static(factorioDir+'/saves'));
app.use('/mods', serveIndex(factorioDir+'/mods', {icons: true}));
app.use('/mods', express.static(factorioDir+'/mods'));
var admin = express.Router();
app.use('/', admin);

admin.get('/', function(req, res, next){
    var options = {
        pretty: true,
        cache: false
    };
    adminTemplate = pug.compileFile('./admin.pug', options);
    context = {runningServer: runningServer};
    html = adminTemplate(context);
    res.send(html);
});

admin.use(bodyParser.urlencoded({extended: false}));
admin.post('/create-save', function(req, res, next){
    res.type('html');
    res.writeContinue();
    for (var i = 0; i < 20; i++) {
        res.write("                                                  \n");
    }
    res.write('<!DOCTYPE html><html><body><pre>');

    var saveName = req.body.saveName;
    var child = child_process.spawn(factorioExe, ['--create', saveName]);
    es.merge([child.stdout, child.stderr])
    .pipe(es.through(function(text){
        this.emit('data', text);
    }, function(end){}))
    .pipe(res);

    child.on('exit', function(code, signal){
        if (code != 0) {
            res.write('<b>Error '+code+"</b>\n");
        }
        res.write('</pre><a href=".">Back to Admin Panel</a>');
        res.end();
    });
});

admin.post('/start-server', function(req, res, next){
    var saveName = req.body.saveName;    
    if (runningServer != null) {
        res.send("sorry, server is already running");
    }
    else {
        runningServer = child_process.spawn(factorioExe, ['--start-server', saveName]);
        runningServer.startDate = new Date();
        runningServer.on('exit', function(code, signal){
            runningServer = null;
        });
        res.send("server started, maybe");
    }
});

admin.post('/stop-server', function(req, res, next){
    var saveName = req.body.saveName;    
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
    console.log('server is running at %s', server.address().port);
});
