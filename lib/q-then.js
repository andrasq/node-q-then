/**
 * q-then -- very fast promises engine
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-04-06 - AR.
 */

'use strict';


module.exports = {
    Promise: P,
};

var _PENDING = 0;               // falsy means pending
var _RESOLVING = false;         // false = pending but committed
var _RESOLVED = 1;              // 1 = resolved (fulfilled)
var _REJECTED = 2;              // 2 = rejected

var _onResolveCb = false;


// The spec requires all promises to be created with an executor, but
// we allow omitting the executor because its faster in a then.
function P( executor ) {
    this.state = _PENDING;
    this.value = undefined;

    if (executor) _tryExecutor(this, executor);
}

P.prototype.state = _PENDING;   // '' pending, 'y' fulfilled, 'n' rejected; initially _PENDING
P.prototype.value = undefined;  // fulfilled value or rejected reason; initially undefined
P.prototype._listeners = null;  // other P / thenables waiting for this value
P.prototype._yes  = null;       // resolve handlers for _listeners
P.prototype._no = null;         // reject handlers for _listeners
P.prototype._resolvedBy = null; // thenable that first resolved the promise

P.resolve = function resolve( v ) {
    var p = new P();
    if (typeof v === 'function') v = __getFunctionValue(v, p);
    return __resolveYes(v, p, p);
}

P.reject = function reject( e ) {
    var p = new P();
    if (typeof e === 'function') e = __getFunctionValue(e, p);
    return __resolveNo(e, p);
}

// convert the callbacked function fn into a function that returns a promise
P.promisify = function promisify( fn, Promise ) {
    if (!Promise) Promise = P;

    return function() {
        var self = this;
        var args = new Array();
        for (var i=0; i<arguments.length; i++) args.push(arguments[i]);
        return new Promise(function executor(resolve, reject) {
            args.push(function(err, val) { if (err) reject(err); else resolve(val); });
            fn.apply(self, args);
        });
    }
}

// convert the promise into a callback invocation.
P.callback = function callback( p1, cb ) {
    if (p1 instanceof P) {
        if (p1.state) {
            (p1.state === _RESOLVED) ? cb(null, p1.value) : cb(p1.value);
        }
        else _addThenListener(p1, function(v, p1, state) {
            (state === _RESOLVED) ? cb(null, v) : cb(v);
        })
    }
    else {
        p1.then(
            function(v) { cb(null, v) },
            function(e) { cb(e) }
        );
    }
}

// given a function returning a promise, convert it into a callbacked function.
// The callback will be called when the returned promise settles.
P.callbackify = function callbackify( fn ) {
    return function() {
        var self = this;
        var args = new Array();
        for (var i=0; i<arguments.length - 1; i++) args.push(arguments[i]);
        var cb = arguments[arguments.length - 1];
        // if (typeof cb !== 'function') ...
        P.callback(fn.apply(self, args), cb);
    }
}

// safe call the function to use its return value to fulfill promise p1.
// If the function throws, reject the promise with the error.
function __getFunctionValue( fn, p1 ) {
    try { return fn() }
    catch (e) { __settle(e, p1, _REJECTED) }
}

// wait for the first promise to resolve, and take on its value.
P.race = function race( promises ) {
    var p2 = new P();

    for (var i=0; i<promises.length; i++) {
        var p1 = promises[i];
        if (p1 && p1.constructor === P) {
            _addThenListener(p1, p2, null, null);
        }
        else {
            var then = _getThenMethod(p1, p2);
            if (then) __resolveGenericThenable(p1, p2, then);
            else if (p2.state) return p2;
            else return __resolveNo(new Error("not a thenable"), p2);
        }
    }

    return p2;
}

/*
 * wait for all promises to resolve, and fulfill with the array of their values.
 * If any reject, reject with that reason.  If promises is empty array, fufill with [].
 */
