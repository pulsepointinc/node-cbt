var q = require('q'),
    fs = require('fs'),
    path = require('path'),
    request = require('request'),
    spawn = require('child_process').spawn,
    gutil = require('gulp-util'),
    us = require('underscore'),
    karma = require('karma');
/**
 * An internal static utility object
 */
var Util = {
    /**
     * Log something to console
     * @param {object} message
     */
    log: function(){
        var message = arguments[0],
            lines = message.split('\n');
        lines.forEach(function(line){
            gutil.log('[CBT]:',line);
        });
    },
    /**
     * Silently mkdir at path
     * @param {string} path - path to mkdir
     */
    mkDir: function(path){
        try{
            /* mkdir */
            fs.mkdirSync(path);
        }catch(dirAlraedyExists){
            /* ignore */
        }
    },
    /**
     * Download a file; returns a promise that resolves to the downloaded file path
     * @param {string} url - URL to download
     * @param {string} path - path to download to
     * @return {object} promise that resolves to the downloaded file path
     */
     download: function(url,path){
        return new q.Promise(function(resolve,reject){
            var fileStream = fs.createWriteStream(path);
            request.get(url).on('error',function(err){
                fs.unlinkSync(path);
                reject(err);
            }).pipe(fileStream).on('finish',function(){
                fileStream.close();
                resolve(path);
            });
        });
    }
};

/**
 * A CBT Tunnel wrapper; used to download a CBT tunnel binary, spawn it, and wait for a connection
 * Example usage:
 * <pre><code>
 * new Tunnel({}).runTunnel().then(function(tunnelProc){
 *   ...
 *   tunnelProc.kill();
 * });
 * </code></pre>
 * @param {object} config - optional configuration object that has keys for tunnelBinPath, tunnelBinURL, and
 *                  tunnelStartupTimeout (ms), apiKey (string)
 * @constructor
 */
var Tunnel = function(config){
    this.config = us.extend({
        tunnelBinPath: './bin/cbttunnel.jar',
        tunnelBinURL: 'https://crossbrowsertesting.com/cbttunnel.jar',
        tunnelStartupTimeout: 1000 * 60 * 2,
    },config);
};
Tunnel.prototype = {
    /**
     * Download or pull tunnel java binary from cache; return a promise that resolves to the path
     * of the downloaded tunnel binary
     * @param {string} tunnelBinURL - cbttunnel.jar binary URL
     * @param {string} tunnelBinPath - path of a directory to download cbttunnel.jar binary into
     * @return {object} promise that resolves to the path of the downloaded tunnel binary
     */
    downloadTunnelBin: function(tunnelBinURL,tunnelBinPath){
        return new q.Promise(function(resolve,reject){
            try {
                /* check if tunnel is already downloaded */
                fs.lstatSync(tunnelBinPath);
                resolve(tunnelBinPath);
            }catch(noCbtTunnelExists){
                Util.log(tunnelBinPath+' not present; downloading from '+tunnelBinURL);
                Util.mkDir(path.dirname(tunnelBinPath));
                resolve(Util.download(tunnelBinURL, tunnelBinPath));
            }
        });
    },
    /**
     * Spawn a cbttunnel proc; returns a promise that resolves to spawned cbttunnel proc
     * @param {string} tunnelBinPath - cbttunnel.jar binary path
     * @param {string} apiKey - cbt API key
     * @return {object} promise that resolves to a spawned cbttunnel proc
     */
    spawnTunnelProc: function(tunnelBinPath, apiKey){
        var me = this;
        return new q.Promise(function(resolve,reject){
            Util.log('Spawning cbttunnel process...');
            me.cbtProc = spawn('java', ['-jar',tunnelBinPath,'-authkey',apiKey], { stdio: 'pipe' });
            /* register killer on process exit */
            process.on('exit', function(){
                me.close();
            });
            resolve(me.cbtProc);
        });
    },
    /**
     * Wait for a tunnel to connect; returns a promise that resolves to spawned and connected 
     * cbttunnel proc.
     * @param {object} tunnelProc - a running cbttunnel.jar proc
     * @return {object} promise that resolves to a connected cbttunnel proc
     */
    awaitTunnelStartup: function(tunnelProc, connectTimeout){
        return new q.Promise(function(resolve,reject){
            /* set a failure timeout */
            var failTimeout = setTimeout(function(){
                if(tunnelProc !== null && tunnelProc !== undefined){
                    tunnelProc.kill();
                }
                reject('Timed out waiting for tunnel to connect after '+connectTimeout+'ms');
            }, connectTimeout);
            /* read process stdout stream */
            tunnelProc.stdout.on('data', function(dataBuffer){
                /* convert stdout data chunk into lines */
                var data = dataBuffer.toString(),
                    dataLines = data.split('\n');
                /* for each line in chunk */
                dataLines.forEach(function(line){
                    if(line === undefined || line === null || line === ''){
                        return;
                    }
                    if(line.match(/CONNECTED/g)){
                        /* tunnel is connected; can resolve */
                        clearTimeout(failTimeout);
                        Util.log("CBT Tunnel started");
                        Util.log("\nVisit http://app.crossbrowsertesting.com/selenium to view test progress\n");
                        Util.log("\n!IMPORTANT!");
                        Util.log("If connections to CBT time out, they may not be automatically stopped and eat into CBT account minutes");
                        Util.log("Please make sure to STOP all tests after the completion of a run!");
                        Util.log("!IMPORTANT!\n");
                        resolve(tunnelProc);
                    }
                });
            });
        });
    },
    /**
     * Download, spawn cbt tunnel process, and wait for a successful connection; returns a promise that
     * resolves to a spawned, connected cbt tunnel process
     * @return {object} promise that resolves to a connected cbt tunnel process
     */
    runTunnel: function(){
        return this.downloadTunnelBin(this.config.tunnelBinURL,this.config.tunnelBinPath)
                .then(function(tunnelBinPath){
                    return this.spawnTunnelProc(tunnelBinPath,this.config.apiKey);
                }.bind(this))
                .then(function(tunnelProc){
                    return this.awaitTunnelStartup(tunnelProc, this.config.tunnelStartupTimeout);
                }.bind(this));
    },
    /**
     * Close tunnel, killing off spawned process
     */
    close: function(){
        if(this.cbtProc){
            this.cbtProc.kill();
        }
    }
};

