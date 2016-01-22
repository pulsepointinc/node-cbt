# node-cbt #

[CrossBrowserTesting.com](http://www.crossbrowsertesting.com/) utilities for node.js projects.  Utilities include a Tunnel wrapper and a Karma configuration helper.

## Usage ##

### Installing ###
Update ```package.json``` to include the following dependencies:

```
    "karma": "~0.13",
    "karma-webdriverio-launcher": "git://github.com/ProfessorEugene/karma-webdriverio-launcher.git#0.1.1",
    "node-cbt": "git+ssh://git@github.com:pulsepointinc/node-cbt.git#1.0.8",
```

The ```karma-webdriverio-launcher``` dependency is declared as a peerDependency in ```node-cbt```; since strict peer dependencies will be deprecated in npm 3, it's necessary to explicitly add this dependency to projects that require karma integration.

### Starting a CBT tunnel ###
In order to use the CBT tunnel, java 7+ needs to be available on the path.
```
var Tunnel = require('node-cbt').Tunnel,
    tunnel = new Tunnel({apiKey: 'u35d333dhfhapp'}).runTunnel().then(function(tunnelProc){
        ...
        tunnelProc.kill();
    });
```
### Configuring Karma tests ###
A ```KarmaUtil`` object allows one to spawn a tunnel and configure a Karma server for CBT tests:
```
var cbtkarma = require('node-cbt').KarmaUtil;
cbtkarma.runKarma({
    /* general karma options */
    configFile: __dirname + '/karma.conf.js',
    singleRun: true,   
    /* required CBT parameters */
    cbtUsername: cbtUserName, // required CBT username
    cbtApiKey: cbtApiKey, // required CBT API key
    cbt: true, // whether or not to run over CBT 
    /* optional CBT parameters */
    cbtHubURL: 'hub.crossbrowsertesting.com', // CBT selenium hub url
    cbtHubPort: 80, // CBT selenium hub port
    cbtLogLevel: 'silent', // selenium driver log level - verbose | silent | command | data | result
    cbtProjectName: require('./package.json').name, // optional project name to name tests
    cbtProjectVersion: require('./package.json').version // optional project version to name tests
    cbtTestId: Math.floor(Math.random()*10000), // optional test id to name/group tests
    cbtScreenResolution: '1024x768', // desired screen resolution
    cbtRecordVideo: 'false', // whether or not to record video
    cbtRecordNetwork: 'false', // whether or not to record network
    cbtRecordSnapshot: 'false', // whether or not to record snapshots
}).then(funciton(exitCode){
...  
});
```

or to simply run karma using IE10 in CBT via gulp task (reading ```cbtUserName``` and ```cbtApiKey``` from env variables:
```
var cbtkarma = require('node-cbt').KarmaUtil;
gulp.task('cbt-test', [], function(done) {
    cbtkarma.runKarma({
        configFile: __dirname + '/karma.conf.js',
        singleRun: true,
        cbtUserName: process.env.CBT_USERNAME,
        cbtApiKey: process.env.CBT_API_KEY,
        cbt: true,
        browsers: ['ie-10-win-8']
    }).then(function(){
        done();
    }).catch(function(exitCode){
        done(new Error('Karma server exited with code: ' + exitCode));
    });
});
```

## Building ##
* ```npm install``` - installs npm modules
* ```npm run jshint``` - runs jshint
* ```npm run test``` - runs tests
* ```npm run release``` - performs a release

## Releasing ##
* Update package.json
* ```git tag -a 1.0.0 -m 'node-cbt 1.0.0 release'```
