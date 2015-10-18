var q = require('q'),
    fs = require('fs'),
    path = require('path'),
    http = require('http'),
    spawn = require('child_process').spawn,
    gutil = require('gulp-util'),
    us = require('underscore');
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
            http.get(url, function(response) {
                response.pipe(fileStream);
                fileStream.on('finish',function(){
                    fileStream.close();
                    resolve(path);
                });
            }).on('error',function(err){
                fs.unlinkSync(path);
                reject(err);
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
        tunnelBinURL: 'http://crossbrowsertesting.com/cbttunnel.jar',
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
        return new q.Promise(function(resolve,reject){
            Util.log('Spawning cbttunnel process...');
            var cbtProc = spawn('java', ['-jar',tunnelBinPath,'-authkey',apiKey], { stdio: 'pipe' });
            /* register killer on process exit */
            process.on('exit', function(){
                cbtProc.kill();
            });
            resolve(cbtProc);
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
                    reject('Timed out waiting for tunnel to connect after '+connectTimeout+'ms');
                }
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
    /* ie11 win 8.1 */
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
 * A CBT configuration generator for karma options
 * @param {object} config -  configuration parameters that include userName, apiKey, testId, projectName, and projectVersion
 * @constructor
 */
var KarmaConfigGenerator = function KarmaConfigGenerator(config){
    this.config = us.extend({
        cbtHubURL: 'hub.crossbrowsertesting.com',
        cbtHubPort: 80,
        screenResolution: '1024x768',
        recordVideo: false,
        recordNetwork: false,
        recordSnapshot: false,
        projectName: '',
        projectVersion: '1.0.0',
        testId: Math.floor(Math.random() * 10000)
    },config);
    this.baseCustomLauncher = {
        base: 'WebdriverIO',
        config: {
            host: this.config.cbtHubURL,
            port: this.config.cbtHubPort,
            logLevel: 'result', /* verbose | silent | command | data | result */
            desiredCapabilities: {
                name : this.config.projectName + ' Karma Tests',
                build :  this.config.projectVersion + ' - [' + this.config.testId + ']',
                screen_resolution : '1024x768',
                record_video : "false",
                record_network : "false",
                record_snapshot :  "false",
                username : this.config.userName,
                password : this.config.apiKey
            }
        }
    };
};
KarmaConfigGenerator.prototype = {
    /**
     * Make a Karma Custom Launcher configuration given a capabilities object
     * @params {object} caps - cbt-compatible selenium capabilities array
     */
    getCustomLauncher: function(caps){
        /* ugh; ugly deep clone hack */
        var ret = JSON.parse(JSON.stringify(this.baseCustomLauncher));
        us.extend(ret.config.desiredCapabilities, caps);
        return ret;
    },
    /**
     * Update Karma options with CBT launchers
     */
    updateKarmaConfig: function(karmaOptions){
        /* hard code hostname to 'local' for karma tests to work */
        karmaOptions.hostname = 'local';
        karmaOptions.customLaunchers = {};
        us.keys(PopularBrowsers).forEach(function(launcherName){
            karmaOptions.customLaunchers[launcherName] = this.getCustomLauncher(PopularBrowsers[launcherName]);
        }.bind(this));
    }
};
module.exports = {
    Tunnel: Tunnel,
    PopularBrowsers: PopularBrowsers,
    KarmaConfigGenerator: KarmaConfigGenerator
};