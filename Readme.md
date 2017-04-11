q-promise
=========

Very fast bare-bones Promise/A+ compatible nodejs promises.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; the goal was not to be a full package, but
to implement a fast promises engine.


Benchmarks
==========

Resolve the promise

    function make(){
        return new PP(function(resolve, reject) { resolve('foo') });
    }
    var x;
    make().then(function(v){ return x = v });

$ node-v6.7.0 test/benchmark.js

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=6.7.0 v8=5.1.281.83 arch=ia32 mhz=4521 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node         443,171 ops/sec (15 runs of 4 calls in 13.539 out of 24.552 sec, +/- 0%)   1000
    promise    1,318,680 ops/sec (41 runs of 4 calls in 12.437 out of 21.690 sec, +/- 0%)   2976
    rsvp       1,047,040 ops/sec (33 runs of 4 calls in 12.607 out of 21.685 sec, +/- 0%)   2363
    Bluebird   1,913,504 ops/sec (55 runs of 4 calls in 11.497 out of 21.033 sec, +/- 0%)   4318
    q-promise  9,104,758 ops/sec (66 runs of 20 calls in 14.498 out of 20.576 sec, +/- 0%) 20545

$ node-v8.x test/benchmark.js

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=8.0.0-pre v8=5.7.492.69 arch=ia32 mhz=4521 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node       2,224,721 ops/sec (64 runs of 4 calls in 11.507 out of 20.969 sec, +/- 0%)   1000
    promise    1,485,252 ops/sec (42 runs of 4 calls in 11.311 out of 21.360 sec, +/- 0%)    668
    rsvp         981,993 ops/sec (32 runs of 4 calls in 13.035 out of 21.967 sec, +/- 0%)    441
    Bluebird   1,347,072 ops/sec (40 runs of 4 calls in 11.878 out of 21.467 sec, +/- 0%)    606
    q-promise  7,814,585 ops/sec (59 runs of 20 calls in 15.100 out of 20.751 sec, +/- 0%)  3513


Api
===

## new P( executor(resolve, reject) )

Create a promise and call the `executor` function.  The executor will use the
provided `resolve` or `reject` functions to settle (either fulfill with a value or
reject with a reason) the created promise.  Use the `promise.then` method to add
callbacks to the promise to be notified when the promise is settled.

A newly constructed promise is in the "pending" state; it can transition into
"fulfilled" with a value or "rejected" with a reason.  Once no longer pending the
state and value of the promise do not change.

## P.resolve( value )

Create a new promise that will resolve with the value.
Value can be a function, a promise (a _thenable_ actually), or
some other value.

    var promise = P.resolve(123);
    promise.then(function resolve(value) {
        // value => 123
    })

## P.reject( reason )

Create a new promise that will reject with the given reason.

    var promise = P.reject(123);
    promise.then(null, function reject(reason) {
        // reason => 123
    })

## promise.then( resolve, reject )

Once the promise has been finalized (either fulfilled or rejected), call the
`resolve` or `reject` function with the resolving value or rejection reason.

## promise.catch( reject )

If the promise is rejected, call the function `reject` with the reason.
This function is exactly equivalent to calling `promise.then(null, reject)`.

## promise.race( array )

Return a new promise that will take on the value of the first promise in the array
to be fulfilled or rejected.

## promise.all( array )

Return a new promise that will wait for all promises in the array to be fulfilled,
and resolves with the array of their values in the same order as the promises.  If
any of the promises in the array reject, the returned promise will reject with the
same cause without waiting for the other promises to settle.


Resources
=========

- [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) - javascript Promise writeup
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
