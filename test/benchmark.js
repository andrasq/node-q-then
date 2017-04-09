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

var P = require('../');
var qtimeit = require('qtimeit');
var Bluebird = require('bluebird').Promise;
var promis = require('promise');
var RSVP = require('rsvp').Promise


var x;

function noop(a,b){ }
// qtimeit(10000000, function(){ x = new P() });
// 138m/s
// 130m/s if no resolver handling, 45m/s if testing resolver, 53m/s if resolver=false
// 130m/s if resolver=false and running testing in another func
// 138m/s if resolver not passed and running testing in another func
qtimeit(10000000, function(){ x = new P(noop) });
// 40m/s
// 37m/s to invoke resolver with on-the-fly constructed bindigs w/o assigning them
// 28m/s inside try/catch, 21m/s if wrapped in an additional function
// 36m/s if resolver is run in a separate func

qtimeit(1000000, function(){ x = new P().then(1) })
// 59m/s
qtimeit(1000000, function(){ x = new P(noop).then(1) })
// 25m/s minimal; 18m/s testing for thenable
// 31m/s

if (0) {
qtimeit(10000000, function(){ x = new P(noop) });
// 40m/s
qtimeit(1000000, function(){ x = P.resolve(1) });
// 64m/s (81m/s minimal, 57m/s 3-way test)
qtimeit(1000000, function(){ x = P.resolve({}) });
// 31m/s
qtimeit(1000000, function(){ x = P.resolve(123).then() });
// 11m/s
qtimeit(1000000, function(){ x = P
    .resolve('foo')
    .then(function(str){ return str + 'bar' })
    .then(function(str){ return str + 'zed' }); });
// 8m/s; 5.5m/s v8.x
// 8m/s v5.10, 6.3m/s 10k
qtimeit(1000000, function(){ x = P
    .resolve('foo')
    .then(function(str){ return P.resolve(str + 'bar') })
    .then(function(str){ return P.resolve(str + 'baz') }) });
// 3.8m/s; 2.9m/s v8.x, 2.35m/s v8.x 10k
// 2.35m/s v8.x 10k, 2.9m/s v8.x 1m
// NOTE: 7 mb heapUsed; 1.43 elapsed
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

function testLoop( PP, cb ) {
    for (var i=0; i<nloops; i++) {
        x = PP.resolve('foo').then(function(s){ ncalls++; return PP.resolve(s + 'bar') }).then(function(s) { return PP.resolve(s + 'baz')})
        //x = PP.resolve('foo').then(function(s){ return 1234 });
    }
    setImmediate(cb)
    //process.nextTick(cb)
    //cb()
}
function mikeTest( PP, cb ) {
    function make() {
        return new PP(function(resolve, reject) { ncalls++; resolve('foo') });
        //return new PP(function(resolve, reject) { setTimeout(function(){ ncalls++; resolve('foo') }, 1) });
    }
    for (var i=0; i<nloops; i++) {
        make().then(function(v){ return x = v; })
    }
    if (cb) setImmediate(cb)
}
testLoop = mikeTest;

qtimeit.bench({

    'node': function(cb) { typeof Promise != 'undefined' ? testLoop(Promise, cb) : cb() },

    'promise': function(cb) { testLoop(promis, cb) },

    'rsvp': function(cb) { testLoop(RSVP, cb) },

    'Bluebird': function(cb) { testLoop(Bluebird, cb) },

    'q-promise': function(cb) { testLoop(P, cb) },
},
function(){
    //x = P.resolve(3);
    setTimeout(function(){ 
        // q-promise resolves on the next event loop, wait for it
        console.log("AR: %d calls total, got", ncalls, x);
    }, 1);
    console.log(process.memoryUsage());

})

