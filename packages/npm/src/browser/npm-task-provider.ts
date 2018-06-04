/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { injectable, inject } from 'inversify';
import { FileSystem } from '@theia/filesystem/lib/common';
import { TaskProvider } from '@theia/task/lib/browser';
import { TaskConfiguration } from '@theia/task/lib/common';
import { WorkspaceService } from '@theia/workspace/lib/browser';
import { NpmTaskConfiguration } from '../common/task-protocol';

/** Reads the scripts from the root package.json and provides it as Task Configurations. */
@injectable()
export class NpmTaskProvider implements TaskProvider {

    @inject(WorkspaceService)
    protected readonly workspaceService: WorkspaceService;

    @inject(FileSystem)
    protected readonly fileSystem: FileSystem;

    async provideTasks(): Promise<TaskConfiguration[]> {
        const content = await this.resolveRootPackageJsonContent();
        if (!content) {
            return [];
        }

        const tasks: TaskConfiguration[] = [];
        const packageJSON = JSON.parse(content);
        const scripts = packageJSON.scripts;
        for (const script in scripts) {
            if (scripts.hasOwnProperty(script)) {
                const providedTask: NpmTaskConfiguration = {
                    type: 'npm',
                    label: `npm: ${script} (provided)`,
                    script: script,
                    processType: 'terminal',
                    processOptions: {
                        command: `npm`,
                        args: ['run', script]
                    }
                };
                tasks.push(providedTask);
            }
        }
        return tasks;
    }

    protected async resolveRootPackageJsonContent(): Promise<string | undefined> {
        const root = await this.workspaceService.root;
        if (!root) {
            return undefined;
        }
        const uri = root.uri + '/package.json';
        const { content } = await this.fileSystem.resolveContent(uri);
        return content;
    }
}
