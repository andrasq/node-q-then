/**
 * q-then -- very fast promises engine
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 */

'use strict';

var qassert = require('qassert');
var P = require('../').Promise;

var _PENDING = P._PENDING;
var _RESOLVING = P._RESOLVING;
var _RESOLVED = P._RESOLVED;
var _REJECTED = P._REJECTED;

qassert.isPending = function(p) {
    //p.then(function(v) { qassert.ok(1) }, function(e) { qassert.fail() });
    qassert.equal(p.state, _PENDING);
}
qassert.isRejectedWith = function(v, p) {
    //p.then(function(v) { qassert.fail() }, function(e) { qassert.equal(e, v) });
    qassert.equal(p.state, _REJECTED);
    qassert.deepEqual(p.value, v);
}
qassert.isResolvedWith = function(v, p) {
    //p.then(function(v2) { qassert.equal(v2, v) }, function(e) { qassert.fail });
    qassert.equal(p.state, _RESOLVED);
    qassert.deepEqual(p.value, v);
}

// a promise that asynchronously resolves to x
function _async( x, yesno, ms ) {
    return new P(function(y, n) {
        var fn = (yesno == 'n' || !yesno) ? n : y; 
        ms >= 0 ? setTimeout(fn, ms, x) : setImmediate(fn, x);
    });
}

function _asyncThenable( x, yesno, ms ) {
    return {
        then: function(y, n) {
            var fn = (yesno == 'n' || !yesno) ? n : y; 
            ms >= 0 ? setTimeout(y, ms, x) : setImmediate(y, x);
        }
    };
}

