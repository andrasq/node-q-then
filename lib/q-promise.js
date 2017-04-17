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


var _PENDING = 0;               // falsy means pending
var _RESOLVED = 1;              // 1 = resolved
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
P.prototype._listeners = null;  // other thenables waiting for this value
P.prototype._subs = null;       // other P waiting to take on this value
P.prototype._yes  = null;       // resolve handlers for _listeners
P.prototype._no = null;         // reject handlers for _listeners

P.resolve = function resolve( v ) {
    var p = new P();
    if (typeof v === 'function') {
        return __resolveYes(__getFunctionValue(v, p), p);
    }
    return __resolveYes(v, p);
}

P.reject = function reject( e ) {
    var p = new P();
    if (typeof e === 'function') {
        return __resolveNo(__getFunctionValue(e, p), p);
    }
    return __resolveNo(e, p);
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
            if (!then || p2.state) { __settle(new Error("not a thenable"), p2, _REJECTED); return p2 }
            _callThenMethod(p2, then, p1, function(v) { __resolveYes(v, p2) }, function(e) { __resolveNo(e, p2) });
        }
    }

    return p2;
}

// wait for all promises to resolve, and fulfill with the array of their values.
// If any reject, reject with that reason.  If promises is empty array, fufill with [].
P.all = function all( promises ) {
    var p2 = new P();

    if (!promises.length) { __settle([], p2, _RESOLVED); return p2 }

    var state = {
        nexpect: promises.length,
        nresults: 0,
        results: new Array(promises.length),
    };

    for (var i=0; i<promises.length; i++) {
        __saveAllResults(state, i, promises[i], p2);
        if (p2.state) return p2;
    }

    return p2;
}
function __saveAllResults( state, i, p1, p2 ) {
    var then = _getThenMethod(p1, p2);
    if (!then || p2.state) { __settle(new Error("not a thenable"), p2, _REJECTED); return p2 }

    var resolve = function(v) {
        state.results[i] = v;
        state.nresults += 1;
        if (state.nresults === state.nexpect) __resolveYes(state.results, p2);
    }
    _callThenMethod(p2, then, p1, resolve, function reject(e) { __resolveNo(e, p2) });
}


// Run the executor to resolve the promise eventually.
// spec: executor is run immediately
// spec: return value form executor is ignored
// spec: errors thrown in executor cause the promise to reject
function _tryExecutor( p1, executor ) {
    try {
        executor(function(v) { __resolveYes(v, p1) }, function(e) { __resolveNo(e, p1) })
    }
    catch (e) {
        __resolveNo(e, p1);
    }
}

