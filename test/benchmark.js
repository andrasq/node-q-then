/**
 * q-promise -- very fast promises engine
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-04-06 - AR.
 */

'use strict';


// /* quicktest:

var P = require('../').Promise;
var qtimeit = require('qtimeit');
var Bluebird = require('bluebird').Promise;
var promis = require('promise');
var RSVP = require('rsvp').Promise
var es6 = require('es6-promise').Promise;
var when = require('when').Promise;

var x;

function noop(a,b){ }

// qtimeit(10000000, function(){ x = new P() });
// 138m/s
// 130m/s if no resolver handling, 45m/s if testing resolver, 53m/s if resolver=false
// 130m/s if resolver=false and running testing in another func
// 138m/s if resolver not passed and running testing in another func

//qtimeit(1000000, function(){ x = new P().then(1) })
// 59m/s
//qtimeit(1000000, function(){ x = new P(noop).then(1) })
// 25m/s minimal; 18m/s testing for thenable
// 31m/s

if (0) {
qtimeit(10000000, function(){ x = new P(noop) });
// 40m/s
qtimeit(1000000, function(){ x = P.resolve(1) });
// 76m/s
qtimeit(1000000, function(){ x = P.resolve({}) });
// 42m/s
qtimeit(1000000, function(){ x = P.resolve(123).then() });
// 63m/s
qtimeit(1000000, function(){ x = P
    .resolve('foo')
    .then(function(str){ return str + 'bar' })
    .then(function(str){ return str + 'zed' }); });
// 1.4m/s
qtimeit(1000000, function(){ x = P
    .resolve('foo')
    .then(function(str){ return P.resolve(str + 'bar') })
    .then(function(str){ return P.resolve(str + 'baz') }) });
// 2m/s
}

if (0) {
qtimeit(1000000, function(){ x = new Bluebird(noop) });
// 28m/s :-/
qtimeit(1000000, function(){ x = Bluebird.resolve(1) });
// 36m/s
qtimeit(1000000, function(){ x = Bluebird.resolve({}) });
// 21m/s
qtimeit(1000000, function(){ x = Bluebird.resolve(1).then() });
// 1.6m/s
qtimeit(10000, function(){ x = Bluebird
    .resolve('foo')
    .then(function(str){ return str + 'bar' })
    .then(function(str){ return str + 'zed' }); });
// 721k/s, 1.1m/s v8.x, 2.2m/s v8.x 10k
// oom v5.10, 1.7m/s 10k
qtimeit(10000, function(){ x = Bluebird
    .resolve('foo')
    .then(function(str){ return P.resolve(str + 'bar') })
    .then(function(str){ return P.resolve(str + 'baz') }); });
// 950k/s v8.x 10k, 1.1m/s v8.x 1m
// NOTE: 321.4 mb heapUsed!!; 4.57 elapsed
}

if (0) {
var PP = promis
qtimeit(1000000, function(){ x = new PP(noop) });
// 21m/s
qtimeit(1000000, function(){ x = PP.resolve(1) });
// 24m/s
qtimeit(1000000, function(){ x = PP.resolve({}) });
// 19m/s
qtimeit(1000000, function(){ x = PP.resolve(1).then() });
// 1.6m/s
qtimeit(10000, function(){ x = PP
    .resolve('foo')
    .then(function(str){ return str + 'bar' })
    .then(function(str){ return str + 'zed' }); });
// 4.5m 10k
qtimeit(10000, function(){ x = PP
    .resolve('foo')
    .then(function(str){ return P.resolve(str + 'bar') })
    .then(function(str){ return P.resolve(str + 'baz') }); });
// 900k/s 10k, OOM 1m
}

