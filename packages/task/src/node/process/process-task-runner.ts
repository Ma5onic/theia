/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject, named } from 'inversify';
import { isWindows, ILogger } from '@theia/core';
import { FileUri } from '@theia/core/lib/node';
import {
    TerminalProcess,
    RawProcess,
    TerminalProcessOptions,
    RawProcessOptions,
    RawProcessFactory,
    TerminalProcessFactory
} from '@theia/process/lib/node';
import URI from '@theia/core/lib/common/uri';
import { TaskFactory } from './process-task';
import { TaskRunner } from '../task-runner';
import { Task } from '../task';
import { ProcessTaskConfiguration } from '../../common/task-protocol';
import * as fs from 'fs';
import * as path from 'path';

@injectable()
export class ProcessTaskRunner implements TaskRunner {

    @inject(ILogger) @named('task')
    protected readonly logger: ILogger;

    @inject(RawProcessFactory)
    protected readonly rawProcessFactory: RawProcessFactory;

    @inject(TerminalProcessFactory)
    protected readonly terminalProcessFactory: TerminalProcessFactory;

    @inject(TaskFactory)
    protected readonly taskFactory: TaskFactory;

    async run(taskConfig: ProcessTaskConfiguration, ctx?: string): Promise<Task> {
        // on windows, prefer windows-specific options, if available
        const processOptions = (isWindows && taskConfig.windows !== undefined) ?
            taskConfig.windows : taskConfig.processOptions;

        const command = processOptions.command;

        // sanity checks:
        // - we expect the cwd to be set by the client.
        // - we expect processType to be set by the client
        if (!taskConfig.cwd) {
            return Promise.reject(new Error("Can't run a task when 'cwd' is not provided by the client"));
        }

        const cwd = FileUri.fsPath(taskConfig.cwd);
        // Use task's cwd with spawned process and pass node env object to
        // new process, so e.g. we can re-use the system path
        processOptions.options = {
            cwd: cwd,
            env: process.env
        };

        // When we create a process to execute a command, it's difficult to know if it failed
        // because the executable or script was not found, or if it was found, ran, and exited
        // unsuccessfully. So here we look to see if it seems we can find a file of that name
        // that is likely to be the one we want, before attempting to execute it.
        const cmd = await this.findCommand(command, cwd);
        if (cmd) {
            try {
                // use terminal or raw process
                let proc: TerminalProcess | RawProcess;

                if (taskConfig.type === 'process') {
                    this.logger.debug('Task: creating underlying raw process');
                    proc = this.rawProcessFactory(<RawProcessOptions>processOptions);
                } else {
                    // all Task types without specific TaskRunner will be run as a shell process e.g.: npm, gulp, etc.
                    this.logger.debug('Task: creating underlying terminal process');
                    proc = this.terminalProcessFactory(<TerminalProcessOptions>processOptions);
                }
                return this.taskFactory(
                    {
                        label: taskConfig.label,
                        command: cmd,
                        process: proc,
                        processType: taskConfig.type,
                        context: ctx,
                        config: taskConfig
                    });
            } catch (error) {
                this.logger.error(`Error occurred while creating task: ${error}`);
                return Promise.reject(new Error(error));
            }
        } else {
            return Promise.reject(new Error(`Command not found: ${command}`));
        }
    }

    /**
     * Uses heuristics to look-for a command. Will look into the system path, if the command
     * is given without a path. Will resolve if a potential match is found, else reject. There
     * is no guarantee that a command we find will be the one executed, if multiple commands with
     * the same name exist.
     * @param command command name to look for
     * @param cwd current working directory
     */
    protected async findCommand(command: string, cwd: string): Promise<string | undefined> {
        const systemPath = process.env.PATH;
        const pathDelimiter = path.delimiter;

        if (path.isAbsolute(command)) {
            if (await this.executableFileExists(command)) {
                return command;
            }
        } else {
            // look for command relative to cwd
            const resolvedCommand = FileUri.fsPath(new URI(cwd).resolve(command));

            if (await this.executableFileExists(resolvedCommand)) {
                return resolvedCommand;
            } else {
                // just a command to find in the system path?
                if (path.basename(command) === command) {
                    // search for this command in the system path
                    if (systemPath !== undefined) {
                        const pathArray: string[] = systemPath.split(pathDelimiter);

                        for (const p of pathArray) {
                            const candidate = FileUri.fsPath(new URI(p).resolve(command));
                            if (await this.executableFileExists(candidate)) {
                                return candidate;
                            }
                        }
                    }
                }
            }

        }
    }

    /**
     * Checks for the existence of a file, at the provided path, and make sure that
     * it's readable and executable.
     */
    protected async executableFileExists(filePath: string): Promise<boolean> {
        return new Promise<boolean>(async (resolve, reject) => {
            fs.access(filePath, fs.constants.F_OK | fs.constants.X_OK, err => {
                resolve(err ? false : true);
            });
        });
    }
}
