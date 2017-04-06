'use strict';

/**
    q - full-featured
    rsvj.js - full-featured
    bluebird - full
    Promise - ?

    when.js - limited
    jQuery - callback aggregator
**/


if (process.version >= 'v4.') {
    // need a nextTick that queues arguments too
    var nextTick = process.nextTick;
}
else {
    // if unsure, roll our own
    var nextTick = function(fn, a, b, c) {
        setImmediate(function(){
            fn(a, b, c);
        })
    }
}

// spec: executor is run immediately
// spec: return value form executor is ignored
// spec: errors thrown in executor cause the promise to reject
function _tryExecutor( self, resolver ) {
    try {
        resolver(function(v) { self._resolve(v) }, function(e) { self._reject(e) })
    }
    catch (e) {
        self._reject(e)
    }
}

function P( resolver ) {
    this.state = '';            // '' pending, 'y' fulfilled, 'n' rejected
    this.value = undefined;     // fulfilled-width or rejected-with value
    this.yes = null;            // resolve() listeners
    this.no = null;             // reject() listeners

    if (resolver) _tryExecutor(this, resolver);
}

P.resolve = function resolve( v ) {
    var p = new P();
    return p._resolve(v);
}
P.reject = function reject( e ) {
    var p = new P();
    return p._reject(e);
}
P.all = function all( promises ) {
    // WRITEME
}
P.prototype.state = null;
P.prototype.value = null;
P.prototype.yes = null;
P.prototype.no = null;
P.prototype._chain = null;

P.prototype._resolve = function _resolve( v ) {
    if (this.state) return;

    switch (typeof v) {
    case 'function':
        // resolve with value from func; fall through to handle
        v = v();
    case 'object':
        // handle as thenable or fall through
        var then = _getThenMethod(v);
        if (then) {
            var self = this;
            _tryThen(p, then, v, function(v) { self._resolve(v) }, function(e) { self._reject(e) });
            return this;
        }
    default:
        this.state = 'y';
        this.value = v;
        _notify(this, this.yes, v);
        return this;
    }
}

P.prototype._reject = function _reject( e ) {
    if (!this.state) {
        this.state = 'n';
        this.value = v;
        _notify(this, this.no, e);
    }
    return this;
}

// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
P.prototype.catch = function _catch( handler ) {
    return this.then(undefined, handler);
}

// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
P.prototype.then = function then( resolve, reject ) {
    var p = new P();

    if (this.state) {
        (this.state === 'y') ? _thenResolve(p, this.value, resolve) : _thenReject(p, this.value, reject);
    }
    else {
        var self = this;
        this.yes = _addListener(this.yes, function(){ _thenResolve(p, self.value, resolve) });
        this.no = _addListener(this.no, function(){ _thenReject(p, self.value, reject) });
    }
    return p;
}

// fulfill the resolve function of a then
function _thenResolve( p, v, resolve ) {
    if (resolve) {
        v = _tryFunc(p, resolve, v);
        var then = _getThenMethod(v);
        if (then) {
            if (v === p) p._reject(new TypeError("cannot resolve from self"));
            else _tryThen(p, then, v, function(v) { p._resolve(v) }, function(e) { p._reject(e) });
        }
        else p._resolve(v);
    }
    else p._resolve(v);
}

// note: a promise returned from onReject can still resolve p
function _thenReject( p, v, reject ) {
    if (reject) {
        v = _tryFunc(p, reject, v);
        var then = _getThenMethod(v);
        if (then) {
            if (v === p) p._reject(new TypeError("cannot reject from self"));
            else _tryThen(p, then, v, function(v) { p._resolve(v) }, function(e) { p._reject(e) });
        }
        else p._reject(v);
    }
    else p._reject(v);
}

// run the function and return the result, reject the promise p if fn throws
function _tryFunc( p, fn, v ) {
    try { return fn(v) }
    catch (e) { p._reject(e) }
}

function _tryThen( p, then, x, a, b ) {
    try { then.call(x, a, b) }
    catch (err) { p._reject(e) }
}

// send the update / reject notifications to the listeners
// but self by this point has a settled value that wont change!
function _notify( self, funcs, v ) {
    // all listeners have been settled, clean up
    self.yes = null;
    self.no = null;

    if (funcs) {
        _notifyFuncsNoStack(self, funcs, v);
    }
}