describe ('q-then', function(){

    var p;

    beforeEach (function(done) {
        p = new P();
        done();
    })

    afterEach (function(done) {
        P.onResolve(false);
        done();
    })

    describe ('constructor', function(){
        it ('executor should be optional', function(done) {
            var p = new P();
            qassert.ok(p instanceof P);
            done();
        })

        it ('initial state should be pending', function(done) {
            qassert.ok(!p.state);
            done();
        })

        it ('should immediately call executor', function(done) {
            new P(function(resolve, reject) {
                qassert.contains(new Error().stack, __filename);
                done();
            })
        })

        it ('should remain unresolved if executor returns a promise', function(done) {
            var p = new P(function(resolve) { resolve(new P()) });
            qassert(!p.state);
            done();
        })

        it ('should reject if executor throws', function(done) {
            var p = new P(function(resolve) { throw new Error("executor error") }); 
            qassert.equal(p.state, _REJECTED, "wanted rejected");
            done();
        })

        it ('should call __resolve with return fulfillment value', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { resolve(123) });
            qassert.deepEqual(called, [123, p, _RESOLVED]);
            done();
        })

        it ('should call __resolve with rejection cause', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { reject(123) });
            qassert.deepEqual(called, [123, p, _REJECTED]);
            done();
        })

        it ('should resolve with first result', function(done) {
            var err = new Error("die");

            var p = new P(function(y, n){ y(1); n(2); throw err; });
            qassert.equal(p.state, _RESOLVED);
            qassert.equal(p.value, 1);

            var p = new P(function(y, n){ n(2); y(1); throw err; });
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, 2);

            var p = new P(function(y, n){ throw err; y(1); n(2); });
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, err);

            done();
        })
    })

    describe ('resolve', function(){
        it ('should return a fulfilled promise', function(done) {
            var p = P.resolve(123);
            qassert(p instanceof P);
            qassert.equal(p.state, _RESOLVED);
            qassert.equal(p.value, 123);
            done();
        })

        it ('should resolve with function return value', function(done) {
            var p = P.resolve(function(){ return 123 });
            qassert.equal(p.state, _RESOLVED);
            qassert.equal(p.value, 123);
            done();
        })

        it ('should reject if function throws', function(done) {
            var err = new Error("die");
            var p = P.resolve(function(){ throw err });
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, err);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(1);
            qassert.deepEqual(called, [1, p, _RESOLVED]);
            done();
        })

        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(function(){ return 123 });
            qassert.deepEqual(called, [123, p, _RESOLVED]);
            done();
        })
    })

    describe ('reject', function(){
        it ('should return a rejected promise', function(done) {
            var p = P.reject(123);
            qassert(p instanceof P);
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, 123);
            done();
        })

        it ('should reject with function return value', function(done) {
            var p = P.reject(function(){ return 123 });
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, 123);
            done();
        })

        it ('should reject if function throws', function(done) {
            var err = new Error("die2");
            var p = P.reject(function(){ throw err });
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value, err);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(123);
            qassert.deepEqual(called, [123, p, _REJECTED]);
            done();
        })
        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(function(){ return 123 });
            qassert.deepEqual(called, [123, p, _REJECTED]);
            done();
        })
    })

    describe ('race', function(){
        it ('should resolve with the first value resolved', function(done) {
            var p2 = new P(function(y,n){ setTimeout(y, 5, 2) });
            var p3 = new P(function(y,n){ setTimeout(y, 7, 3) });
            var p1 = new P(function(y,n){ setTimeout(y, 3, 1) });
            var p = P.race([p1, p2, p3]);
            p.then(function(v) {
                qassert.equal(v, 1);
                qassert.isResolvedWith(1, p1);
                qassert.isPending(p2);
                qassert.isPending(p3);
                done();
            }, function(e){ done(e) })
            .catch(function(e){ done(e) });
        })

        it ('should resolve with the first thenable resolved', function(done) {
            var p1 = { then: function(y,n){ setTimeout(y, 5, 1) } };
            var p2 = { then: function(y,n){ setTimeout(y, 7, 2) } };
            var p3 = new P(function(y,n){ setTimeout(y, 9, 3) });
            var p = P.race([p1, p2, p3]);
            p.then(function(v) {
                qassert.equal(v, 1);
                done();
            }, function(e) { done(e) })
            .catch(function(e){ done(e) });
        })

        it ('should reject if first promise to settle rejects', function(done) {
            var p2 = new P(function(y,n){ setTimeout(y, 5, 2) });
            var p3 = new P(function(y,n){ setTimeout(n, 3, 3) });
            var p = P.race([p2, p3]);
            p.then(function(v){ qassert.fail() }, function(e) {
                qassert.equal(e, 3);
                qassert.isRejectedWith(3, p3);
                qassert.isPending(p2);
                done();
            })
        })

        it ('should reject if a thenable throws getting the then method', function(done) {
            var thenable = { };
            Object.defineProperty(thenable, 'then', { get: function(){ throw 123 } });
            P.race([ thenable ]).then(
                function(v) { done("test failed") },
                function(e) { qassert.equal(e, 123); done() }
            );
        })

        it ('should reject if one of the promises is not a thenable', function(done) {
            var p = P.race([P.resolve(1), 2]);
            qassert.equal(p.state, _REJECTED);
            done();
        })
    })

    describe ('all', function(){
        it ('empty promises list should resolve immediately', function(done) {
            var p = P.all([]);
            qassert.isResolvedWith([], p);
            done();
        })

        it ('should wait for all promises', function(done) {
            var p1 = new P(function(y,n){ setTimeout(y, 3, 1) });
            var p2 = new P(function(y,n){ setTimeout(y, 5, 2) });
            var p3 = new P(function(y,n){ setTimeout(y, 7, 3) });
            var p = P.all([p1, p2, p3]);
            p.then(function(v) {
                qassert.deepEqual(v, [1, 2, 3]);
                qassert.isResolvedWith(1, p1);
                qassert.isResolvedWith(2, p2);
                qassert.isResolvedWith(3, p3);
                done();
            })
        })

        it ('should reject if any promise rejects', function(done) {
            var p1 = new P(function(y,n){ setTimeout(y, 3, 1) });
            var p2 = new P(function(y,n){ setTimeout(n, 5, 2) });
            var p3 = new P(function(y,n){ setTimeout(y, 7, 3) });
            var p = P.all([p1, p2, p3]);
            p.then(null, function(v) {
                qassert.equal(v, 2);
                qassert.isResolvedWith(1, p1);
                qassert.isRejectedWith(2, p2);
                qassert.isPending(p3);
                done();
            })
        })

        it ('should reject if one of the promises is not a thenable', function(done) {
            var p = P.all([P.resolve(1), 2]);
            qassert.equal(p.state, _REJECTED);
            done();
        })

        it ('should reject if one of the promises throws', function(done) {
            var p1 = P.resolve(1);
            var p2 = new P(function(y,n){ throw 2 });
            var p = P.all([p1, p2]);
            p.then(null, function(v) {
                qassert.equal(v, 2);
                qassert.isResolvedWith(1, p1);
                qassert.isRejectedWith(2, p2);
                done();
            })
        })

        it ('should reject if a thenable throws', function(done) {
            var p = P.all([ P.resolve(1), { then: function(y, n) { throw 2 } } ]);
            p.then(function(v) {
                done("test failed, did not reject");
            }, function(e) {
                qassert.equal(e, 2);
                done();
            })
        })

        it ('should reject if a thenable throws getting the then method', function(done) {
            var thenable = { };
            Object.defineProperty(thenable, 'then', { get: function(){ throw 123 } });
            P.all([ thenable ]).then(
                function(v) { done("test failed") },
                function(e) { qassert.equal(e, 123); done() }
            );
        })
    })

    describe ('then', function(){
        var dataset = [
            0,
            false,
            null,
            undefined,
            123,
            "foo",
            new Date("2001-01-01T00:00:00.000Z"),
            /foobar/i,
            {a:1},
            [1,3,5],
            {test:1},
        ];

        function testDatasetEventuallyResolved( dataset, verifyCb, done ) {
            var i = 0, v;
            forEachParallel(
                dataset,
                function(v, i, next) {
                    var p = new P(function(y,n){ setTimeout(y, 5, v) });
                    var p2 = p.then();                                  // from promise
                    var p3 = p.then(function(){ return v });            // from resolveHandler
                    var p4 = p.then(null, function(){ return v });      // from rejectHandler
                    var p5 = p.then(function(){ return P.resolve(v) });                                 // from already resolved promise
                    var p6 = p.then(function(){ return new P(function(y,n){ setTimeout(y, 5, v) }) });  // from eventually resolved promise
                    setTimeout(function() {
                        verifyCb(p, i);
                        verifyCb(p2, i);
                        verifyCb(p3, i);
                        verifyCb(p4, i);
                        verifyCb(p5, i);
                        verifyCb(p6, i);
                        next();
                    }, 30);
                    // TODO: 20 ms not enough, occasionally not resolved yet (?!)
                    // FIXME: should all resolve in 5 ms!
                },
                done
            );
        }

        it ('should return a new promise', function(done) {
            var p2 = p.then();
            qassert.equal(p2.constructor, p.constructor);
            done();
        })

        it ('should settle with resolved value', function(done) {
            p._resolve(123);
            var p2 = p.then();
            qassert.equal(p2.value, 123);
            qassert.equal(p2.state, _RESOLVED);
            done();
        })

        it ('should settle with rejected cause', function(done) {
            p._reject(123);
            var p2 = p.then();
            qassert.equal(p2.value, 123);
            qassert.equal(p2.state, _REJECTED);
            done();
        })

        it ('should report value to then-resolve', function(done) {
            p._resolve(123);
            var p2 = p.then(resolve, reject);
            function resolve(v) {
                setImmediate(function(){
                    qassert.equal(v, 123);
                    qassert.equal(p2.state, _RESOLVED);
                    done();
                })
                // resolveHandler must return the value we want to resolve with,
                // else the then() will resolve with undefined.
                return v;
            }
            function reject(e) {
                qassert.fail();
            }
        })

        it ('should report cause to then-reject', function(done) {
            p._reject(123);
            var p2 = p.then(resolve, reject);
            function resolve(v) {
                qassert.fail();
            }
            function reject(e) {
                setImmediate(function(){
                    qassert.equal(p2.state, _REJECTED);
                    qassert.equal(p2.value, 123);
                    done();
                })
                // the way to reject from a rejectHandler is to throw;
                // else the promise would resolve with the return value, even if undefined
                throw e;
            }
        })

        it ('should take state from eventually resolved promise', function(done) {
            testDatasetEventuallyResolved(dataset, checkValue, done);
            function checkValue( p, i ) {
                qassert.equal(p.state, _RESOLVED);
                qassert.equal(p.value, dataset[i]);
            }
        })

        it ('should eventually resolve from resolveHandler', function(done) {
            var thenfunc = function(){};
            thenfunc.then = function(y,n){ setTimeout(y, 10, 77) };
            var dataset = [
                77,
                {a:77},
                new P(function(y,n){ setTimeout(y, 10, 77) }),
                {then: function(y,n){ setTimeout(y, 10, 77) }},
                thenfunc,
            ];

            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = (function(i, val) {
                return new P(function(y,n){ setTimeout(y, 5, val) }).then(function(v2){
                    qassert.ok(v2 == 77 || v2.a == 77);
                    return 88;
                });
            })(i, dataset[i]);

            setTimeout(function(){
                forEachParallel(ds, function(v, i, next) {
                    qassert.equal(ds[i].state, _RESOLVED);
                    qassert.equal(ds[i].value, 88);
                    next();
                }, function(err) {
                    done();
                });
            }, 20);
            // note: it can take 10ms for values to propagate?!
        })

        it ('should reject if resolve throws', function(done) {
            var err = new Error("resolve error");
            var p2 = p.then(function(v) { throw err });
            p._resolve(1);
            setImmediate(function(){
                qassert.equal(p2.state, _REJECTED);
                qassert.equal(p2.value, err);
                done();
            })
        })

        it ('should reject if reject throws', function(done) {
            var err = new Error("reject error");
            var p2 = p.then(null, function(e) { throw err });
            p._reject(1);
            setImmediate(function(){
                qassert.equal(p2.state, _REJECTED);
                qassert.contains(p2.value, err);
                done();
            })
        })

        it ('should reject if getting then method throws', function(done) {
            var err = new Error("then access error");
            var thenable = { };
            // ES5 "get then() { ... }" syntax expressed in node v0.10 compatible way
            Object.defineProperty(thenable, 'then', { get: function(){ throw err } });
            var p2 = p._resolve(thenable);
            qassert.equal(p2, p);
            qassert.isRejectedWith(err, p2);
            done();
        })

        it ('should call resolve without this from system stack', function(done) {
            (function localStackMarker() {
                var called;
                var p2 = p.then(function(v) {
                    qassert.equal(v, 1234);
                    qassert.equal(this, null);
                    qassert.ok(new Error().stack.indexOf('localStackMarker') < 0);
                    done();
                })
                p._resolve(1234);
            })();
        })

        it ('should call reject without this from system stack', function(done) {
            (function localStackMarker() {
                var called;
                var p2 = p.then(null, function(v) {
                    qassert.equal(v, 1234);
                    qassert.equal(this, null);
                    qassert.ok(new Error().stack.indexOf('localStackMarker') < 0);
                    done();
                })
                p._reject(1234);
            })();
        })

        it ('should notify with fulfilled value', function(done) {
            var called;
            p.then(function(v) { called = v });
            p._resolve(123);
            setImmediate(function() {
                qassert.equal(called, 123);
                done();
            })
        })

        it ('should notify with rejected cause', function(done) {
            var called;
            p.then(null, function(e) { called = e });
            p._reject(123);
            setImmediate(function() {
                qassert.equal(called, 123);
                done();
            })
        })

        it ('should ignore non-function listeners and settle with reject cause', function(done) {
            p.then("one", "two");
            p._reject(123);
            setImmediate(function() {
                qassert.isRejectedWith(123, p);
                done();
            })
        })

        it ('should resolve with value if no then resolve function', function(done) {
            // test with one listener to check single-listener handling; two below
            var p2 = p.then(null, function(e){});
            p._resolve(123);
            setImmediate(function() {
                qassert.equal(p2.state, _RESOLVED);
                qassert.equal(p2.value, 123);
                done();
            })
        })

        it ('should reject with value if no then reject function', function(done) {
            // test with two listeners to check multi-listener handling; one above
            var p2 = p.then(function(e){}, 2);
            var p3 = p.then(function(e){}, 2);
            p._reject(123);
            setImmediate(function() {
                qassert.equal(p2.state, _REJECTED);
                qassert.equal(p2.value, 123);
                qassert.equal(p3.state, _REJECTED);
                qassert.equal(p3.value, 123);
                done();
            })
        })

        it ('should notify multiple resolves, in order', function(done) {
            var calls = [];
            var p2 = p.then(function(v){ v = 1; calls.push(v); return v });
            var p3 = p.then(function(v){ v = 2; calls.push(v); return v });
            var p4 = p.then(function(v){ v = 3; calls.push(v); return v });
            p._resolve(123);
            setImmediate(function(){
                qassert.deepEqual(calls, [1, 2, 3]);
                qassert.equal(p2.state, _RESOLVED);
                qassert.equal(p2.value, 1);
                qassert.equal(p3.state, _RESOLVED);
                qassert.equal(p3.value, 2);
                qassert.equal(p4.state, _RESOLVED);
                qassert.equal(p4.value, 3);
                done();
            });
        })

        it ('should notify multiple rejects, in order', function(done) {
            var calls = [];
            var p2 = p.then(null, function(v){ v = 1; calls.push(v); return v });
            var p3 = p.then(null, function(v){ v = 2; calls.push(v); return v });
            var p4 = p.then(null, function(v){ v = 3; calls.push(v); return v });
            var p5 = p.then();
            p._reject(123);
            setImmediate(function(){
                qassert.deepEqual(calls, [1, 2, 3]);
                // if then-reject() returns a value, settle the promise with it
                qassert.equal(p2.state, _RESOLVED);
                qassert.equal(p2.value, 1);
                qassert.equal(p3.state, _RESOLVED);
                qassert.equal(p3.value, 2);
                qassert.equal(p4.state, _RESOLVED);
                qassert.equal(p4.value, 3);
                // if no then-reject function, reject the promise with p1.value
                qassert.equal(p5.state, _REJECTED);
                qassert.equal(p5.value, 123);
                done();
            });
        })

        it ('should ignore errors thrown in a thenable then callback after it fulfillled', function(done) {
            var thenable = { then: function(y,n) { y(_async(1, 'y', 5)); throw "then err after return" } };
            var p1 = new P(function(y,n) { y(thenable) });
            p1.then(function(v) {
                qassert.equal(v, 1);
                done();
            },function(e) { done(e) })
            .catch(function(e) { done(e) });
        })
    })

    describe ('catch', function(){
        it ('should call then', function(done) {
            var called;
            var handler = function(){};
            p.then = function(resolve, reject) { called = [resolve, reject] };
            p.catch(handler);
            qassert.deepEqual(called, [undefined, handler]);
            done();
        })
    })

    describe ('__resolve', function(){
        var dataset = [
            0,
            false,
            null,
            undefined,
            123,
            "foo",
            new Date("2001-01-01T00:00:00.000Z"),
            /foobar/i,
            {a:1},
            [1,3,5],
            {test:1},
        ];

        function testDataset( dataset, verifyCb, done ) {
            var i = 0, v;
            forEachParallel(
                dataset,
                function(v, i, next) {
                    var p = P.resolve(v);
                    setImmediate(function() {
                        verifyCb(p, i);
                        next();
                    });
                },
                done
            );
        }

        it ('should not resolve a fulfilled promise', function(done) {
            p._resolve(1);
            p._resolve(2);
            qassert.equal(p.value, 1);
            done();
        })

        it ('should not resolve a rejected promise', function(done) {
            p._reject(1);
            p._reject(2);
            qassert.equal(p.value, 1);
            done();
        })

        it ('should not resolve an already resolved promise with a settled promise', function(done) {
            var p1 = _async(1, 'y');
            var p2 = P.resolve(2);
            p._resolve(p1);
            p._resolve(p2);
            p.then(function(v) {
                qassert.equal(v, 1);
                done();
            }).catch(function(e) {
                done(e || "test failed");
            });
        })

        it ('should resolve if thenable eventually resolves', function(done) {
            // returns a thenable that returns a thenable that returns a thenable that returns 123
            var thenable = {
                then: function(y, n) { setTimeout(y, 5, {
                    then: function(y, n) { setTimeout(y, 5, {
                        then: function(y, n) { setTimeout(y, 5, 123) }
                    }) }
                }) }
            };
            var p = new P();
            p._resolve(thenable);
            p.then(function(v){
                qassert.equal(v, 123);
                qassert.isResolvedWith(123, p);
                done();
            }, function(e){ qassert.fail})
        })

        it ('should reject if thenable rejects', function(done) {
            var thenable = { then: function(y, n) {
                setTimeout(n, 5, 123);
            }};
            var p = new P();
            p._resolve(thenable);
            p.then(function(v){ qassert.fail() }, function(e){
                qassert.equal(e, 123);
                qassert.isRejectedWith(123, p);
                done();
            })
        })

        it ('should reject if a thenable throws', function(done) {
            var thenable = { then: function(){ throw new Error("die") } };
            var p = P.resolve(thenable);
            qassert.equal(p.state, _REJECTED);
            qassert.equal(p.value.message, "die");
            done();
        })

        it ('should reject if resolving with self', function(done) {
            var p = new P();
            p._resolve(p);
            qassert.equal(p.state, _REJECTED);
            qassert.contains(p.value.message, "cannot resolve");
            qassert.contains(p.value.message, "with itself");
            done();
        })

        it ('should reject if a thenable function throws', function(done) {
            var err = new Error('die');
            var err2 = new Error('die2');
            var p2 = p.then(function(){ throw err });
            // chain p3 to p2, when p2 rejects p3 will also
            var p3 = p2.then(null, function(){ throw err2 });
            p._resolve(1);
            setTimeout(function() {
                qassert.equal(p2.state, _REJECTED);
                qassert.equal(p2.value, err);
                qassert.equal(p3.state, _REJECTED);
                qassert.equal(p3.value, err2);
                done();
            }, 2)
        })

        it ('should resolve values', function(done) {
            testDataset(dataset, function(p, i) {
                qassert.equal(p.state, _RESOLVED);
                qassert.equal(p.value, dataset[i]);
            }, done);
        })

        it ('should resolve settled promises', function(done) {
            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = P.resolve(dataset[i]);
            testDataset(ds, function(p, i) {
                qassert.equal(p.state, _RESOLVED);
                qassert.equal(p.value, ds[i].value);
            }, done);
        })

        it ('should resolve pending promises that are eventually fulfilled', function(done) {
            var ds = [];
            for (var i=0; i<dataset.length; i++) ds[i] = (function(v){
                return new P(function(resolve, reject) {
                    setTimeout(resolve, 5, v);
                })
            })(dataset[i]);
            testDataset(ds, function(p, i) {
                qassert.ok(!ds[i].state);
                qassert.ok(!p.state);
            },
            function(err) {
                if (err) return done(err);
                setTimeout(function() {
                    testDataset(ds, function(p, i) {
                        qassert.equal(ds[i].state, _RESOLVED);
                        qassert.equal(ds[i].value, dataset[i]);
                        qassert.equal(p.state, _RESOLVED);
                        qassert.equal(p.value, ds[i].value);
                    }, done);
                }, 10);
            });
        })

        it ('should reject pending promises that are eventually rejected with a promise', function(done) {
            var ds = [];
            var ps = [];
            // the dataset is promises that will eventually reject with a resolved promise
            for (var i=0; i<dataset.length; i++) {
                ps[i] = P.resolve(dataset[i]);
                ds[i] = (function(i){ return _async(ps[i], 'n', 5) })(i);
            }
            // while the dataset is pending, promises resolved with them are also pending
            testDataset(ds, function(p, i) {
                qassert.ok(!ds[i].state);
                qassert.ok(!p.state);
            },
            // once resolved, promises resolved with them will take on the reject value
            function(err) {
                if (err) return done(err);
                setTimeout(function() {
                    testDataset(ds, function(p, i) {
                        // ds[i] will have been rejected with ps[i]
                        qassert.isRejectedWith(ps[i], ds[i]);
                        // p that was fulfilled with ds[i] will have taken on its state and value
                        qassert.isRejectedWith(ps[i], p);
                    }, done);
                }, 10);
            });
        })

        it ('should take state from a promise that eventually fulfills with undefined', function(done) {
            var p = new P(function(y,n){ setTimeout(y, 5, undefined) })
            var p2 = p.then();
            setTimeout(function(){
                qassert.equal(p.state, _RESOLVED);
                qassert.strictEqual(p.value, undefined);
                done();
            }, 10);
        })

        it ('should resolve with first executor to return', function(done) {
            var p1 = _async(1, 'y', 10);
            var p2 = _async(2, 'n', 2);
            var t1 = Date.now();
            // executor resolves after 1ms with an eventual promise that will resolve
            var p = new P(function(y, n) { setTimeout(y, 1, p1); setTimeout(n, 3, p2) });
            p.then(function(v) {
                var t2 = Date.now();
                qassert.equal(v, 1);
                qassert.ok(t2 - t1 >= 10-1);
                done();
            }, function(e) { done(e) })
            .catch(function(e) { done(e) });
        })

        it ('should reject with first executor to return', function(done) {
            var p1 = _async(1, 'n', 10);
            var p2 = _async(2, 'n', 2);
            var t1 = Date.now();
            // executor resolves after 1ms with an eventual promise that will reject
            var p = new P(function(y, n) { setTimeout(y, 1, p1); setTimeout(n, 3, p2) });
            p.then(function(v) { done(v) },
            function(e) {
                var t2 = Date.now();
                qassert.equal(e, 1);
                qassert.ok(t2 - t1 >= 10-1);
                done();
            })
            .catch(function(e) { done(e) });
        })

        it ('should reject immediately if executor rejects', function(done) {
            var p1 = _async(1, 'y', 2);
            var p2 = _async(2, 'y', 10);
            var t1 = Date.now();
            // executor rejects after 1ms with an eventual promise that will resolve
            var p = new P(function(y, n) { setTimeout(y, 3, p1); setTimeout(n, 1, p2) });
            p.then(function(v) { done(v) },
            function(e) {
                var t2 = Date.now();
                qassert.ok(t2 - t1 <= 1+1, "did not reject immediately");
                qassert.equal(e, p2, "did not reject with promise object");
                done();
            })
            .catch(function(e) { done(e) });
        })

        it ('should ignore error thrown after resolve', function(done) {
            var t1 = Date.now();
            var p = new P(function(y, n) { y(_async(123, 'y', 10)); throw 77 });
            p.then(function(v) {
                var t2 = Date.now();
                qassert.equal(v, 123);
                qassert.ok(t2 - t1 >= 10-1);
                done();
            }, function(e) { done(e) })
            .catch(function(e) { done(e) });
        })

        it ('should ignore error thrown after reject', function(done) {
            var t1 = Date.now();
            var p = new P(function(y, n) { y(_async(123, 'n', 10)); throw 77 });
            p.then(function(v) { done("fail") },
            function(e) {
                var t2 = Date.now();
                qassert.equal(e, 123);
                qassert.ok(t2 - t1 >= 10-1);
                done();
            })
            .catch(function(e) { done(e) });
        })

        it ('should resolve a value returned by a then resolve', function(done) {
            var thenable = { then: function(y, n) { y(_async(123, 'y')) } };
            var p = new P(function(y,n){ y(thenable) });
            p.then(function(v) {
                qassert.equal(v, 123);
                done();
            }, function(e) {
                done(e || "test failed");
            });
        })

        it ('should resolve a thenable returned by a then resolve', function(done) {
            var thenable2 = { then: function(y, n) { y(_async(123, 'y')) } };
            var thenable1 = { then: function(y, n) { y(thenable2) } };
            var p = new P(function(y,n){ y(thenable1) });
            p.then(function(v){
                qassert.equal(v, 123);
                done();
            }, function(e) {
                done(e || "test failed");
            })
            .catch(function(e){ done(e) });
        })

        it ('should ignore a reject or resolve or errors from a thenable that already resolved', function(done) {
            var thenable = { then: function(y, n) { y(1); n(2); y(3); n(4); throw new Error("thenable error") } };
            p._resolve(thenable).then(function(v){
                qassert.equal(v, 1);
                done();
            }, function(e) {
                done(e || "test failed");
            });
        })
    })

    describe ('helpers', function(){
        it ('_resolve should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._resolve(123);
            qassert.deepEqual(called, [123, p, _RESOLVED]);
            done();
        })

        it ('_reject should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._reject(123);
            qassert.deepEqual(called, [123, p, _REJECTED]);
            done();
        })
    })

    describe ('promisify', function(){
        it ('should promisify a function taking a callback', function(done) {
            var funcCb = function(a,b,cb) { cb(null, this.z + a + b) };
            var funcP = P.promisify(funcCb);
            var obj = { z: 11, funcP: funcP };
            obj.funcP(22, 33).then(
                function(v){ qassert.equal(v, 66); done() },
                function(e){ done(new Error("test fail")) }
            )
            .catch(function(e){ done(e) });
        })

        it ('should promisify returned errors', function(done) {
            var funcCb = function(cb){ cb(new Error("deliberate error")) };
            var funcP = P.promisify(funcCb);
            funcP().then(
                function(v){ throw new Error("test fail") },
                function(e){ qassert.equal(e.message, "deliberate error"); done() }
            )
            .catch(function(e){ done(e) });
        })

        it ('should promisify thrown errors', function(done) {
            var funcCb = function(cb){ throw new Error("deliberate error") };
            var funcP = P.promisify(funcCb);
            funcP().then(
                function(v){ throw new Error("test fail") },
                function(e){ qassert.equal(e.message, "deliberate error"); done() }
            )
            .catch(function(e){ done(e) });
        })

        it ('should promisify with the given Promise library', function(done) {
            var called = false;
            function MockPromise( executor ) { called = executor; }
            var funcP = P.promisify(function(){}, MockPromise);
            funcP();
            qassert.equal(typeof called, 'function');
            qassert.equal(called.name, 'executor');
            qassert.equal(called.length, 2);
            done();
        })
    })
})


function testResolvesDataset( tester, cb ) {
    var dataset = [
    ];
    for (var i=0; i<dataset.length; i++) {
        var p = tester(dataset[i]);
        
    }
    if (cb) cb();
}

function repeatWhile( test, loop, cb ) {
    if (!test()) return cb();

    loop(function(err) {
        if (err) return cb(err);
        setImmediate(function(){
            repeatWhile(test, loop, cb)
        });
    });
}

function forEachParallel( list, visitor, cb ) {
    var ndone = 0;
    var finished = false;

    for (var i=0; i<list.length; i++) doVisit(list[i], i);

    function doVisit(v, i) {
        visitor(v, i, function(err) {
            ndone += 1;
            if ((err || ndone === list.length) && !finished) {
                finished = true;
                cb(err);
            }
        });
    }
}
