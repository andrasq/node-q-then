q-promise
=========

Very fast bare-bones Promise/A+ compatible nodejs promises.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; the goal was not to be a full package, but
to implement a fast promises engine.


Benchmark
=========

Resolve the promise

    Promise.resolve('foo')
        .then(function(s){ return Promise.resolve(s + 'bar') })
        .then(function(s) { return Promise.resolve(s + 'baz')});

`$ node-v6.7.0 test/benchmark.js`

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=6.7.0 v8=5.1.281.83 arch=ia32 mhz=4522 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node  101,806 ops/sec (1 runs of 4 calls in 3.929 out of 20.570 sec, +/- 0%) 1000
    Bluebird  949,934 ops/sec (8 runs of 4 calls in 3.369 out of 6.993 sec, +/- 0%) 9331
    q-promise  3,093,791 ops/sec (22 runs of 4 calls in 2.844 out of 5.606 sec, +/- 0%) 30389

`$ node-v8.x test/benchmark.js`

    qtimeit=0.16.1 platform=linux kernel=3.16.0-4-amd64 cpuCount=8
    node=8.0.0-pre v8=5.7.492.69 arch=ia32 mhz=4521 cpu="Intel(R) Core(TM) i7-6700K CPU @ 4.00GHz" up_threshold=11
    name  speed  (stats)  rate
    node  867,260 ops/sec (7 runs of 4 calls in 3.229 out of 6.946 sec, +/- 0%) 1000
    Bluebird  611,552 ops/sec (5 runs of 4 calls in 3.270 out of 7.661 sec, +/- 0%) 705
    q-promise  3,068,936 ops/sec (21 runs of 4 calls in 2.737 out of 5.838 sec, +/- 0%) 3539


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

TBD

Make the promise take on the value of the first promise in the array to be
fulfilled or rejected.

## promise.all( array )

TBD

Make the promise wait for all promises in the array to be fulfilled or rejected.


Resources
=========

- [MDN Promise](https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Promise) - javascript Promise writeup
- [Promises/A+](https://promisesaplus.com/) - javascript promises interoperability spec

Related Work
============

- [`q-promise`](https://github.com/andrasq/node-q-promise) - very fast promises engine
- [`bluebird`](https://npmjs.com/package/bluebird) - fast promises package
- [`promise`](https://npmjs.com/package/promise) - promises package
- [`rsvp`](https://npmjs.com/package/rsvp) - promises package
- [`qinvoke`](https://npmjs.com/package/qinvoke) - fast call interception and re-invocation
- [`qtimeit`](https://npmjs.com/package/qtimeit) - accurate nodejs call timings