/**
 * A popular browser object
 */
var PopularBrowsers = {
    /* chrome 45 win 7 64 bit */
    'chrome-45-win-7-x64': {
        browserName: 'chrome',
        browser_api_name: 'Chrome45',
        os_api_name: 'Win7x64-C1'
    },
    /* chrome 44 win 7 */
    'chrome-44-win-7': {
        browserName: 'chrome',
        browser_api_name: 'Chrome44',
        os_api_name: 'Win7-C1'
    },
    /* chrome 43 win xp sp3 */
    'chrome-33-win-xp-sp3': {
        browserName: 'chrome',
        browser_api_name: 'Chrome33',
        os_api_name: 'WinXPSP3'
    },
    /* ffx 40 win 8 */
    'firefox-40-win-8': {
        browserName: 'firefox',
        browser_api_name: 'FF40',
        os_api_name: 'Win8'
    },
    /* ffx 39 win 7 */
    'firefox-39-win-7': {
        browserName: 'firefox',
        browser_api_name: 'FF39',
        os_api_name: 'Win7-C1'
    },
    /* ffx 38 win vista */
    'firefox-38-win-vista': {
        browserName: 'firefox',
        browser_api_name: 'FF38',
        os_api_name: 'WinVista-C2'
    },
    /* ie11 win 8.1 [warning: wonky selenium driver as of 10/2015] */
    'ie-11-win-8.1': {
        browserName: 'internet explorer',
        browser_api_name: 'IE11',
        os_api_name: 'Win8.1'
    },
    /* ie10  win 8 */
    'ie-10-win-8': {
        browserName: 'internet explorer',
        browser_api_name: 'IE10',
        os_api_name: 'Win8'
    },
    /* ie9 win7*/
    'ie-9-win-7': {
        browserName: 'internet explorer',
        browser_api_name: 'IE9',
        os_api_name: 'Win7-C2'
    },
    /* ie8 win vista */
    'ie-8-win-vista': {
        browserName: 'internet explorer',
        browser_api_name: 'IE8',
        os_api_name: 'WinVista-C4'
    },
    /* safari 8 osx 10.10 */
    'safar-8-osx-10.10': {
        browserName: 'safari',
        browser_api_name: 'Safari8',
        os_api_name: 'Mac10.10'
    },
    /* chrome mob 38 Android galaxy tab 2 / android 4.1*/
    'chrome-mob-38-android-galaxy-tab-2-4.1': {
        browserName: 'chrome',
        browser_api_name: 'MblChrome38',
        os_api_name: 'GalaxyTab2-And41',
        screen_resolution: '1280x800'
    },
    /* mob safari 8.0 ipad air ios 8.1 */
    'safari-mob-8.0-ipad-air-ios-8.1': {
        browserName: 'safari',
        browser_api_name: 'MblSafari8.0',
        os_api_name: 'iPadAir-iOS8Sim'
    },
    /* mob safari 8.0 iphone 6 ios 8.1 */
    'safari-mob-8.0-iphone-6-ios-8.1': {
        browserName: 'safari',
        browser_api_name: 'MblSafari8.0',
        os_api_name: 'iPhone6-iOS8sim',
        screen_resolution : '750x1334'
    }
};

