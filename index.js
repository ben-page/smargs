'use strict';
var os = require('os');
var chalk = require('chalk');

function smargs(def) {
    var args = process.argv.slice(2);
    var usage = null;
    if (!def.name)
        usage = process.argv[1];

    processArgument(def, args, usage);
}

function getArgumentValue(def, args) {
    var value;

    for (var i = 0; i < args.length; i++) {
        value = args[i];

        if (value.substr(0, 2) === '--') { //is an optional arg
            if (def.required) //expected a required arg, so keep looking
                continue;

            var split = value.substr(2).split('=');
            if (split.length !== 2)
                return null;

            if (split[0] === def.name) { //name matches what we're looking for
                value = split[1];
                args.splice(i, 1);
                break;
            }

        } else { //is a required arg
            if (!def.required)
                continue;

            args.splice(i, 1);
            break;
        }
    }

    if (value === undefined && def.default)
        value = def.default;

    switch (def.type) {
        case 'Number':
            return Number(value);
        default:
            return value;
    }
}

function processArgument(def, args, usage) {
    if (!def.name)
        throw new Error('name is required');

    var additionalUsage = '';
    var error = null;

    if (usage)
        usage += ' ' + def.name;
    else
        usage = def.name;

    if (!!def.commands && !!def.arguments)
        throw new Error('a command may not have child commands, arguments, or an action');

    var i, help, maxLength, value;

    //process commands
    if (def.commands) {
        help = chalk.inverse('Commands:') + os.EOL;

        maxLength = 0;
        for (i = 0; i < def.commands.length; i++) {
            maxLength = Math.max(maxLength, def.commands[i].name.length);
        }
        maxLength += 5;

        value = args.length === 0 ? undefined : args[0];
        for (i = 0; i < def.commands.length; i++) {
            var command = def.commands[i];

            if (value === command.name) {
                return processArgument(command, args.slice(1), usage);
            }

            help += '  ' + command.name + (new Array(maxLength - command.name.length).join(' ') + chalk.green(command.help || '') + os.EOL);
        }

        additionalUsage = chalk.red(' <command>');
        error = 'You must specify a valid command';
    }

    //process arguments
    if (def.arguments || def.action) {
        var opts = {};
        var valid = true;
        var argument;

        help = chalk.inverse('Arguments:') + os.EOL;

        maxLength = 0;
        for (i = 0; i < def.arguments.length; i++) {
            argument = def.arguments[i];
            maxLength = Math.max(maxLength, argument.name.length + (argument.required ? 0 : 2));
        }
        maxLength += 5;

        for (i = 0; i < def.arguments.length; i++) {
            argument = def.arguments[i];

            if (argument.required) {
                help += '  <' + argument.name + '>' + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);

                if (args.length === 0) {
                    additionalUsage += chalk.red(' <' + argument.name + '>');
                    if (!error)
                        error = argument.name + ' is required';
                    valid = false;
                    continue;
                }

                value = getArgumentValue(argument, args);

                if (argument.validate) {
                    var validateError = argument.validate(value);
                    if (!!validateError) {
                        if (!error)
                            error = validateError;
                        additionalUsage += chalk.red(' <' + argument.name + '>');
                        valid = false;
                        continue;
                    }
                }

                additionalUsage += ' ' + value;
            } else {
                help += '  --' + argument.name + (new Array(maxLength - argument.name.length).join(' ') + chalk.green(argument.help || '') + os.EOL);

                value = getArgumentValue(argument, args);

                if (value && argument.validate) {
                    var validateError = argument.validate(value);
                    if (!!validateError) {
                        if (!error)
                            error = validateError;
                        valid = false;
                        continue;
                    }
                }
            }

            opts[argument.name] = value;
        }

        if (valid) {
            def.action(opts);
            return;
        }
    }

    console.log(chalk.inverse('Usage:') + ' ' + usage + additionalUsage + ' [args]');
    console.log();
    console.log(help);
    console.log(chalk.red(error));
}

module.exports = smargs;