var _dummyP2 = new P();
P.all = function all( promises ) {
    var p2 = new P();

    if (!promises.length) { __settle([], p2, _RESOLVED); return p2 }

    var nexpect = promises.length;
    var results = new Array(promises.length);
    var nresults = 0;

    function recordValue( v, p1, state, i ) {
        results[i] = v;
        nresults += 1;
        if (state != _RESOLVED) __resolveNo(v, p2, p2);
        else if (nresults === nexpect) __resolveYes(results, p2, p2);
    }

    var info = null;
/**
    var info = {
        p2: p2,
        nexpect: promises.length,
        results: results,
        nresults: 0,
    };
    recordValue = __recordAllValue;
/**/

    for (var i=0; i<promises.length; i++) {
        if (promises[i] instanceof P) {
            if (!promises[i].state) _addThenListener(promises[i], recordValue, i, info);
            else if (promises[i].state === _RESOLVED) {
                results[i] = promises[i].value;
                nresults += 1;
            }
            else { __resolveNo(promises[i].value, p2, p2); break; }
        }
        else {
            var then = _getThenMethod(promises[i], p2);
            if (then) {
                var recordCb = (function(i, p1){
                    return function(v, s) { recordValue(v, p1, s, i, info); }
                })(i, promises[i]);
                __resolveGenericThenable(promises[i], _dummyP2, then, recordCb);
            }
            else { __resolveNo(new Error("not a thenable"), p2, p2); break; }
        }
    }

    return p2;
}
/**
function __recordAllValue( v, p1, state, i, info ) {
    var p2 = info.p2;
    info.results[i] = v;
    info.nresults += 1;
    if (state !== _RESOLVED) __resolveNo(v, p2, p2);
    else if (info.nresults === info.nexpect) __resolveYes(info.results, p2, p2);
}
**/


// Run the executor to resolve the promise when the executor callback is called.
// If the executor resolves with a promise, p1 takes on the value of the promise.
// If the executor rejects with a promise, p1 is rejected with the promise object.
// spec: executor is run immediately
// spec: return value form executor is ignored
// spec: errors thrown in executor cause the promise to reject
function _tryExecutor( p1, executor ) {
    try {
        executor(function(v) { __resolveYes(v, p1, p1) }, function(e) { __resolveNo(e, p1, p1) });
    }
    catch (e) {
        __resolveNo(e, p1, p1);
    }
}