// call onFulfill / onReject from outside the app stack,
// and with a null `this`.  If any of them throw, reject p.
function _notifyFuncs( p, funcs, v ) {
    if (typeof funcs === 'function') {
        _tryFunc(p, funcs, v);
    }
    else for (var i=0; i<funcs.length && !p.state; i++) {
        _tryFunc(p, funcs[i], v);
    }
}
function _notifyFuncsNoStack( p, funcs, v ) {
    nextTick(_notifyFuncs, p, funcs, v);
}

// handle one, two, many fulfillment listeners
function _addListener( list, func ) {
    if (!list) return func;
    // node-v8 is slow to new Array() and slower to new Array().push
    if (list.constructor !== Array) return [list, func];
    list.push(func);
    return list;
}

function _isPPromise( p ) {
    return p.constructor === P;
}

function _isPromise( v ) {
    return v && typeof v.then === 'function' && typeof v.catch === 'function';
}

// spec: A+/Promise spec wants to avoid repeatedly accessing getters,
// which requires new closure around then!  Which is a pointless pain.
// Note that if `then` is a getter, its not bound to the object...
// Avoiding double-access to `then` slows the code 12.5% overall.
// Or: nonsense:  if `then` is a method, assume it will always resolve
// to the same method.  The alternative is nonsense.
// spec: p.then can throw?!
// note: wrapping it in try/catch slows it 15% (8.2 -> 7.1 m/s)
// note: inlining the try/catch slows it 80% (8.2 -> 4.5 m/s)
function _tryIsThenable( p ) {
    try { return _isThenable(p) } catch (e) { return false }
}
function _isThenable( p ) {
    var then;
    return p && typeof (then = p.then) === 'function' ? then : false;

    // return p && typeof p.then === 'function';

/**
    try {
        return typeof p.then === 'function';
    } catch (e) {
        return false;
    }
/**/

// 12.5% slower to not access `then` more than once...
//    var then = p && p.then;
//    return typeof then === 'function' ? function(a,b){ then.call(p, a, b) } : false;
}
function _getThenMethod( p ) {
    return _tryIsThenable(p);

    try {
        var then = p.then;
        return typeof then === 'function' ? then : false;
    }
    catch (e) { return false }
}

P.prototype = P.prototype;




// /* quicktest:

var qtimeit = require('./timeit');
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

qtimeit(1000000, function(){ x = new P()._resolve(1) })
// 59m/s
qtimeit(1000000, function(){ x = new P(noop)._resolve(1) })
// 25m/s minimal; 18m/s testing for thenable
// 31m/s

if (1) {
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

var nloops = 10000;
function testLoop( PP, cb ) {
    for (var i=0; i<nloops; i++) {
        PP.resolve('foo').then(function(s){ return PP.resolve(s + 'bar') }).then(function(s) { return PP.resolve(s + 'baz')})
    }
    setImmediate(cb)
}

// function make(){ return new Promise(function(res, rej) { res('foo') }) }
// make().then(function(v){ return v; })

function mikeTest( PP, cb ) {
    function make() {
        return new PP(function(resolve, reject) {
            resolve('foo')
        })
    }
    for (var i=0; i<nloops; i++) {
        make().then(function(v){
            return x = v;
        })
    }
    if (cb) setImmediate(cb)
}
testLoop = mikeTest;

///**
qtimeit.bench.opsPerTest = nloops;
qtimeit.bench.timeGoal = 1;
//qtimeit.bench.visualize = true;
qtimeit.bench({
    'node': function(cb) { typeof Promise != 'undefined' ? testLoop(Promise, cb) : cb() },

    //'promise': function(cb) { testLoop(promis, cb) },

    // rsvp cant run 100k without crashing out-of-memory
    //'rsvp': function(cb) { testLoop(RSVP, cb) },

    // Bluebird chews up memory, and is 2x faster if preceded by 'promise'
    'Bluebird': function(cb) { testLoop(Bluebird, cb) },

    // q-then is 2.5 - 10 m/s (20k nloops 2.5, 10k and 50k 10m/s)
    'q-then': function(cb) { testLoop(P, cb) },
},
function(){

    //x = P.resolve(3);
    console.log(x);
    console.log(process.memoryUsage());

})
/**/
