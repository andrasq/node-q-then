/**
 * Generic harness to test promises packages with the Promises/A+ test suite.
 *
 * Copyright (C) 2017 Andras Radics
 * Licensed under the Apache License, Version 2.0
 *
 * 2017-04-13 - AR.
 */

var P = require('../').Promise;
var tests = require('promises-aplus-tests');

var PP;

var _package = process.env.NODE_TEST;
if (_package == 'Promise') {
    // node built-in ES6 promises
    PP = Promise;
} else if (_package) {
    // the named package
    var pack = require(_package);
    PP = pack.Promise ? pack.Promise : pack;
} else {
    // default to P
    _package = 'P';
    PP = P;
}

console.log("AR: testing %s", process.env.NODE_TEST);

/*
 * generic promises/a+ compatible adapter to use the aplus valiation suite
 */
var adapter = {
    // return a resolved promise
    resolved: function(v) {
        return PP.resolve(v)
    },

    // return a rejected promise
    rejected: function(e) {
        return PP.reject(e)
    },

    // return a pending promise that can be either resolved or rejected
    deferred: function() {
        var yes, no;
        var p1 = new PP(function(y, n) {
            yes = y;
            no = n;
        });
        return {
            promise: p1,
            resolve: function(v) { return yes(v) },
            reject: function(e) { return no(e) },
        }
    }
};

tests(adapter, function(err) {
    // diagnostics to the console; err includes some info
})
