'use strict';

var qassert = require('qassert');
var P = require('../');

describe ('q-promise', function(){

    var p;

    beforeEach (function(done) {
        p = new P();
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
    })

    describe ('resolve', function(){
        it ('should return a resolved promise', function(done) {
            var p = P.resolve(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'y');
            qassert.equal(p.value, 123);
            done();
        })

        // TODO: this might not be spec, but seems useful
        it ('should resolve a function value', function(done) {
            var p = P.resolve(function(){ return 123 });
            process.nextTick(function(){
                qassert.equal(p.state, 'y');
                qassert.equal(p.value, 123);
                done();
            })
        })

        // TODO: 'should invoke __resolve'
    })

    describe ('reject', function(){
        it ('should return a rejected promise', function(done) {
            var p = P.reject(123);
            qassert(p instanceof P);
            qassert.equal(p.state, 'n');
            qassert.equal(p.value, 123);
            done();
        })

        // TODO: 'should invoke __resolve'
    })

    describe ('then', function(){
    })

    describe ('catch', function(){
    })

    describe ('helpers', function(){
        it ('should _resolve a promise', function(done) {
            // TODO: should call __resolve
            p._resolve(1234);
            qassert.equal(p.state, 'y');
            qassert.equal(p.value, 1234);
            done();
        })

        it ('should _reject a promise', function(done) {
            // TODO: should call __resolve
            p._reject(1234);
            qassert.equal(p.state, 'n');
            qassert.equal(p.value, 1234);
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
