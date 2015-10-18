# node-cbt #

[CrossBrowserTesting.com](http://www.crossbrowsertesting.com/) utilities for node.js projects.

## Usage ##

### Starting a CBT tunnel ###

```
var Tunnel = require('node-cbt').Tunnel,
    tunnel = new Tunnel({apiKey: 'u35d333dhfhapp'}).runTunnel().then(function(tunnelProc){
        ...
        tunnelProc.kill();
    });
```
### Configuring Karma tests ###
```
var KarmaConfigGenerator = require('node-cbt').KarmaConfigGenerator,
    karmaOptions = {
        configFile: 'karma.conf.js',
        singleRun: true
    };
new KarmaConfigGenerator({
    userName: 'exchangeteam@pulsepoint.com',
    apiKey: 'ue2434ge3kd',
    projectName: require('./package.json').name,
    projectVersion: require('./package.json').version,
    testId: Math.ceil(Math.ceil(new Date().getTime() + Math.random() * 100000) % 10000),
}).updateKarmaConfig(karmaOptions);
/* set a CBT browser to use */
karmaOptions.browsers = ['chrome-45-win-7-x64'];
...
new karma.Server(karmaOptions, function(exitCode){
    ...
});
```

## Building ##
* ```npm install```
* ```npm run jshint```
* ```npm run test```

## Releasing ##
* Update package.json
* ```git tag -a 1.0.0 -m 'node-cbt 1.0.0 release'```