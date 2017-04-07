q-promise
=========

Experimental bare-bones Promise/A1+ compatible nodejs promises libray.

Written as a an experiment to see how lean the implementation overhead could be
made to be, with moderately good success; see the Benchmarks below.

Functionality is minimal; this was not intended as a promises package, but
as a promises engine.


Api
===

## new P( executor(resolve, reject) )

Create a promise with the `executor` function.  The `P` constructor passes the
executor two callbacks, one to call if the promise is fulfilled, the other to call
if it is rejected.

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
