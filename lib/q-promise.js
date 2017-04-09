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


// spec: executor is run immediately
// spec: return value form executor is ignored
// spec: errors thrown in executor cause the promise to reject
function _tryExecutor( self, resolver ) {
    try {
        resolver(function(v) { __resolve(v, self, 'y') }, function(e) { __resolve(e, self, 'n') })
    }
    catch (e) {
        __resolve(e, self, 'n');
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
/**
    if (typeof v === 'function') {
// FIXME: is v allowed to be a function?
        nextTick(__buildNotifyTick(undefined, v, p));
        return p;
    }
    else
**/
    return __resolve(v, p, 'y');
}

P.reject = function reject( e ) {
    var p = new P();
    return __resolve(e, p, 'n');
}

P.all = function race( promises ) {
    // WRITEME
}

P.all = function all( promises ) {
    // WRITEME
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
P.prototype.then = function then( resolve, reject ) {
    var p2 = new P();

    switch (this.state) {
    case 'y':
        if (typeof resolve === 'function') nextTick(__buildNotifyTick(resolve, this.value, p2));
        else { p2.state = this.state; p2.value = this.value }
        break;
    case 'n':
        if (typeof reject === 'function') nextTick(__buildNotifyTick(reject, this.value, p2));
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
function __resolve( v, p1, state ) {
    if (p1.state) return;

    if (v && typeof v === 'object') {
        if (v === p1) return __rejectError(p1, "cannot fulfill promise with itself");

        var then = _getThenMethod(v);
        if (then) return __resolveThenable(v, p1, state, then);
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
function __rejectError( p1, message ) {
    __settleNo(new Error(message), p1);
    return p1;
}
function __resolveThenable( vt, p1, state, then ) {
    var self = this;
    if (vt.constructor === P) {
        if (!vt.state) {
            __addListeners(vt, p1, __settleYes, __settleNo);
        } else {
            __settle(vt.value, p1, vt.state);
        }
    }
    else {
        // use bound callbacks to wait for or copy value of generic thenable
        _callThenMethod(p1, then, vt, function(v){ __settleYes(v, p1) }, function(e){ __settleNo(e, p1) });
    }
    return p1;
}
// call thenable.then, reject the promise if it throws
function _callThenMethod( p, thenMethod, thenable, a, b ) {
    try { thenMethod.call(thenable, a, b) }
    catch (err) { p._reject(err) }
}

// settle the promise with the given terminal value
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
    if (p.p2s) __notifyListeners(v, p, p.yes);
}
function __settleNo( v, p ) {
    if (p.state) return;
    p.state = 'n';
    p.value = v;
    if (p.p2s) __notifyListeners(v, p, p.no);
}

/*
 * add the then callbacks for promise p2 as listeners on self
 * The lists handle one, two, many items, but are single-item optimized:
 * if self.p2s is not an array, the list is omitted, just the item is stored.
 */
function __addListeners( self, p2, resolve, reject ) {
    if (!self.p2s) {
        self.p2s = p2;
        self.yes = resolve;
        self.no = reject;
    }
    else if (self.p2s.constructor !== Array) {
        self.p2s = [self.p2s, p2];
        self.yes = [self.yes, resolve];
        self.no = [self.no, reject];
    }
    else {
        self.p2s.push(p2);
        self.yes.push(resolve);
        self.no.push(reject);
    }
}
function __notifyListeners( v, p, funcs ) {
    if (typeof funcs === 'function') {
        // would run 60% faster if not for the double wrappering
        nextTick(__buildNotifyTick(funcs, v, p.p2s));
    }
    else for (var i=0; i<funcs.length; i++) {
        if (typeof funcs[i] === 'function') {
            nextTick(__buildNotifyTick(funcs[i], v, p.p2s[i]));
        }
    }
    p.yes = p.no = p.p2s = null;
}
/*
 * Resolve the then-promise p to the value returned by its resolve/reject function func.
 * spec: the promise is resolved (not rejected) unless func throws.
 * Note: faster to build a closure than to setImmediate or nextTick with args,
 *       and much faster to run a stack of closures than to use process.nextTick.
 * Note: 13% faster (benchmark) to build a static object rather than a closure
 */
function __buildNotifyTick( func, v, p ) {
    return {f: func, v: v, p: p};
}

/*
 * Global next-tick function handling.  Much faster to run these
 * off a file-local stack than to use even process.nextTick.
 * The functions must never throw (as ensured by __buildNotifyTick).
 */
var scheduleNextTick = (process.version >= 'v4.') ? process.nextTick : setImmediate;
var __nextTickScheduled = false;
var __nextTickStack = null;            // new (require('qlist'))();
// TODO: try without the closure, just push the func and the args
// would need addl arrays __nextTickFuncStack, __nextTickValueStack, __nextTickPStack
function nextTick( func ) {
    if (!__nextTickScheduled) {
        scheduleNextTick(__runNextTickFunctions);
        __nextTickScheduled = true;
        __nextTickStack = [ func ];
    }
    else {
        __nextTickStack.push(func);
    }
}
function __runNextTickFunctions( ) {
    var calls = __nextTickStack;
    __nextTickStack = null;
    __nextTickScheduled = false;;

    for (var i=0; i<calls.length; i++) {
        __invokeNextTickClosure(calls[i].f, calls[i].v, calls[i].p);
    }

    // TODO: maybe pause periodically to not block the event loop?
    // Would have to be careful to be sure and maintain func order.
}
// note: struct member access is *slow* if not optimized, pass plain args if func has try/catch
// note: {f,v,p} is 5% faster than [f,v,p]
function __invokeNextTickClosure( f, v, p ) {
    try {
        var value = f(v, p);
        __resolve(value, p, 'y');
    }
    catch (err) {
        try { __settleNo(err, p) } catch (e) { }
    }
}

/*
 * Retrieve the `then` method of a possibly thenable, else return falsy.
 * spec: Promises/A+ spec wants to avoid repeatedly accessing getters,
 *   which requires new closure around then!  Seems pedantic at best.
 * spec: touching p.then can throw if is a getter
 * note: run the try/catch in a different function from the retrieve,
 *   since inlining it runs 80% slower (8.2 -> 4.5 m/s)
 */
function _getThenMethod( p ) {
    try { return _tryGetThenMethod(p) } catch (e) { return false }
}
function _tryGetThenMethod( p ) {
    var then;
    return typeof (then = p.then) === 'function' ? then : false;
}


// accelerate access
P.prototype = P.prototype;
