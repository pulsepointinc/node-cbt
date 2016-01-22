var assert = require('chai').assert,
    Tunnel = require('./index.js').Tunnel,
    KarmaUtil = require('./index.js').KarmaUtil,
    http = require('http'),
    fs = require('fs'),
    portfinder = require('portfinder'),
    del = require('del'),
    gutil = require('gulp-util');

describe('Tunnel tests', function(){
    it('runs a tunnel', function(done){
        this.timeout(1000 * 60 * 5);
        new Tunnel({
            apiKey: '1234',
            tunnelBinURL: 'http://' + server.address().address + ':' + server.address().port + '/mocktunnel.jar'
        }).runTunnel().then(function(tunnelProc){
            assert.isFalse(tunnelProc.killed);
            tunnelProc.kill();
            done();
        });
    });
    var server;
    before(function(done){
        /* kill logging */
        gutil.log = function(){};
        del(['./bin']).then(function(){
            portfinder.getPort(function(err,port){
                server = http.createServer(function(req,res){
                    fs.createReadStream('./mocktunnel.jar').pipe(res);
                }.bind(this));
                server.listen(port,'127.0.0.1',undefined, done);
            });
        });
    });
    after(function(){
        if(server !== undefined && server !== null){
            server.close();
        }
    });
});

describe('KarmaUtil tests', function(){
    it('updates karma config', function(){
        var karmaOptions = KarmaUtil.updateKarmaConfig({
            cbt: true,
            cbtUserName: 'exchangeteam@pulsepoint.com',
            cbtApiKey: '...'
        });
        /* verify hostname is overwritten */
        assert.equal(karmaOptions.hostname, 'local');
        /* verify customLaunchers added */
        assert.isObject(karmaOptions.customLaunchers);
    });
});