// hooks for testing
P._PENDING = _PENDING;
P._RESOLVED = _RESOLVED;
P._REJECTED = _REJECTED;
P.onResolve = function( onResolve ) {
    _onResolveCb = onResolve;
}
P.prototype._resolve = function _resolve( v ) {
    return __resolveYes(v, this);
}
P.prototype._reject = function _reject( e ) {
    return __resolveNo(e, this);
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

// fulfill / reject promise p1 with the value v
// if v is a thenable, make p1 take on the current or eventual value of v
// else p1 takes on the value v.  Notify all listeners that p1 settled.
// Resolving with a thenable (a promise) just establishes linkage.
// Settling with a value propagates the value to the linked promises (done in __settle).
// spec, I think: a then could be a property on a function, too (2% hit)
// Not sure if a .then method on the prototype of a non-object should be handled;
// we deliberately ignore it to prevent eg __resolve(3) from resolving to other than 3.
// (ignoring works because typeof Number(3) === 'number')
function __resolveYes( v, p2 ) {
    if (_onResolveCb) _onResolveCb(v, p2, _RESOLVED);
    if (!p2.state) {
        if ((typeof v === 'object' && v) || typeof v === 'function') {
            if (v.constructor === P) return __resolveP(v, p2);
            if (__resolveMaybeThenable(v, p2)) return p2;
        }
        __setState(v, p2, _RESOLVED);
    }
    return p2;
}
function __resolveNo( v, p2 ) {
    if (_onResolveCb) _onResolveCb(v, p2, _REJECTED);
    if (!p2.state) {
        if ((typeof v === 'object' && v) || typeof v === 'function') {
            if (v.constructor === P) return __resolveP(v, p2);
            if (__resolveMaybeThenable(v, p2)) return p2;
        }
        __setState(v, p2, _REJECTED);
    }
    return p2;
}
// Resolve p2 to the value of p1, an object not a P that may be a thenable.
// Thenables always resolve, they reject only if they throw.
// Returns p2 if resolved or rejected, undefined if object was not a thenable.
function __resolveMaybeThenable( p1, p2 ) {
    var then = _getThenMethod(p1, p2);
    if (then) return __resolveGenericThenable(p1, p2, then);
    if (p2.state) return p2;
    // else return undefined
}
// Resolve p2 take on the already settled or eventual state and value of p1 instanceof P.
// This function is called when resolving a promise with another promise, never from `then()`.
function __resolveP( p1, p2 ) {
    if (p1 === p2) {
        __settle(new TypeError("cannot resolve promise with itself"), p2, _REJECTED);
    }
    else {
        if (!p1.state) {
            _addThenListener(p1, p2, null, null);
        } else {
            __settle(p1.value, p2, p1.state);
        }
    }
    return p2;
}
// with a generic thenable p2, use callbacks bound to p2 to retrieve the (eventual or already settled) value
function __resolveGenericThenable( p1, p2, then ) {
    _callThenMethod(p2, then, p1, function(v){ __resolveYes(v, p2) }, function(e){ __resolveNo(e, p2) });
    return p2;
}
// call thenable.then, reject the promise if it throws
function _callThenMethod( p2, thenMethod, thenable, resolveHandler, rejectHandler ) {
    try { thenMethod.call(thenable, resolveHandler, rejectHandler) }
    catch (err) { __settle(err, p2, _REJECTED) }
}

// settle the promise with the given fulfill value / reject reason
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
 */
function _notifyThenListeners( v, p1, state ) {
    var listeners = p1._listeners;
    var handlers = (state === _RESOLVED) ? p1._yes : p1._no;
    p1._listeners = p1._yes = p1._no = null;

    if (listeners.constructor !== Array) {
        _handleThen(handlers, v, listeners, state);
    }
    else {
        var len = listeners.length;
        for (var i=0; i<len; i++) _handleThen(handlers[i], v, listeners[i], state);
    }

}
// Both then callbacks resolve to the returned value, unless the callback throws.
// spec: This function should be called when on the system stack, not the app stack,
// hence the onNextTick() wrappering.
// p2 was created as p2 = p1.then(res, rej).
function _handleThen( handler, v, p2, state ) {
    if (typeof handler === 'function') onNextTick(_handleThenHandler, handler, v, p2);
    else __settle(v, p2, state);
}
// invoke the then callback, resolve to the returned value (or reject if it threw)
function _handleThenHandler( handler, v, p2 ) {
    try { var ret = handler(v, p2) }
    catch (err) { __settle(err, p2, _REJECTED); return }
    __resolveYes(ret, p2);
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
 * Note: 13% faster (benchmark) to build a static object rather than a function closure
 * note: struct member access is *slow* if not optimized, pass plain args if func has try/catch
 * note: {f,v,p} is 3% faster than [f,v,p]
 */
function onNextTick( func, a, b, c ) {
    var closure = {fn: func, a: a, b: b, c: c};
    if (!__queueRunScheduled) {
        process.nextTick(runTickQueue);
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
        fn(call.a, call.b, call.c);
    }
}

// safe call the function to use its return value to fulfill promise p1.
// If the function throws, reject the promise with the error.
function __getFunctionValue( fn, p1 ) {
    try { return fn() }
    catch (e) { __settle(e, p1, _REJECTED) }
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
