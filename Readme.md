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

Resolve the eventually resolved promise (batches of 2000 promises run by `qtimeit` in
a tight loop for 10 seconds.  Results in resolves/second, each batch contributing 2000):

    function make(){
        return new PP(function(resolve, reject) { setImmediate(function(){ resolve('foo') }) });
    }
    var x, ncalls = 0;
    make().then(function(v){ ncalls++; return x = v; });

$ node-v6.7.0 test/benchmark.js

    qtimeit=0.17.0 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=6.7.0 v8=5.1.281.83 arch=ia32 mhz=4522 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node              921,485 ops/sec (72 runs of 40 calls in 6.251 out of 10.476 sec, +/- 0.00%)   921 >>>>>
    Bluebird        3,395,890 ops/sec (60 runs of 200 calls in 7.067 out of 10.368 sec, +/- 0.00%) 3396 >>>>>>>>>>>>>>>>>
    es6-promise     2,990,209 ops/sec (55 runs of 200 calls in 7.357 out of 10.417 sec, +/- 0.00%) 2990 >>>>>>>>>>>>>>>
    rsvp            2,805,561 ops/sec (52 runs of 200 calls in 7.414 out of 10.332 sec, +/- 0.00%) 2806 >>>>>>>>>>>>>>
    promise         4,267,206 ops/sec (70 runs of 200 calls in 6.562 out of 10.316 sec, +/- 0.00%) 4267 >>>>>>>>>>>>>>>>>>>>>
    q-promise       4,986,076 ops/sec (78 runs of 200 calls in 6.257 out of 10.375 sec, +/- 0.00%) 4986 >>>>>>>>>>>>>>>>>>>>>>>>>

(run in isolation for 2 seconds:)

    node              921,819 ops/sec (15 runs of 40 calls in 1.302 out of 2.515 sec, +/- 0.00%)    922 >>>>>
    Bluebird        3,539,432 ops/sec (13 runs of 200 calls in 1.469 out of 2.556 sec, +/- 0.00%)  3539 >>>>>>>>>>>>>>>>>>
    promise         4,693,169 ops/sec (15 runs of 200 calls in 1.278 out of 2.455 sec, +/- 0.00%)  4693 >>>>>>>>>>>>>>>>>>>>>>>
    q-promise       5,636,982 ops/sec (11 runs of 400 calls in 1.561 out of 2.617 sec, +/- 0.00%)  5637 >>>>>>>>>>>>>>>>>>>>>>>>>>>>


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
