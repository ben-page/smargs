'use strict';
var assert = require('assert');
var smargs = require('../lib/main.js');

var validate1, validate2;

var reject = function() {
    assert(false);
};

var def = {
    name: 'app',
    commands: [
        {
            name: 'cmd1',
            aliases: ['stuff', 'thing'],
            help: 'do the first thing',
            arguments: [
                {
                    name: 'arg1',
                    help: 'data',
                    type: 'String'
                },
                {
                    name: 'arg2',
                    help: 'other data',
                    type: 'Number',
                    validate: function(value) {
                        if (value > 1000)
                            return 'arg2 must be less than 1000';
                    }
                },
                {
                    name: 'arg3',
                    help: 'other data',
                    type: 'Boolean'
                }
            ],
            action: function(opts) {
                return validate1(opts);
            }
        },
        {
            name: 'cmd2',
            help: 'do the first thing',
            arguments: [
                {
                    name: 'arg1',
                    help: 'data',
                    type: 'String',
                    required: true
                },
                {
                    name: 'arg2',
                    help: 'other data',
                    type: 'String'
                }
            ],
            action: function(opts) {
                return validate2(opts);
            }
        }
    ]
};

describe('', function () {
    it('missing command', function (done) {
        process.argv = [ null, null ];

        validate1 = function(opts) {
            assert(false);
        };
        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, 'You must specify a valid command');
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('command alias', function (done) {
        process.argv = [ null, null, 'thing' ];

        validate1 = function(opts) {
            assert(false);
        };
        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, 'You must specify a valid command');
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('optional arguments', function (done) {
        process.argv = [ null, null, 'cmd1', 'value1'];

        validate1 = function(opts) {
            assert.deepEqual(opts, {command0: 'cmd1', arg1: undefined, arg2: undefined, arg3: undefined});
        };

        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, null);
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('required arguments', function (done) {
        process.argv = [ null, null, 'cmd2', 'value1'];

        validate1 = function() {
            assert(false);
        };
        validate2 = function(opts) {
            assert.deepEqual(opts, {command0: 'cmd2', arg1: 'value1', arg2: undefined});
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, null);
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('missing required arguments', function (done) {
        process.argv = [ null, null, 'cmd2'];

        validate1 = function() {
            assert(false);
        };

        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, 'arg1 is required');
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('optional typed arguments', function (done) {
        process.argv = [ null, null, 'cmd1', '--arg1=string', '--arg2=123', '--arg3=false'];

        validate1 = function(opts) {
            assert.deepEqual(opts, { command0: 'cmd1', arg1: 'string', arg2: 123, arg3: false });
        };

        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, null);
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });

    it('validation', function (done) {
        process.argv = [ null, null, 'cmd1', '--arg1=string', '--arg2=12323', '--arg3=false'];

        validate1 = function() {
            assert(false);
        };

        validate2 = function() {
            assert(false);
        };

        smargs(def, true)
            .then(function(e) {
                assert.equal(e, 'arg2 must be less than 1000');
                done();
            })
            .catch(function(err) {
                done(err);
            });
    });
});