/**
 * Karma CBT utitlies; can be used to create a CBT + webdriver karma configuration with all popular browsers,
 * start a Tunnel and run Karma tests over CBT.  Example usage:
 * <pre><code>
 * var cbtkarma = require('node-cbt').KarmaUtil;
 * cbtkarma.runKarma({
 *       //general karma options
 *      configFile: __dirname + '/karma.conf.js',
 *      singleRun: true,   
 *      //required parameters
 *      cbtUsername: cbtUserName, // required CBT username
 *      cbtApiKey: cbtApiKey, // required CBT API key
 *      cbt: true, // whether or not to run over CBT 
 *      //optional parameters
 *      cbtHubURL: 'hub.crossbrowsertesting.com', // CBT selenium hub url
 *      cbtHubPort: 80, // CBT selenium hub port
 *      cbtLogLevel: 'silent', // selenium driver log level - verbose | silent | command | data | result
 *      cbtProjectName: require('./package.json').name, // optional project name to name tests
 *      cbtProjectVersion: require('./package.json').version // optional project version to name tests
 *      cbtTestId: Math.floor(Math.random()*10000), // optional test id to name/group tests
 *      cbtScreenResolution: '1024x768', // desired screen resolution
 *      cbtRecordVideo: 'false', // whether or not to record video
 *      cbtRecordNetwork: 'false', // whether or not to record network
 *      cbtRecordSnapshot: 'false', // whether or not to record snapshots
 * }).then(funciton(exitCode){
 *   ...  
 * });
 * </code></pre>
 */
