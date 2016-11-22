#!/usr/bin/env node

var express = require('express');
var bodyParser = require('body-parser');
var basicAuth = require('basic-auth');
var multer = require('multer');
var morgan = require('morgan');
var crypto = require('crypto');
var pug = require('pug');
var moment = require('moment');
var Promise = require('bluebird');

var runCommand = require('./lib/runCommand');
var listFiles = Promise.promisify(require('./lib/listFiles'));
var transload = require('./lib/transload');

var paths = {};
paths.base = process.env.FACTORIO_DIR || '/usr/local/factorio';
paths.saves = paths.base+'/saves';
paths.mods = paths.base+'/mods';
paths.exe = paths.base+'/bin/x64/factorio';
paths.config = paths.base+'/data';

var configLoaded = false;
var configName = 'server-settings.example.json';

function saveNameToPath(name) {
    return paths.saves + '/' + name.replace(/^[.]+/g, '_') + '.zip';
}

function configPath(con) {
  if (con === "" || con === null){
    con = configName;
  }
  return  paths.config + '/' + con;
}

var salt = crypto.randomBytes(32);
var passwordHash = crypto.pbkdf2Sync(process.env.ADMIN_PASSWORD || '', salt, 10000, 512, 'sha512');

var runningServer = null;


var app = express();

app.use(morgan('common'));
app.use('/saves', express.static(paths.saves));
app.use('/mods', express.static(paths.mods));
app.use('/static', express.static(__dirname+'/static'));

var admin = express.Router();
app.use('/', admin);

function sortTags(tags){
  var tagsf = ""
  for(i = 0; i < tags.length -1; i++){
    tagsf = tagsf + tags[i] + ",";
  };
  tagsf = tagsf + tags[i]
  return tagsf
}

admin.get('/', (req, res, next)=>{
  var fs = require("fs");
  var confi = fs.readFileSync(configPath(configName));
  parsedConfig = JSON.parse(confi);
  parsedConfig.tags = sortTags(parsedConfig.tags)

    var saves = [];
    var mods = [];
    Promise.all([
        listFiles(paths.saves+'/*.zip', 'saves')
        .then((files)=>{
            saves = files;
        }),
        listFiles(paths.mods+'/*.zip', 'mods')
        .then((files)=>{
            mods = files;
        })
    ])
    .then(()=>{
        var options = {
            pretty: true,
            cache: process.env.NODE_ENV != 'debug'
        };
        adminTemplate = pug.compileFile(__dirname+'/admin.pug', options);
        context = {
            parsedConfig: parsedConfig,
            moment: moment,
            runningServer: runningServer,
            saves: saves,
            mods: mods
        };
        html = adminTemplate(context);
        res.send(html);
     });
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

admin.use(runCommand.middleware);

admin.get('/version', (req, res, next)=>{
    res.runCommand(paths.exe, ['--version']);
});

admin.use(bodyParser.urlencoded({extended: false}));

admin.post('/create-save', (req, res, next)=>{
    var saveName = req.body.saveName;
    if (saveName) {
        res.runCommand(paths.exe, ['--create', saveNameToPath(saveName)]);
    }
    else {
        res.status(400).send("You must specify a save name");
    }
});

admin.post('/saves', (req, res, next)=>{
    var storage = multer.diskStorage({
        destination: (req, file, callback)=>{
            callback(null, paths.saves);
        },
        filename: (req, file, callback)=>{
            callback(null, file.originalname);
        }
    });
    var upload = multer({storage: storage}).single('file');
    upload(req, res, (err)=>{
        if (err) {
            return next(err);
        }
        res.setHeader('Refresh', '1;.');
        res.redirect(201, '.');
    });
});

admin.post('/transload-mod', transload({dir: paths.mods}));

admin.post('/mods', (req, res, next)=>{
    var storage = multer.diskStorage({
        destination: (req, file, callback)=>{
            callback(null, paths.mods);
        },
        filename: (req, file, callback)=>{
            callback(null, file.originalname);
        }
    });
    var upload = multer({storage: storage}).single('file');
    upload(req, res, (err)=>{
        if (err) {
            return next(err);
        }
        res.setHeader('Refresh', '1;.')
        res.redirect(201, '.');
    });
});

admin.post('/start-server', (req, res, next)=>{
    req.body.saveName = saveNameToPath(req.body.saveName);
    req.body.configfile = configPath(req.body.configfile);
    if (runningServer != null) {
        res.send("sorry, server is already running");
    }
    else {
        var supportedArgs = {
            saveName: '--start-server',
            latencyMS: '--latency-ms',
            autosaveInterval: '--autosave-interval',
            autosaveSlots: '--autosave-slots',
            port: '--port',
            configfile: '--server-settings'
        }
        var supportedFlags = {
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
        runCommand.pipeOutput(runningServer, res);
        runningServer.kill('SIGTERM');
    }
});

admin.post('/console-command', (req, res, next)=>{
    if (runningServer == null) {
        res.send("sorry, server is not running");
    }
    else {
        runCommand.pipeOutput(runningServer, res);
        runningServer.stdin.write(req.body.command);
    }
});

module.exports = app;

if (module == require.main) {
    var server = app.listen(process.env.PORT || 8000, ()=>{
        console.log('HTTP server is running on port %s', server.address().port);
    });
}
