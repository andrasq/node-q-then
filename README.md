q-then
======
[![Build Status](https://api.travis-ci.org/andrasq/node-q-then.svg?branch=master)](https://travis-ci.org/andrasq/node-q-then?branch=master)
[![Coverage Status](https://coveralls.io/repos/github/andrasq/node-q-then/badge.svg?branch=master)](https://coveralls.io/github/andrasq/node-q-then?branch=master)

Fast bare-bones very small Promises/A+ compatible nodejs promises library.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; the goal was not to be a full package, but
to implement a fast promises engine.

As of version 0.5.2 all the Promises/A+ tests pass.

To run the tests or benchmarks, check out the repo from https://github.com/andrasq/node-q-then.


Benchmarks
==========

Resolve the eventually resolved promises (batches of 1000 promises run by `qtimeit` in
a tight loop for 10 seconds, each test run in a separate process.  Results in
resolves/second, each batch contributing 1000):

$ node-v6.10.2 test/benchmark.js

    P: v0.8.0
    benchmark: nloops=1000, timeGoal=5, forkTests=true
    testFunc = function mikeTest( PP, cb ) {
        function _asyncP(x) { return new PP(function(y, n) { setImmediate(y, x) }); }
        function _recursiveP(x) { return x > 0 ? _recursiveP(x-1).then(function(v){ return _asyncP(x) }) : PP.resolve(x) }

        var callsAtStart = ncalls;
        function make() {
            return _recursiveP(20);
        }
        for (var i=0; i<nloops; i++) {
            make().then(function(v){ ncalls++; return x = v; })
        }
        if (cb) waitForEnd(callsAtStart + nloops, cb);
    }
    qtimeit=0.18.0 node=6.10.2 v8=5.1.281.98 platform=linux kernel=3.16.0-4-amd64 up_threshold=11
    arch=ia32 mhz=4206 cpuCount=8 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz"
    name  speed  (stats)  rate
    node           15,386 ops/sec (12 runs of 4 calls in 3.120 out of 6.647 sec, +/- 0.01%)      308 >>
    when           52,250 ops/sec (11 runs of 20 calls in 4.210 out of 6.008 sec, +/- 0.01%)    1045 >>>>>
    rsvp           58,368 ops/sec (12 runs of 20 calls in 4.112 out of 6.006 sec, +/- 0.00%)    1167 >>>>>>
    es6-promise    41,505 ops/sec (25 runs of 4 calls in 2.409 out of 5.689 sec, +/- 0.01%)      830 >>>>
    bluebird       63,933 ops/sec (13 runs of 20 calls in 4.067 out of 5.874 sec, +/- 0.01%)    1279 >>>>>>
    promise       142,504 ops/sec (24 runs of 20 calls in 3.368 out of 5.594 sec, +/- 0.01%)    2850 >>>>>>>>>>>>>>
    q-then        184,915 ops/sec (29 runs of 20 calls in 3.137 out of 5.556 sec, +/- 0.01%)    3698 >>>>>>>>>>>>>>>>>>


Api
===

## new P( executor(resolve, reject) )

Create a promise and initialize it using the user-provided `executor` function.
The executor is passed two functions to use to `resolve` or `reject` the new promise
(fulfill with a value or reject with a reason, respectively).  Use the `promise.then` method
to add callbacks to be notified when the promise is settled.

A newly constructed promise is in the "pending" state until it is settled: resolved with
a value) or a rejected with failure reason.  If resolved with a Promise or a thenable
the new promise remains pending and will eventually take on the final value and state of the
thenable.  If the executor calls reject() or throws an exception, the new promise will
settle into the rejecting state with the reason or throw error.  Once settled (no longer
pending), the value and state of a Promise do not change.

    var P = require('q-then').Promise;
    var promise = new P(function(resolve, reject) {
        resolve(123);
    })
    promise.then(function(v) {
        // v => 123
    })

## P.resolve( value )

Create a new promise that will resolve with the value.  Value can be any javascript value
or a Promise or thenable.  If a js value, the new promise is resolved with that value.
If a Promise or thenable, the promise will eventually resolve or reject, same as the thenable.

    var promise = P.resolve(123);
    promise.then(function(value) {
        // value => 123
    })

## P.reject( reason )

Create a new promise that will reject with the given reason.  The reason is used as
is, even if it is a thenable (thenables are not waited to resolve).

    var promise = P.reject(123);
    promise.then(null, function reject(reason) {
        // reason => 123
    })

## P.race( array )

Create a new promise that will take on the value of the first promise in the array
to be fulfilled or rejected.

## P.all( array )

Create a new promise that will wait for all promises in the array to be fulfilled,
and resolves with the array of their values in the same order as the promises.  If
any of the promises in the array reject, the returned promise will reject with the
same reason without waiting for the other promises to settle.

## P.allSettled( array )

Create a new promise that waits for all promises in the array to fulfill or reject, and
resolves to an array of objects with fields `status`and either `value` or `reason`:
if status is `'fulfilled'` then the value, else if `'rejected'` then the reason.
Non-thenables resolve to themselves.  This function never rejects.

    var p = P.allSettled([P.resolve(1), P.reject(2)]);
    await p;
    // => [ {status: 'fulfilled', value: 1}, {status: rejected', value: 2} ]

## P.promisify( func [,PP] )

Convert the callbacked function `func` into a function that does not take callback
but returns a promise instead.  Also works for methods.  The optional argument `PP`
is the promise system to use, eg the nodejs built-in `Promise` (the default is `P`).

## P.callback( promise, cb(err, val) )

Convert a promise into a callback invocation.  Unlike callbackify, callback invocation
can be optimized for the type of the thenable.

## P.callbackify( func )

Convert the function `func` returning a promise into a function taking a callback.
This is simply `P.callback` applied to the promise returned by `func`.

The returned function takes the same arguments as `func`, followed by a standard
callback.  If the promise returned by `func` fulfills with value `val`, the
callback is invoked with `(null, val)`.  If it rejects with `reason`, the callback
is invoked with `(reason)`.  If `func` throws, the error is not caught.

Note that a rejection reason can be any value, but well behaved applications should
reject with an `Error`, or at a minimum a truthy value.

    var laterP = function(a, b) {
        return new Promise(function(rs, rj) { setTimeout(rs, 5, a + b); })
    }
    var laterCb = P.callbackify(laterP);
    laterCb(1, 2, function(err, val) {
        assert(val == 3);
    })

## promise.then( [resolveHandler(value) [,rejectHandler(reason)]] )

Create a new promise that will notify the appropriate handler just before settling and
will settle with the value returned by the handler, or will reject with the thrown
reason.  If the appropriate handler is not a function, the new promise takes on the
value and state of `promise` when it eventually settles.

If the promise is about to fulfill and a `resolveHandler` is given, it passes the
fulfill value to the handler and fulfills with the value returned by the handler
instead.  If `resolveHandler` returns another promise, the `then` promise will follow
the value of the other promise.  If the handler throws, the promise rejects with the
thrown error as the reason.  If `resolveHandler` is not a function, the promise
fulfills with the original value.

If the promise is about to reject and a `rejectHandler` is given, it passes the reason
`promise` rejected to the handler, and *fulfills* with the value returned by the
handler.  Note that if `rejectHandler` returns, the new promise fulfills; to reject,
the handler must throw.  If `rejectHandler` returns another promise, the `then` promise
will follow the value of the other promise.  If `resolveHandler` is not a function,
the promise rejects with the original reason.

    var p1 = Promise.resolve(1);
    var p2 = p1.then(function(v) { console.log("p1 fulfilled with", v); return 2 },
                     function(e) { console.log("p1 rejected with", e); return 3 });
    var p3 = p2.then(function(v) { console.log("p2 fulfilled with", v) },
                     function(e) { console.log("p2 rejected with", e) });
    // => p1 fulfilled with 1
    // => p2 fulfilled with 2

## promise.catch( rejectHandler )

If the promise is rejected, call the function `rejectHandler` with the reason and
fulfill with the value returned by the handler.  This function is exactly equivalent
to calling `promise.then(null, rejectHandler)`.


ChangeLog
=========

- 1.1.0 - new `P.allSettled`, rewrite and fix `all` to resolve non-thenables
- 1.0.1 - fix resolve/reject to return a function, not the computed value
- 1.0.0 - first released version (was 0.10.5)
- 0.10.4 - final callbackify
- 0.8.0 - initial callbackify
- 0.7.2 - promisify
- 0.5.4 - full A+ promises compatibility


Resources
=========

- my [Quick Reference Guide](https://github.com/andrasq/node-docs/blob/master/promises-guide.md)
- [MDN Promise reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) - javascript Promise writeup
- [Promises/A+](https://promisesaplus.com/) - javascript promises interoperability spec
- [Promises/A+ tests](https://github.com/promises-aplus/promises-tests)
- [E Promises](http://erights.org/talks/promises/paper/tgc05.pdf)
- Barbara Liskov and Lubia Shrira. Promises: linguistic support for efficient
  asynchronous procedure calls in distributed systems.  In 88: Proceedings of the ACM
  SIGPLAN 1988 conference on Programming Language design and Implementation, pages
  267, New York, NY, USA, 1988. ACM Press.260PLDI
- Phillip Bogle and Barbara Liskov. Reducing cross domain call overhead using batched
  futures. In 94: Proceedings of the ninth annual conference on Object-oriented
  programming systems, language, and applications, pages 354, New York, NY, USA, 1994.
  ACM Press.

Related Work
============

- [`q-then`](https://github.com/andrasq/node-q-then) - this one
- [`bluebird`](https://npmjs.com/package/bluebird) - promises package
- [`promise`](https://npmjs.com/package/promise) - promises package
- [`rsvp`](https://npmjs.com/package/rsvp) - promises package
- [`when`](https://npmjs.com/package/when) - promises package
- [`pinkie`](https://npmjs.com/package/pinkie) - promises package
- [`qinvoke`](https://npmjs.com/package/qinvoke) - fast call interception and re-invocation
- [`qtimeit`](https://npmjs.com/package/qtimeit) - accurate nodejs call timings