KarmaUtil = {
    /**
     * Given karma server options, update them to include custom launchers and return updated configuration
     * @param {object}  options - standard karma server options plus some CBT specific keys
     * @param {string}  options.cbtUsername - mandatory CBT username
     * @param {string}  options.cbtApiKey - mandatory CBT API key
     * @param {boolean} options.cbt - flag to specify whether or not to run karma via CBT
     * @param {string)  options.cbtHubURL - optional CBT selenium hub host name (defaults to 'hub.crossbrowsertesting.com')
     * @param {number}  options.cbtHubPort - optional CBT selenium hub port (defaults to 80)
     * @param {string}  options.cbtLogLevel - optional selenium log level, one of 'verbose', 'silent', 'command', 'data', or 'result' (defaulst to 'silent')
     * @param {string}  options.cbtProjectName - optional project name - used to name/group tests
     * @param {string}  options.cbtProjectVersion - optional project version - used to name/group tests
     * @param {string}  options.cbtTestId - optional test id - used to name/group tests
     * @param {string}  options.cbtScreenResolution - optional default screen resolution for all browsers (defaults to '1024x768')
     * @param {string}  options.cbtRecordVideo - optional boolean string to flag whether or not to record videos of test runs - defaults to 'false'
     * @param {string}  options.cbtRecordNetwork - optional boolean string to flag whether or not to record network during test runs - defaults to 'false'
     * @param {string}  options.cbtRecordSnapshot - optional boolean string to flag whether or not to record snapshots during test runs - defaults to 'false'
     * @return {object} options - mutated optiosn that include custom launchers and all necessary configuration to run tests via CBT
     */
    updateKarmaConfig: function updateKarmaConfig(options){
        /* overwrite hostname to 'local' for karma to point at the right place */
        options.hostname = 'local';
        /* generate a test id if necessary */
        if(!options.cbtTestId){
            options.cbtTestId = Math.ceil(Math.random()*10000);
        }
        /* try to generate project name and version if not provided */
        if(!options.cbtProjectName){
            try{
                options.cbtProjectName = require(process.cwd()+'/package.json').name;
            }catch(ignore){

            }
        }
        if(!options.cbtProjectVersion){
            try{
                options.cbtProjectVersion = require(process.cwd()+'/package.json').version;
            }catch(ignore){

            }
        }
        /* add custom launchers */
        if(options.customLaunchers === undefined || options.customLaunchers === null){
            options.customLaunchers = {};
        }
        us.keys(PopularBrowsers).forEach(function(launcherName){
            options.customLaunchers[launcherName] = {
                base: 'WebdriverIO',
                config: {
                    host: options.cbtHubURL || 'hub.crossbrowsertesting.com',
                    port: options.cbtHubPort || 80,
                    logLevel: options.cbtLogLevel || 'silent', /* verbose | silent | command | data | result */
                    desiredCapabilities: {
                        name : options.cbtProjectName + ' Karma Tests',
                        build :  options.cbtProjectVersion + ' - [' + options.cbtTestId + ']',
                        screen_resolution : options.cbtScreenResolution || '1024x768',
                        record_video : options.cbtRecordVideo || "false",
                        record_network : options.cbtRecordNetwork || "false",
                        record_snapshot :  options.cbtRecordSnapshot || "false",
                        username : options.cbtUserName,
                        password : options.cbtApiKey
                    }
                }
            };
            /* extend basic launcher with browser-specific config */
            us.extend(options.customLaunchers[launcherName].config.desiredCapabilities,
                PopularBrowsers[launcherName]);
        });
        return options;
    },
    /**
     * Start a Karma server and return a promise that both resolves and rejects to exit code
     * exit codes of <code>0</code> will always resolve; all other exit codes will reject.
     * @return {object} promise that resolves to karma server exit code
     */
    karmaPromise: function karmaPromise(options){
        return new q.Promise(function(resolve,reject){
            new karma.Server(options,function(exitCode){
                if(exitCode!==0){
                    reject(exitCode);
                }else{
                    resolve(exitCode);
                }
            }).start();
        });
    },
    /**
     * Start a Karma server and return a promise that both resolves and rejects to exit code.
     * If options object contains a "cbt" option, a CBT tunnel will be started.
     * @param {object}  options - standard karma server options plus some CBT specific keys
     * @param {string}  options.cbtUsername - mandatory CBT username
     * @param {string}  options.cbtApiKey - mandatory CBT API key
     * @param {boolean} options.cbt - flag to specify whether or not to run karma via CBT
     * @param {string)  options.cbtHubURL - optional CBT selenium hub host name (defaults to 'hub.crossbrowsertesting.com')
     * @param {number}  options.cbtHubPort - optional CBT selenium hub port (defaults to 80)
     * @param {string}  options.cbtLogLevel - optional selenium log level, one of 'verbose', 'silent', 'command', 'data', or 'result' (defaulst to 'silent')
     * @param {string}  options.cbtProjectName - optional project name - used to name/group tests
     * @param {string}  options.cbtProjectVersion - optional project version - used to name/group tests
     * @param {string}  options.cbtTestId - optional test id - used to name/group tests
     * @param {string}  options.cbtScreenResolution - optional default screen resolution for all browsers (defaults to '1024x768')
     * @param {string}  options.cbtRecordVideo - optional boolean string to flag whether or not to record videos of test runs - defaults to 'false'
     * @param {string}  options.cbtRecordNetwork - optional boolean string to flag whether or not to record network during test runs - defaults to 'false'
     * @param {string}  options.cbtRecordSnapshot - optional boolean string to flag whether or not to record snapshots during test runs - defaults to 'false'
     * @return {object} promise that resolves to karma server exit code
     */
    runKarma: function runKarma(options){
        if(options.cbt){
            if(!options.cbtUserName || !options.cbtApiKey){
               throw new Error('cbtUserName and cbtApiKey need to be set');
            }
            return new Tunnel({apiKey: options.cbtApiKey}).runTunnel().then(function(tunnelProc){
                return KarmaUtil.karmaPromise(KarmaUtil.updateKarmaConfig(options)).then(function(exitCode){
                    tunnelProc.kill();
                }).catch(function(exitCode){
                    tunnelProc.kill();
                });
            });
        }else{
            return KarmaUtil.karmaPromise(options);
        }
    }
};
module.exports = {
    Tunnel: Tunnel,
    PopularBrowsers: PopularBrowsers,
    KarmaUtil: KarmaUtil
};