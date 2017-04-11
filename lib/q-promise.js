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


var _onResolveCb = false;

// spec: executor is run immediately
// spec: return value form executor is ignored
// spec: errors thrown in executor cause the promise to reject
function _tryExecutor( p1, resolver ) {
    try {
        resolver(function(v) { __resolve(v, p1, 'y') }, function(e) { __resolve(e, p1, 'n') })
    }
    catch (e) {
        __resolve(e, p1, 'n');
    }
}

function P( resolver ) {
    this.state = '';            // '' pending, 'y' fulfilled, 'n' rejected
    this.value = undefined;     // fulfilled value or rejected reason
    this.yes = null;            // resolve() listeners
    this.no = null;             // reject() listeners
    this.p2s = null;            // other listening P promises pending on this

    if (resolver) _tryExecutor(this, resolver);
}

P.prototype.state = null;
P.prototype.value = null;
P.prototype.yes = null;
P.prototype.no = null;
P.prototype.p2s = null;


P.resolve = function resolve( v ) {
    var p = new P();
    if (typeof v === 'function') {
        return __resolve(__getFunctionValue(v, p), p, 'y');
    }
    return __resolve(v, p, 'y');
}

P.reject = function reject( e ) {
    var p = new P();
    if (typeof e === 'function') {
        return __resolve(__getFunctionValue(e, p), p, 'n');
    }
    return __resolve(e, p, 'n');
}

P.all = function race( promises ) {
    // WRITEME
}

P.all = function all( promises ) {
    // WRITEME
}

// hooks for testing
P.onResolve = function( onResolve ) {
    _onResolveCb = onResolve;
}
P.prototype.__resolve = __resolve;
P.prototype._resolve = function _resolve( v ) {
    __resolve(v, this, 'y');
}
P.prototype._reject = function _reject( e ) {
    __resolve(e, this, 'n');
}

// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/catch
P.prototype.catch = function _catch( handler ) {
    return this.then(undefined, handler);
}

// ref: https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise/then
// then returns a new promise whose then method can access its eventual value
// the returned promise can be fulfilled / rejected by the resolve / reject functions !!
// any promise or value returned by resolve / reject must be used to settle p2
//
// if `this` is already settled, p2 takes on its value.
// Note that the notifier function ultimately determines the p2 value.)
// If `this` is still pending, have p2 listen for its eventual value.
// consistently much faster inside nextTick() than inline (heap effects)?
// Note: a thenable can return another promise, which will eventually fulfill p2.
P.prototype.then = function then( resolve, reject ) {
    var p2 = new P();

    switch (this.state) {
    case 'y':
        if (typeof resolve === 'function') onNextTick(__resolveThenYes, resolve, this.value, p2);
        else { p2.state = this.state; p2.value = this.value }
        break;
    case 'n':
        if (typeof reject === 'function') onNextTick(__resolveThenNo, reject, this.value, p2);
        else { p2.state = this.state; p2.value = this.value }
        break;
    case '':
        __addListeners(this, p2, resolve, reject);
        break;
    }

    return p2;
}

// fulfill / reject promise p1 with the value v
// if v is a thenable, make p1 take on the current or eventual value of v
// else p1 takes on the value v.  Notify all listeners that p1 settled.
// Resolving with a thenable (a promise) just establishes linkage.
// Settling with a value propagates the value to the linked promises.
function __resolveYes( v, p1 ) {
    return __resolve(v, p1, 'y');
}
function __resolveNo( v, p1 ) {
    return __resolve(v, p1, 'n');
}
function __resolve( v, p1, state ) {
    if (_onResolveCb) _onResolveCb(v, p1, state);
    if (p1.state) return p1;

    if (v && typeof v === 'object') {
        var then = _getThenMethod(v, p1);
        if (then) return __resolveThenable(v, p1, state, then);
        else if (p1.state) return;
    }

    if (p1.p2s) {
        __settle(v, p1, state);
    }
    else {
        p1.state = state;
        p1.value = v;
    }
    return p1;
}
// p2 was created as p2 = vt.then(res, rej), link its state to vt
function __resolveThenable( vt, p2, state, then ) {
    if (vt === p2) {
        __settleNo(new TypeError("cannot resolve promise with itself"), p2);
    }
    else if (vt.constructor === P) {
        if (!vt.state) {
            __addListeners(vt, p2, __settleYes, __settleNo);
        } else {
            __settle(vt.value, p2, vt.state);
        }
    }
    else {
        // use callbacks bound to p2 to wait for or copy value of generic thenable
        _callThenMethod(p2, then, vt, function(v){ __resolveYes(v, p2) }, function(e){ __resolveNo(e, p2) });
    }
    return p2;
}
// call thenable.then, reject the promise if it throws
function _callThenMethod( p, thenMethod, thenable, a, b ) {
    try { thenMethod.call(thenable, a, b) }
    catch (err) { __settleNo(err, p) }
}

// settle the promise with the given v, the fulfill value / reject cause
function __settle( v, p, state ) {
    switch (state) {
    case 'y': __settleYes(v, p); break;
    case 'n': __settleNo(v, p); break;
    }
}
function __settleYes( v, p ) {
    if (p.state) return;
    p.state = 'y';
    p.value = v;
    if (p.p2s) {
        __notifyListenersYes(v, p, p.yes);
        p.yes = p.no = p.p2s = null;
    }
}
function __settleNo( v, p ) {
    if (p.state) return;
    p.state = 'n';
    p.value = v;
    if (p.p2s) {
        __notifyListenersNo(v, p, p.no);
        p.yes = p.no = p.p2s = null;
    }
}

