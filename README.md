# node-cbt #

[CrossBrowserTesting.com](http://www.crossbrowsertesting.com/) utilities for node.js projects.  Utilities include a Tunnel wrapper and a Karma configuration helper.

## Usage ##

### Installing ###
Update ```package.json``` to include the following dependencies:

```
    "karma-webdriverio-launcher": "git://github.com/tatablack/karma-webdriverjs-launcher.git",
    "cbt-util": "git+ssh://git@github.com:pulsepointinc/node-cbt.git#1.0.1",
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