// hooks for testing
P._PENDING = _PENDING;
P._RESOLVING = _RESOLVING;
P._RESOLVED = _RESOLVED;
P._REJECTED = _REJECTED;
P.onResolve = function( onResolve ) {
    _onResolveCb = onResolve;
}
P.prototype._resolve = function _resolve( v ) {
    return __resolveYes(v, this, this);
}
P.prototype._reject = function _reject( e ) {
    return __resolveNo(e, this, this);
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
// Note: a thenable can return another promise, which will eventually fulfill p2,
// Note: cannot optimize away p2, its resolve/reject methods could settle it to a different value.
P.prototype.then = function then( resolve, reject ) {
    var p2 = new P();

    if (this.state) {
        var handler = (this.state === _RESOLVED) ? resolve : reject;
        if (handler && typeof handler === 'function') _handleThen(handler, this.value, p2, this.state);
        else { p2.state = this.state; p2.value = this.value }
    }
    else {
        _addThenListener(this, p2, resolve, reject);
    }

    return p2;
}

// fulfill the promise p2 with value v, settled by pBy.
// if v is a thenable, make p1 take on the current or eventual value of v
// else p1 takes on the value v.  Notify all listeners that p1 settled.
// Resolving with a thenable (a promise) just establishes linkage.
// Settling with a value propagates the value to the linked promises (done in __settle).
// spec, I think: a then could be a property on a function, too (2% hit)
// Not sure if a .then method on the prototype of a non-object should be handled;
// we deliberately ignore it to prevent eg __resolve(3) from resolving to other than 3.
// (ignoring works because typeof Number(3) === 'number')
function __resolveYes( v, p2, pBy ) {
    if (_onResolveCb) _onResolveCb(v, p2, _RESOLVED);
    if (!p2.state) {
        if (p2.state === _RESOLVING && p2.value !== pBy) return p2;
        if ((typeof v === 'object' && v) || typeof v === 'function') {
            if (v.constructor === P) return __resolveP(v, p2, pBy);
            if (__resolveMaybeThenable(v, p2, pBy)) return p2;
        }
        __setState(v, p2, _RESOLVED);
    }
    return p2;
}
// reject the promise p2 with reason v, settled by pBy
function __resolveNo( v, p2, pBy ) {
    if (_onResolveCb) _onResolveCb(v, p2, _REJECTED);
    if (!p2.state) {
        if (p2.state === _RESOLVING && p2.value !== pBy) return p2;
        // reject does not recurse, just reject with the reason even if it is a thenable
        __setState(v, p2, _REJECTED);
    }
    return p2;
}
// Resolve p2 to the value of p1, an object not a P that may be a thenable.
// Thenables always resolve, they reject only if they throw.
// Returns p2 if resolved or rejected, undefined if object was not a thenable.
// pBy was already verified before calling here.
function __resolveMaybeThenable( p1, p2, pBy ) {
    var then = _getThenMethod(p1, p2);
    if (then) {
        p2.state = _RESOLVING;
        p2.value = p1;
        return __resolveGenericThenable(p1, p2, then);
    }
    if (p2.state) return p2;
    // else return undefined
}
// Resolve p2 take on the already settled or eventual state and value of p1 instanceof P.
// This function is called when resolving a promise with another promise, never from `then()`.
// pBy was already verified before calling here.
function __resolveP( p1, p2, pBy ) {
    if (p1 === p2) {
        __settle(new TypeError("cannot resolve promise with itself"), p2, _REJECTED);
    }
    else {
        p2.state = _RESOLVING;
        p2.value = p1;
        if (!p1.state) {
            _addThenListener(p1, p2, null, null);
        } else {
            __settle(p1.value, p2, p1.state);
        }
    }
    return p2;
}
// with a generic thenable p2, use callbacks bound to p2 to retrieve the (eventual or already settled) value
// This function is only called if the thenable p1 is permitted to resolve p2 (ie, p2 is not resolving yet)
// Do not settle p2  to err if resolveHandler / rejectHandler have been called,
// in that case must resolve to the returned value and ignore the error.
// FIXME: should log the ignored error
function __resolveGenericThenable( p1, p2, then, cb ) {
    var called = false;
    var err = __callThenMethod(p2, then, p1,
        function(v){ if (!called) { called = true; __resolveYes(v, p2, p1); if (cb) cb(v, _RESOLVED) }; },
        function(e){ if (!called) { called = true; __resolveNo(e, p2, p1); if (cb) cb(e, _REJECTED) } });
    if (err) { if (!called) { __settle(err, p2, _REJECTED); if (cb) cb(err, _REJECTED) } }
    return  p2;
}
// call thenable.then, return the error if then throws so the caller can reject
function __callThenMethod( p2, thenMethod, thenable, resolveHandler, rejectHandler ) {
    try { thenMethod.call(thenable, resolveHandler, rejectHandler) }
    catch (err) { return err }
}

// settle the promise with the given fulfill value / reject reason
// note that __resolveNo() only settles from the resolving promise,
// whereas __settle finalizes the state if still pending.  This is useful to
// handle exceptions.
function __setState( v, p, state ) {
    p.state = state
    p.value = v;
    if (p._listeners) {
        _notifyThenListeners(v, p, state);
    }
}
function __settle( v, p, state ) {
    if (p.state) return;
    __setState(v, p, state);
}

/*
 * add the then callbacks for promise p2 as listeners on p1
 * The lists handle one, two, many items, but are single-item optimized:
 * if p1._listeners is not an array, the list is omitted, just the item is stored.
 * invariant: p1._listeners is null, a thenable, or an Array; _yes and _no match it.
 * The alternate of a single queue of listener objects { p2, resolve, reject } is 12% slower.
 */
function _addThenListener( p1, p2, resolve, reject ) {
    if (!p1._listeners) {
        p1._listeners = p2;
        p1._yes = resolve;
        p1._no = reject;
    }
    else if (p1._listeners.constructor !== Array) {
        p1._listeners = [ p1._listeners, p2 ];
        p1._yes = [ p1._yes, resolve ];
        p1._no = [ p1._no, reject ];
    }
    else {
        p1._listeners.push(p2);
        p1._yes.push(resolve);
        p1._no.push(reject);
    }
}

/*
 * resolve the thenables waiting for p1 to settle
 * If the listener is a callback function, invoke it with the value and
 * all the saved listener parameters.
 */
function _notifyThenListeners( v, p1, state ) {
    var listeners = p1._listeners;
    var onYes = p1._yes, onNo = p1._no;
    var handlers = (state === _RESOLVED) ? onYes : onNo;
    p1._listeners = p1._yes = p1._no = null;

    if (listeners.constructor !== Array) {
        if (typeof listeners === 'function') listeners(v, p1, state, onYes, onNo); else
        _handleThen(handlers, v, listeners, state, p1);
    }
    else {
        var len = listeners.length;
        for (var i=0; i<len; i++) {
            if (typeof listeners[i] === 'function') listeners[i](v, p1, state, onYes[i], onNo[i]); else
            _handleThen(handlers[i], v, listeners[i], state, p1);
        }
    }
}
// Both then callbacks resolve to the returned value, unless the callback throws.
// spec: Then callbacks should be called when on the system stack, not the app stack,
// hence the onNextTick() / process.nextTick() wrappering.
// p2 was created as p2 = p1.then(res, rej).
// Note: there is an expectation that .then() may be called recursively, so
// chop up the stack to handle long chains of promise-to-promise resolutions.
// Chop with setImmediate, since node before v4 did not accept args to process.nextTick.
// NOTE: some benchmarks are very sensitive to the latency of then().
var _stackDepth = 0;
function _handleThen( handler, v, p2, state, pBy ) {
    if (typeof handler === 'function') {
        onNextTick(_handleThenHandler, handler, v, p2, pBy);
    }
    else if (_stackDepth < 10) {
        _stackDepth++;
        __settle(v, p2, state);
        _stackDepth--;
    }
    else setImmediate(__settle, v, p2, state);
}
// invoke the then callback, resolve to the returned value (or reject if it threw)
function _handleThenHandler( handler, v, p2, pBy ) {
    try { var ret = handler(v) }
    catch (err) { __settle(err, p2, _REJECTED); return }
    __resolveYes(ret, p2, pBy);
}

/*
 * Global next-tick function handling.  Much faster to run these
 * off a file-local stack than to use even process.nextTick.
 * The functions must never throw (as ensured by __buildNotifyTick).
 * Note that process.nextTick only accepts arguments since node v4.
 */
var __queueRunScheduled = false;
var __nextTickQueue = null;            // new (require('qlist'))();

/*
 * Note: faster to build a closure than to setImmediate or nextTick with args,
 *       and much faster to run a stack of closures than to use process.nextTick.
 * Note: faster to build a static object rather than a function closure
 * note: struct member access is *slow* if unoptimized, pass plain args if func has try/catch
 * note: {f,v,p} is 3% faster than [f,v,p]
 * note: setImmediate() is sometimes faster than nextTick(); use setImmediate for cases with i/o
 */
function onNextTick( func, a, b, c, d ) {
    var closure = {fn: func, a: a, b: b, c: c, d: d };
    if (!__queueRunScheduled) {
        //process.nextTick(runTickQueue);
        setImmediate(runTickQueue);
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
        var call = closures[i], fn = call.fn;
        fn(call.a, call.b, call.c, call.d);
    }
}

/*
 * Retrieve the `then` method of a possibly thenable, else return falsy.
 * spec: Promises/A+ spec wants to avoid repeatedly accessing getters,
 *   which requires new closure around then!  Seems pedantic at best.
 * spec: touching p1.then can throw if is a getter
 * spec: if getting vt.then throws, reject promise p1
 * note: run the try/catch in a different function from the retrieve,
 *   since inlining it runs 80% slower (8.2 -> 4.5 m/s)
 * Note: vt must not be null/undefined, and p1 must be pending.
 */
function _getThenMethod( vt, p1 ) {
    try { return _tryGetThenMethod(vt) }
    catch (e) { __settle(e, p1, _REJECTED); return false }
}
function _tryGetThenMethod( vt ) {
    var then;
    return typeof (then = vt.then) === 'function' ? then : false;
}


// accelerate access
P.prototype = P.prototype;
