'use strict';

var qassert = require('qassert');
var P = require('../');

describe ('q-promise', function(){

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
            qassert.equal(p.state, 'n', "wanted rejected");
            done();
        })

        it ('should call __resolve with return fulfillment value', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { resolve(123) });
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })

        it ('should call __resolve with rejection cause', function(done) {
            var called;
            P.onResolve(function(v, p, s) { called = [v, p, s] })
            var p = new P(function(resolve, reject) { reject(123) });
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
    })

    describe ('resolve', function(){
        it ('should return a fulfilled promise', function(done) {
            var p = P.resolve(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'y');
            qassert.equal(p.value, 123);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(1);
            qassert.deepEqual(called, [1, p, 'y']);
            done();
        })

        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.resolve(function(){ return 123 });
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })
    })

    describe ('reject', function(){
        it ('should return a rejected promise', function(done) {
            var p = P.reject(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'n');
            qassert.equal(p.value, 123);
            done();
        })

        it ('should call __resolve on a value', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(123);
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
        it ('should call __resolve on a function result', function(done) {
            var called;
            P.onResolve(function(v, p, s){ called = [v, p, s] });
            var p = P.reject(function(){ return 123 });
            qassert.deepEqual(called, [123, p, 'n']);
            done();
        })
    })

    describe ('then', function(){
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
        it ('should resolve a value', function(done) {
            done();
        })

        it ('should resolve an object', function(done) {
            done();
        })

        it ('should resolve a promise', function(done) {
            done();
        })
    })

    describe ('helpers', function(){
        it ('_resolve should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._resolve(123);
            qassert.deepEqual(called, [123, p, 'y']);
            done();
        })

        it ('_reject should call __resolve', function(done) {
            var called;
            P.onResolve(function(v, p, state) { called = [v, p, state] });
            p._reject(123);
            qassert.deepEqual(called, [123, p, 'n']);
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