/*
 * add the then callbacks for promise p2 as listeners on p1
 * The lists handle one, two, many items, but are single-item optimized:
 * if p1.p2s is not an array, the list is omitted, just the item is stored.
 * invariant: p1.p2s is either a function, an array, or falsy.
 * invariant: if p1.p2s then p1.yes and p1.no are either a function, an array, or falsy.
 */
function __addListeners( p1, p2, resolve, reject ) {
    if (!p1.p2s) {
        p1.p2s = p2;
        p1.yes = typeof resolve === 'function' ? resolve : false;
        p1.no = typeof reject === 'function' ? reject : false;
    }
    else if (p1.p2s.constructor !== Array) {
        p1.p2s = [p1.p2s, p2];
        p1.yes = [p1.yes, resolve];
        p1.no = [p1.no, reject];
    }
    else {
        p1.p2s.push(p2);
        p1.yes.push(resolve);
        p1.no.push(reject);
    }
}

/*
 * Settle all p2 waiting on p with the value returned from their resolveHandler(v)
 * (or v itself if resolveHandler does not return a value).
 * The promise p2, or the array of multipel p2s, is passed in p.p2s.
 * note: __settleYes is sync, resolve() runs on nextTick, ie might re-order promises
 * invariant: p.p2s is a P or an array of P
 * invariant: handlers is one of {function, falsy, array of any}
 */
function __notifyListenersYes( v, p, handlers ) {
    if (typeof handlers === 'function') {
        onNextTick(__resolveThenYes, handlers, v, p.p2s);
    }
    else if (!handlers) {
        __settleYes(v, p.p2s);
    }
    else {
        // TODO: maybe push single function and iterate callbacks once on system stack
        for (var i=0; i<handlers.length; i++) {
            if (typeof handlers[i] === 'function') onNextTick(__resolveThenYes, handlers[i], v, p.p2s[i]);
            else __settleYes(v, p.p2s[i]);
        }
    }
    p.yes = p.no = p.p2s = null;
}
function __notifyListenersNo( v, p, handlers ) {
    if (typeof handlers === 'function') {
        onNextTick(__resolveThenNo, handlers, v, p.p2s);
    }
    else if (!handlers) {
        __settleNo(v, p.p2s);
    }
    else {
        for (var i=0; i<handlers.length; i++) {
            if (typeof handlers[i] === 'function') onNextTick(__resolveThenNo, handlers[i], v, p.p2s[i]);
            else __settleNo(v, p.p2s[i]);
        }
    }
}

/*
 * Resolve the then-promise p to the value returned by its resolve/reject function func.
 * spec: the promise is resolved (not rejected) if func returns a value
 * spec: the promise is rejected if func throws
 * spec: the promise p2 = p1.then(...) takes on the value of promise p1 if no value returned
 */
function __resolveThenYes( resolveHandler, v, p2 ) {
    try { var ret = resolveHandler(v) }
    catch (err) { __settleNo(err, p2); return }
    (ret !== undefined) ? __resolveYes(ret, p2) : __resolveYes(v, p2);
}
function __resolveThenNo( rejectHandler, v, p2 ) {
    try { var ret = rejectHandler(v) }
    catch (err) { __settleNo(err, p2); return }
    (ret !== undefined) ? __resolveYes(ret, p2) : __settleNo(v, p2);
}

/*
 * Global next-tick function handling.  Much faster to run these
 * off a file-local stack than to use even process.nextTick.
 * The functions must never throw (as ensured by __buildNotifyTick).
 */
var processNextTick = (process.version >= 'v4.') ? process.nextTick : setImmediate;
var __queueRunScheduled = false;
var __nextTickQueue = null;            // new (require('qlist'))();

/*
 * Note: faster to build a closure than to setImmediate or nextTick with args,
 *       and much faster to run a stack of closures than to use process.nextTick.
 * Note: 13% faster (benchmark) to build a static object rather than a function closure
 * note: struct member access is *slow* if not optimized, pass plain args if func has try/catch
 * note: {f,v,p} is 3% faster than [f,v,p]
 */
function onNextTick( func, a, b, c ) {
    var closure = {fn: func, a: a, b: b, c: c};
    if (!__queueRunScheduled) {
        processNextTick(runTickQueue);
        __queueRunScheduled = true;
        __nextTickQueue = [ closure ];
    }
    else {
        __nextTickQueue.push(closure);
    }
}
function runTickQueue( ) {
    var closures = __nextTickQueue;
    __nextTickQueue = null;
    __queueRunScheduled = false;

    for (var i=0; i<closures.length; i++) {
        // caution: the called functions must guarantee not to throw
        var call = closures[i];
        call.fn(call.a, call.b, call.c);
    }
}

// safe call the function to use its return value to fulfill promise p1.
// If the function throws, reject the promise with the error.
function __getFunctionValue( fn, p1 ) {
    try { return fn() }
    catch (e) { __settleNo(e, p1) }
}

/*
 * Retrieve the `then` method of a possibly thenable, else return falsy.
 * spec: Promises/A+ spec wants to avoid repeatedly accessing getters,
 *   which requires new closure around then!  Seems pedantic at best.
 * spec: touching vt.then can throw if is a getter
 * spec: if getting vt.then throws, reject promise p1
 * note: run the try/catch in a different function from the retrieve,
 *   since inlining it runs 80% slower (8.2 -> 4.5 m/s)
 * Note: vt must not be null/undefined, and p1 must be pending.
 */
function _getThenMethod( vt, p1 ) {
    try { return _tryGetThenMethod(vt) }
    catch (e) { __settleNo(e, p1); return false }
}
function _tryGetThenMethod( vt ) {
    var then;
    return typeof (then = vt.then) === 'function' ? then : false;
}


// accelerate access
P.prototype = P.prototype;
