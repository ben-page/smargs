'use strict';
const Promise = require('bluebird');
const os = require('os');
const chalk = require('chalk');

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

Smargs.prototype.go = function () {
    //check first argument
    return Promise
        .try(() => {
            return this.nextArgument(this.def);
        })
        .catch(err => {
            if (this.testing)
                throw err;
            
            if (err) {
                console.log(chalk.red('An Error Occurred'));
                if (err.stack)
                    console.error(err.stack);
                else
                    console.error(err);
            }
        })
        .then(() => {
            //if testing, don't print, just return
            if (!!this.error && !this.testing) {
                console.log(chalk.inverse('Usage:') + ' ' + this.usage + this.additionalUsage + ' [args]');
                console.log();
                console.log(this.help);
                console.log(chalk.red(this.error));
            }
            
            if (this.testing)
                return this.error;
            
            return undefined;
        });
};

Smargs.prototype.nextArgument = function (def) {
    if (!def.name)
        throw new Error('name is required');
    
    if (this.usage)
        this.usage += ' ' + def.name;
    else
        this.usage = def.name;
    
    if (!!def.commands && !!def.arguments)
        throw new Error('a command may not have child commands and arguments');
    
    let maxLength = 0;
    
    //process commands
    if (def.commands) {
        this.help = chalk.inverse('Commands:') + os.EOL;
        
        maxLength = 0;
        for (let i = 0; i < def.commands.length; i++)
            maxLength = Math.max(maxLength, def.commands[i].name.length);
        
        maxLength += 5;
        
        const value = this.args.length === 0 ? undefined : this.args[0];
        for (let i = 0; i < def.commands.length; i++) {
            const command = def.commands[i];
            
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
    
    return Promise
        .try(() => {
            //process arguments
            if (!def.arguments)
                return undefined;
            
            this.help = chalk.inverse('Arguments:') + os.EOL;
            
            maxLength = 0;
            for (let i = 0; i < def.arguments.length; i++) {
                const argument = def.arguments[i];
                maxLength = Math.max(maxLength, argument.name.length + (argument.required ? 0 : 2));
            }
            maxLength += 5;
            
            return Promise
                .each(def.arguments, argument => {
                    //required arguments
                    if (argument.required) {
                        this.help += '  <' + argument.name + '>' + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);
                        
                        let value;
                        if (this.args.length > 0) {
                            value = convertType(argument, this.args[0]);
                            this.args.splice(0, 1);
                        }
                        
                        if (value === undefined) {
                            this.additionalUsage += chalk.red(' <' + argument.name + '>');
                            if (!this.error)
                                this.error = argument.name + ' is required';
                            return;
                        }
                        
                        if (argument.validate) {
                            const validateError = argument.validate(value, this.opts);
                            if (validateError) {
                                if (!this.error)
                                    this.error = validateError;
                                this.additionalUsage += chalk.red(' <' + argument.name + '>');
                                return;
                            }
                        }
                        this.additionalUsage += ' ' + value;
                        this.opts[argument.name] = value;
                        
                        //optional arguments
                    } else {
                        this.help += '  --' + argument.name + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);
                        
                        let value;
                        if (this.args.length > 0) {
                            for (let i = 0; i < this.args.length; i++) {
                                const arg = this.args[i];
                                
                                if (arg.substr(0, 2) === '--') { //is an optional arg
                                    const name = arg.substr(2);
                                    const split = name.split('=');
                                    if (split.length !== 2) {
                                        if (name === argument.name && argument.type === 'Boolean')
                                            value = true;
                                        
                                    } else if (split[0] === argument.name) {
                                        value = convertType(argument, split[1]);
                                    }
                                    
                                    if (value !== undefined) {
                                        this.args.splice(i, 1);
                                        break;
                                    }
                                }
                            }
                        }
                        
                        if (value !== undefined && argument.validate) {
                            const validateError = argument.validate(value, this.opts);
                            if (validateError) {
                                if (!this.error)
                                    this.error = validateError;
                                return;
                            }
                        }
                        
                        if (value === undefined) {
                            if (argument.default !== undefined)
                                this.opts[argument.name] = argument.default;
                            else
                                this.opts[argument.name] = undefined;
                        } else {
                            this.opts[argument.name] = value;
                        }
                    }
                });
        })
        .then(() => {
            if (!this.error && !!def.action) {
                return Promise
                    .try(() => {
                        return def.action(this.opts)
                    })
                    .then(errorMessage => {
                        if (!this.error)
                            this.error = errorMessage;
                    });
            }
            return undefined;
        });
};

Smargs.prototype.checkName = function (def, match) {
    if (match === def.name)
        return true;
    
    //check aliases
    if (def.alias) {
        if (Array.isArray(def.alias)) {
            for (let i = def.alias.length - 1; i >= 0; i--) {
                if (match === def.alias[i])
                    return true;
            }
        } else if (match === def.alias) {
            return true;
        }
    }
    
    return false;
};

function convertType(def, value) {
    switch (def.type) {
        case 'Number': {
            const n = Number(value);
            return isNaN(n) ? undefined : n;
        }
        case 'Boolean':
            switch (value.toLowerCase()) {
                case 'false':
                case '0':
                case 'f':
                case 'no':
                    return false;
                default:
                    return true;
            }
        case undefined:
        case 'String':
            return String(value);
        default:
            throw new Error('unknown type');
    }
}

module.exports = function (def, testing) {
    const smargs = new Smargs(def, testing);
    const p = smargs.go();
    if (smargs.testing)
        return p;
    return undefined;
};