if (0 && process.version > 'v4.') {
qtimeit(1000000, function(){ x = new Promise(noop) });
// 5m/s
qtimeit(1000000, function(){ x = Promise.resolve(1) });
// 5.0m/s
qtimeit(1000000, function(){ x = Promise.resolve({}) });
// 4.9m/s
qtimeit(1000000, function(){ x = Promise.resolve(1).then() });
// 530k/s
qtimeit(10000, function(){ x = Promise
    .resolve('foo')
    .then(function(str){ return str + 'bar' })
    .then(function(str){ return str + 'zed' }); });
// XXX ran out of memory w/ 1m
// 277k/s 10k, 7.4m/s v8.x 10k, 1.8m/s v8.x 1m
// oom v5.10, 112k/s 10k
qtimeit(10000, function(){ x = Promise
    .resolve('foo')
    .then(function(str){ return P.resolve(str + 'bar') })
    .then(function(str){ return P.resolve(str + 'baz') }); });
// 1.5m/s v8.x 10k, 1.8m/s v8.x 1m (but node did not exit ?!)
// NOTE: 91 mb heapUsed; 2.70 elapsed
}


var nloops = 2000;
var ncalls = 0;
qtimeit.bench.opsPerTest = nloops;
qtimeit.bench.timeGoal = 2;
qtimeit.bench.visualize = true;
qtimeit.bench.baselineAvg = 1000000;

function waitForEnd( wantCount, cb ) {
    process.nextTick(function testEnd() {
        if (ncalls >= wantCount) cb();
        // 100% busy wait for promises to be resolved
        else setImmediate(testEnd);
    })
}

// a promise that asynchronously resolves to x
function _async(x) {
    return new P(function(y, n) { setImmediate(y, x) });
}

function testLoop( PP, cb ) {
    var callsAtStart = ncalls;
    for (var i=0; i<nloops; i++) {
        x = PP.resolve('foo').then(function(s){ return PP.resolve(s + 'bar') }).then(function(s) { ncalls++; return PP.resolve(s + 'baz')})
        //x = PP.resolve('foo').then(function(s){ return PP.resolve(s + 'bar') }).then(function(s) { ncalls++; return PP.resolve(s + 'baz')})
        //x = PP.resolve('foo').then(function(s){ return _async(s + 'bar') }).then(function(s) { ncalls++; return _async(s + 'baz')})
        //x = PP.resolve('foo').then(function(s){ return _async(s + 'bar') }).then(function(s) { return _async(s + 'baz')}).then(function(s){ ncalls++; return _async(s + 'bat')})
        //x = PP.resolve('foo').then(function(s){ ncalls++; return 1234 });
    }
    if (cb) waitForEnd(callsAtStart + nloops, cb);
}
function mikeTest( PP, cb ) {
    var callsAtStart = ncalls;
    function make() {
        return new PP(function(resolve, reject) { setImmediate(function(){ resolve('foo') }) });
        //return new PP(function(resolve, reject) { process.nextTick(function(){ resolve('foo') }) });
        //return new PP(function(resolve, reject) { setImmediate(resolve, 'foo') });
        //return new PP(function(resolve, reject) { ncalls++; resolve('foo') });
        //return new PP(function(resolve, reject) { resolve('foo') });
        //return new PP(function(resolve, reject) { setTimeout(function(){ resolve('foo') }, 1) });
    }
    for (var i=0; i<nloops; i++) {
// NOTE: node and bluebird are 2x faster if ncalls is incremented next to x=v. (4m/s) (v8; v6.7 2k)
// NOTE: bluebird is 50% faster if ncalls is incremented next to resolve('foo') (v6.7 2k, bluebird only 20k)
        //make().then(function(v){ return x = v; })
        make().then(function(v){ ncalls++; return x = v; })
    }
    if (cb) waitForEnd(callsAtStart + nloops, cb);
}
testLoop = mikeTest;

qtimeit.bench({
    'node': function(cb) { typeof Promise != 'undefined' ? testLoop(Promise, cb) : cb() },
    'Bluebird': function(cb) { testLoop(Bluebird, cb) },
    'rsvp': function(cb) { testLoop(RSVP, cb) },
    'es6-promise': function(cb) { testLoop(es6, cb) },
    'when': function(cb) { testLoop(when, cb) },
    'promise': function(cb) { testLoop(promis, cb) },
    'q-promise': function(cb) { testLoop(P, cb) },
},
function(){
    //x = P.resolve(3);
    setTimeout(function(){ 
        // q-promise resolves on the next event loop tick, wait for it
        console.log("AR: %d calls total, got", ncalls, x);
    }, 1);
    console.log(process.memoryUsage());

})

