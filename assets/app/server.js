#!/usr/bin/env node

var express = require('express');
var serveIndex = require('serve-index');
var bodyParser = require('body-parser');
var child_process = require('child_process');
var es = require('event-stream');
var pug = require('pug');
var basicAuth = require('basic-auth');
var crypto = require('crypto');
var vfs = require('vinyl-fs');
var Promise = require('bluebird');

var paths = {};
paths.base = process.env.FACTORIO_DIR || '/usr/local/factorio';
paths.saves = paths.base+'/saves';
paths.mods = paths.base+'/mods';
paths.exe = paths.base+'/bin/x64/factorio';

var salt = crypto.randomBytes(32);
var passwordHash = crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD || '', salt, 10000, 512, 'sha512');

var runningServer = null;

var app = express();

app.use('/saves', serveIndex(paths.saves, {icons: true}));
app.use('/saves', express.static(paths.saves));
app.use('/mods', serveIndex(paths.mods, {icons: true}));
app.use('/mods', express.static(paths.mods));
app.use('/static', express.static(__dirname+'/static'));
var admin = express.Router();
app.use('/', admin);

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
var listFilesAsync = Promise.promisify(listFiles);

admin.get('/', (req, res, next)=>{
    var saves = [];
    var mods = [];
    Promise.all([
        listFilesAsync(paths.saves+'/*.zip', 'saves')
        .then((files)=>{
            saves = files;
        }),
        listFilesAsync(paths.mods+'/*.zip', 'mods')
        .then((files)=>{
            mods = files;
        })
    ])
    .then(()=>{
        var options = {
            pretty: true,
            cache: process.env.NODE_ENV != 'debug'
        };
        adminTemplate = pug.compileFile('./admin.pug', options);
        context = {
            runningServer: runningServer,
            saves: saves,
            mods: mods
        };
        html = adminTemplate(context);
        res.send(html);        
     });
});

admin.get('/version', (req, res, next)=>{
    res.runCommand(paths.exe, ['--version']);
});

admin.use((req, res, next)=>{
    // allow read-only methods
    if (['GET', 'HEAD', 'OPTIONS'].indexOf(req.method) !== -1) {
        return next();
    }
    // require password for other methods
    var user = basicAuth(req) || {pass: ''};
    crypto.pbkdf2(user.pass, salt, 10000, 512, 'sha512', (err, hash)=>{
        if (err) {
            return next(err);
        }
        if (Buffer.compare(hash, passwordHash) !== 0) {
            res.set('WWW-Authenticate', 'Basic realm=Authorization Required');
            res.sendStatus(401);
        }
        // password was correct
        next();
    })
});

admin.use(bodyParser.urlencoded({extended: false}));

admin.use((req, res, next)=>{
    res.runCommand = (cmd, args, env)=> {
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

admin.post('/create-save', (req, res, next)=>{
    var saveName = req.body.saveName;
    if (saveName) {
        res.runCommand(paths.exe, ['--create', saveName]);
    }
    else {
        res.status(400).send("You must specify a save name");
    }
});

admin.post('/upload-save', (req, res, next)=>{
    res.status(501).send("Not implemented");
});

admin.post('/transload-mod', (req, res, next)=>{
    res.status(501).send("Not implemented");
});

admin.post('/upload-mod', (req, res, next)=>{
    res.status(501).send("Not implemented");
});

admin.post('/start-server', (req, res, next)=>{
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
        runningServer.on('exit', (code, signal)=>{
            runningServer = null;
        });
    }
});

admin.post('/stop-server', (req, res, next)=>{
    if (runningServer == null) {
        res.send("sorry, server is not running");
    }
    else {
        runningServer.kill('SIGTERM')
        res.send("server stopped, maybe");
    }
});

app.use('/', express.static(__dirname));

var server = app.listen(process.env.PORT || 8000, ()=>{
    console.log('HTTP server is running on port %s', server.address().port);
});
