/**
 * q-promise -- very fast promises engine
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-04-06 - AR.
 */

'use strict';

module.exports = P;


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

P.prototype.state = null;
P.prototype.value = null;
P.prototype.yes = null;
P.prototype.no = null;
P.prototype._chain = null;


P.resolve = function resolve( v ) {
    var p = new P();
    return p._resolve(v);
}

P.reject = function reject( e ) {
    var p = new P();
    return p._reject(e);
}

P.all = function race( promises ) {
    // WRITEME
}

P.all = function all( promises ) {
    // WRITEME
}

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
            _callThenMethod(this, then, v, function(v) { self._resolve(v) }, function(e) { self._reject(e) });
            return this;
        }
    default:
        this.state = 'y';
        //this.value = v;
        _notify(this, this.yes, v);
        return this;
    }
}

P.prototype._reject = function _reject( e ) {
    if (!this.state) {
        this.state = 'n';
        //this.value = e;
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
    if (typeof resolve === 'function') {
        v = _tryFunc(p, resolve, v);
        var then = _getThenMethod(v);
        if (then) {
            if (v === p) p._reject(new TypeError("cannot resolve from self"));
            else _callThenMethod(p, then, v, function(v) { p._resolve(v) }, function(e) { p._reject(e) });
        }
        else p._resolve(v);
    }
    else p._resolve(v);
}

// note: a promise returned from onReject can still resolve p
function _thenReject( p, v, reject ) {
    if (typeof reject === 'function') {
        v = _tryFunc(p, reject, v);
        var then = _getThenMethod(v);
        if (then) {
            if (v === p) p._reject(new TypeError("cannot reject from self"));
            else _callThenMethod(p, then, v, function(v) { p._resolve(v) }, function(e) { p._reject(e) });
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

function _tryThen( p, v, a, b ) {
    try { v.then(a, b) }
    catch (e) { p._reject(e) }
}

// call x.then, reject the promise if it throws
function _callThenMethod( p, then, x, a, b ) {
    try { then.call(x, a, b) }
    catch (err) { p._reject(err) }
}

// send the update / reject notifications to the listeners
// but self by this point has a settled value that wont change!
function _notify( self, funcs, v ) {
    self.value = v;

    // all listeners have been settled, clean up
    self.yes = null;
    self.no = null;

    if (funcs) {
        _notifyFuncsNoStack(self, funcs, v);
    }
}

// call onFulfill / onReject from outside the app stack,
// and with a null `this`.  If any func throws, reject p.
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

// handle one, two, many items on a list
// call as `list = _addListeners(list, item)
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

// spec: Promises/A+ spec wants to avoid repeatedly accessing getters,
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
}
// touching p.then can throw if is a getter
function _getThenMethod( p ) {
    try { return _getThenable(p) } catch (e) { return false }
}
function _getThenable( p ) {
    var then;
    return p && typeof (then = p.then) === 'function' ? then : false;
}


// accelerate access
P.prototype = P.prototype;
