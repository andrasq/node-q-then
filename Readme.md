q-promise
=========

Very fast bare-bones Promise/A+ compatible nodejs promises.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; the goal was not to be a full package, but
to implement a fast promises engine.

**Work in progress.** Not all the Promise/A+ tests pass, and some features are
better left unimplemented (eg, `then` attached to `Number.prototype`)


Benchmarks
==========

Resolve the promise (q-promise 0.4.0, resolving 2000 promises like the below in a
tight loop for 2 seconds):

    var ncalls = 0;
    function make(){
        return new PP(function(resolve, reject) { resolve('foo') });
    }
    var x;
    make().then(function(v){ ncalls++; return x = v; });

$ node-v6.7.0 test/benchmark.js

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=6.7.0 v8=5.1.281.83 arch=ia32 mhz=4521 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node          1,080,895 ops/sec (5 runs of 200 calls in 1.850 out of 2.395 sec, +/- 0%)      1000
    promise       6,743,856 ops/sec (14 runs of 400 calls in 1.661 out of 2.410 sec, +/- 0%)     6239
    rsvp          4,613,453 ops/sec (17 runs of 200 calls in 1.474 out of 2.285 sec, +/- 0%)     4268
    Bluebird      4,026,748 ops/sec (15 runs of 200 calls in 1.490 out of 2.248 sec, +/- 0%)     3725
    q-promise     8,709,066 ops/sec (16 runs of 400 calls in 1.470 out of 2.280 sec, +/- 0%)     8057

(run in isolation:)

    node          1,080,895 ops/sec (5 runs of 200 calls in 1.850 out of 2.395 sec, +/- 0%)      1000
    promise       7,577,721 ops/sec (15 runs of 400 calls in 1.584 out of 2.380 sec, +/- 0%)     1000
    Bluebird      4,275,405 ops/sec (16 runs of 200 calls in 1.497 out of 2.292 sec, +/- 0%)     1000
    q-promise    10,993,085 ops/sec (6 runs of 2k calls in 2.183 out of 2.773 sec, +/- 0%)       1000

$ node-v8.x test/benchmark.js

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=8.0.0-pre v8=5.7.492.69 arch=ia32 mhz=4519 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node          5,410,773 ops/sec (11 runs of 400 calls in 1.626 out of 2.315 sec, +/- 0%)     1000
    promise       6,253,187 ops/sec (13 runs of 400 calls in 1.663 out of 2.413 sec, +/- 0.01%)  1156
    rsvp          2,881,478 ops/sec (12 runs of 200 calls in 1.666 out of 2.351 sec, +/- 0%)      533
    Bluebird      2,100,870 ops/sec (9 runs of 200 calls in 1.714 out of 2.321 sec, +/- 0%)       388
    q-promise     8,418,502 ops/sec (16 runs of 400 calls in 1.520 out of 2.354 sec, +/- 0%)     1556

(run in isolation:)

    node          5,410,773 ops/sec (11 runs of 400 calls in 1.626 out of 2.315 sec, +/- 0%)     1000
    promise       6,653,383 ops/sec (13 runs of 400 calls in 1.563 out of 2.319 sec, +/- 0%)     1000
    Bluebird      2,176,288 ops/sec (10 runs of 200 calls in 1.838 out of 2.488 sec, +/- 0%)     1000
    q-promise    10,409,029 ops/sec (18 runs of 400 calls in 1.383 out of 2.290 sec, +/- 0%)     1000


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

## P.race( array )

Create a new promise that will take on the value of the first promise in the array
to be fulfilled or rejected.

## P.all( array )

Create a new promise that will wait for all promises in the array to be fulfilled,
and resolves with the array of their values in the same order as the promises.  If
any of the promises in the array reject, the returned promise will reject with the
same reason without waiting for the other promises to settle.

## promise.then( [resolveHandler [,rejectHandler]] )

Once the promise has been finalized (either fulfilled or rejected), call the
`resolveHandler` or `rejectHandler` function with the resolving value or rejection reason.
If the handler returns a value, the promise will resolve with that value.  If the
handler throws, the promise will reject with that error.  Non-function handlers are
ignored.

## promise.catch( rejectHandler )

If the promise is rejected, call the function `rejectHandler` with the reason.
This function is exactly equivalent to calling `promise.then(null, rejectHandler)`.


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
