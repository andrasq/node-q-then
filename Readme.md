q-promise
=========

Very fast bare-bones Promise/A+ compatible nodejs promises.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; the goal was not to be a full package, but
to implement a fast promises engine.

As of version 0.5.2 all the Promises/A+ tests pass.


Benchmarks
==========

Resolve the promise (q-promise 0.5.4, resolving 2000 promises like the below in a
tight loop for 2 seconds):

    var ncalls = 0;
    function make(){
        return new PP(function(resolve, reject) { resolve('foo') });
    }
    var x;
    make().then(function(v){ ncalls++; return x = v; });

$ node-v6.7.0 test/benchmark.js

    qtimeit=0.17.0 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=6.7.0 v8=5.1.281.83 arch=ia32 mhz=4523 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node            1,072,830 ops/sec (5 runs of 200 calls in 1.864 out of 2.684 sec, +/- 0.00%)    536 >>>
    Bluebird        4,175,463 ops/sec (14 runs of 200 calls in 1.341 out of 2.343 sec, +/- 0.00%)  2088 >>>>>>>>>>
    es6-promise     4,016,423 ops/sec (14 runs of 200 calls in 1.394 out of 2.423 sec, +/- 0.00%)  2008 >>>>>>>>>>
    rsvp            4,742,373 ops/sec (15 runs of 200 calls in 1.265 out of 2.345 sec, +/- 0.00%)  2371 >>>>>>>>>>>>
    promise         6,619,192 ops/sec (12 runs of 400 calls in 1.450 out of 2.437 sec, +/- 0.00%)  3310 >>>>>>>>>>>>>>>>>
    q-promise       9,987,469 ops/sec (5 runs of 2k calls in 2.003 out of 2.755 sec, +/- 0.00%)    4994 >>>>>>>>>>>>>>>>>>>>>>>>>

(run in isolation:)

    node            1,085,536 ops/sec (5 runs of 200 calls in 1.842 out of 2.658 sec, +/- 0.00%)    543 >>>
    promise         7,370,428 ops/sec (13 runs of 400 calls in 1.411 out of 2.544 sec, +/- 0.00%)  3685 >>>>>>>>>>>>>>>>>>
    q-promise      11,815,840 ops/sec (6 runs of 2k calls in 2.031 out of 2.930 sec, +/- 0.00%)    5908 >>>>>>>>>>>>>>>>>>>>>>>>>>>>>>


Api
===

## new P( executor(resolve, reject) )

Create a promise and call the `executor` function.  The executor will use the
provided `resolve` or `reject` functions to settle the created promise (either
fulfill with a value or reject with a reason).  Use the `promise.then` method to
add callbacks to be notified when the promise is settled.

A newly constructed promise is in the "pending" state; it can transition into
"fulfilled" with a value or "rejected" with a reason.  Once no longer pending the
state and value of the promise do not change.

## P.resolve( value )

Create a new promise that will resolve with the value.  Value can be a function, a
promise (any _thenable_), or some other value.  Functions are resolved with their return value.
Terminal values resolve immediate.  For thenables the promise will take on the value and status
of the thenable when it resolves, either fulfilled with a value or rejected with a reason.

    var promise = P.resolve(123);
    promise.then(function resolve(value) {
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

## promise.then( [resolveHandler(value) [,rejectHandler(reason)]] )

Create a new promise that will notify the appropriate handler just before settling and
will settle with the value returned by the handler, or will reject with the thrown
reason.  If the appropriate handler is not a function, the new promise takes on the
value and state of `promise` when it eventually settles.

If the promise is about to fulfill and a `resolveHandler` is given, it passes the
fulfill value from `promise` to the handler and fulfills with the value returned by
the handler instead.  If the handler throws, the promise rejects with the thrown error
as the reason.  If `resolveHandler` is not a function, the promise fulfills with the
original value.

If the promise is about to reject and a `rejectHandler` is given, it passes the reason
`promise` rejected to the handler, and *fulfills* with the value returned by the
handler.  Note that if `rejectHandler` returns, the new promise fulfills; to reject,
the handler must throw.  If `resolveHandler` is not a function, the promise rejects
with the original reason.

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


Resources
=========

- [MDN Promise reference](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) - javascript Promise writeup
- [Promises/A+](https://promisesaplus.com/) - javascript promises interoperability spec
- [Promises/A+ tests](https://github.com/promises-aplus/promises-tests)

Related Work
============

- [`q-promise`](https://github.com/andrasq/node-q-promise) - very fast promises engine
- [`bluebird`](https://npmjs.com/package/bluebird) - fast promises package
- [`promise`](https://npmjs.com/package/promise) - promises package
- [`rsvp`](https://npmjs.com/package/rsvp) - promises package
- [`qinvoke`](https://npmjs.com/package/qinvoke) - fast call interception and re-invocation
- [`qtimeit`](https://npmjs.com/package/qtimeit) - accurate nodejs call timings
