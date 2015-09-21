'use strict';
var Promise = require('bluebird');
var os = require('os');
var chalk = require('chalk');

function Smargs(def, testing) {
    if (!def.name)
        this.usage = process.argv[1];
    else
        this.usage = '';

    this.def = def;
    this.args = process.argv.slice(2);

    this.error = null;
    this.help = null;
    this.opts = {};
    this.depth = 0;
    this.additionalUsage = '';
    this.testing = testing;
}

Smargs.prototype.go = function() {
    var self = this;

    //check first argument
    return Promise
        .try(function () {
            return self.nextArgument(self.def);
        })
        .catch(function (err) {
            if (self.testing)
                throw err;

            if (err) {
                console.log(chalk.red('An Error Occurred'));
                if (err.stack)
                    console.error(err.stack);
                else
                    console.error(err);
            }
        })
        .then(function () {
            //if testing, don't print, just return

            if (!!self.error && !self.testing) {
                console.log(chalk.inverse('Usage:') + ' ' + self.usage + self.additionalUsage + ' [args]');
                console.log();
                console.log(self.help);
                console.log(chalk.red(self.error));
            }

            if (self.testing)
                return self.error;
        });
};

Smargs.prototype.nextArgument = function(def) {
    var self = this;

    if (!def.name)
        throw new Error('name is required');

    if (this.usage)
        this.usage += ' ' + def.name;
    else
        this.usage = def.name;

    if (!!def.commands && !!def.arguments)
        throw new Error('a command may not have child commands and arguments');

    var i, maxLength = 0, value;

    //process commands
    if (def.commands) {
        this.help = chalk.inverse('Commands:') + os.EOL;

        maxLength = 0;
        for (i = 0; i < def.commands.length; i++) {
            maxLength = Math.max(maxLength, def.commands[i].name.length);
        }
        maxLength += 5;

        value = this.args.length === 0 ? undefined : this.args[0];
        for (i = 0; i < def.commands.length; i++) {
            var command = def.commands[i];

            //command matched, so check next command line argument
            if (this.checkName(command, value)) {
                this.opts['command' + this.depth] = value;
                this.depth++;
                this.args.splice(0, 1);
                return this.nextArgument(command);
            }

            this.help += '  ' + command.name + (new Array(maxLength - command.name.length).join(' ') + chalk.green(command.help || '') + os.EOL);
        }

        this.additionalUsage = chalk.red(' <command>');
        this.error = 'You must specify a valid command';
    }

    return Promise.try(function() {
            //process arguments
            if (!def.arguments)
                return;

            self.help = chalk.inverse('Arguments:') + os.EOL;

            maxLength = 0;
            for (i = 0; i < def.arguments.length; i++) {
                var argument = def.arguments[i];
                maxLength = Math.max(maxLength, argument.name.length + (argument.required ? 0 : 2));
            }
            maxLength += 5;

            return Promise
                .each(def.arguments, function (argument) {
                    //required arguments
                    if (argument.required) {
                        self.help += '  <' + argument.name + '>' + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);

                        value = self.getArgumentValue(argument);

                        if (value === undefined) {
                            self.additionalUsage += chalk.red(' <' + argument.name + '>');
                            if (!self.error)
                                self.error = argument.name + ' is required';
                            return;
                        }

                        return Promise
                            .try(function () {
                                if (argument.validate)
                                    return argument.validate(value, self.opts);
                            })
                            .then(function (validateError) {
                                if (validateError) {
                                    if (!self.error)
                                        self.error = validateError;
                                    self.additionalUsage += chalk.red(' <' + argument.name + '>');
                                } else {
                                    self.additionalUsage += ' ' + value;
                                    self.opts[argument.name] = value;
                                }
                            });

                        //optional arguments
                    } else {
                        self.help += '  --' + argument.name + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);

                        value = self.getArgumentValue(argument);

                        return Promise
                            .try(function () {
                                if (value && argument.validate)
                                    return argument.validate(value, self.opts);
                            })
                            .then(function (validateError) {
                                if (validateError) {
                                    if (!self.error)
                                        self.error = validateError;
                                } else {
                                    self.opts[argument.name] = value;
                                }
                            });
                    }
                });
        })
        .then(function() {
            if (!self.error && !!def.action) {
                return Promise
                    .try(function () {
                        return def.action(self.opts)
                    })
                    .then(function(errorMessage) {
                        if (!self.error)
                            self.error = errorMessage;
                    });
            }
        });
};

Smargs.prototype.checkName = function(def, match) {
    if (match === def.name)
        return true;

    //check aliases
    if (def.alias) {
        if (Array.isArray(def.alias)) {
            for (var i = def.alias.length - 1; i >= 0; i--)
                if (match === def.alias[i])
                    return true;
        } else if (match === def.alias) {
            return true;
        }
    }

    return false;
};

Smargs.prototype.getArgumentValue = function(def) {
    var value;

    for (var i = 0; i < this.args.length; i++) {
        var arg = this.args[i];

        if (arg.substr(0, 2) === '--') { //is an optional arg
            if (def.required) //expected a required arg, so keep looking
                continue;

            var split = arg.substr(2).split('=');
            if (split.length !== 2)
                return undefined;

            if (split[0] === def.name) { //name matches what we're looking for
                value = split[1];
                this.args.splice(i, 1);
                break;
            }

        } else { //is a required arg
            if (!def.required)
                continue;

            value = arg;
            this.args.splice(i, 1);
            break;
        }
    }

    if (value === undefined && def.default)
        value = def.default;

    if (value === undefined)
        return undefined;

    switch (def.type) {
        case 'Number':
            return Number(value);
        case 'Boolean':
            return value.toLowerCase() !== 'false';
        case undefined:
        case 'String':
            return String(value);
        default:
            throw new Error('unknown type');
    }
};

module.exports = function (def, testing) {
    var smargs = new Smargs(def, testing);
    var p = smargs.go();
    if (smargs.testing)
        return p;
};