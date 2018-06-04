/*
 * Copyright (C) 2018 Red Hat, Inc. and others.
 *
 * Licensed under the Apache License, Version 2.0 (the "License"); you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at http://www.apache.org/licenses/LICENSE-2.0
 */

import { ContainerModule, Container } from 'inversify';
import { FrontendApplicationContribution, WidgetFactory } from '@theia/core/lib/browser';
import { TaskContribution } from '@theia/task/lib/browser';
import { CommandContribution } from '@theia/core/lib/common/command';
import { VariableContribution } from '@theia/variable-resolver/lib/browser';
import { CheTaskContribution } from './che-task-contribution';
import { CheTaskProvider } from './che-task-provider';
import { CheTaskResolver } from './che-task-resolver';
import { CheTaskWatcher } from './che-task-watcher';
import { Workspace } from './che-workspace-client';
import { PreviewUrlIndicator } from './preview-url-indicator';
import { PreviewUrlQuickOpen } from './preview-url-quick-open';
import { ServerVariableContribution } from './server-variable-contribution';
import { CHE_TERMINAL_WIDGET_FACTORY_ID, CheTerminalWidget } from './che-terminal-widget';
import { TerminalWidgetOptions } from '@theia/terminal/lib/browser/terminal-widget';

export default new ContainerModule(bind => {
    bind(CheTaskProvider).toSelf().inSingletonScope();
    bind(CheTaskResolver).toSelf().inSingletonScope();
    bind(TaskContribution).to(CheTaskContribution).inSingletonScope();

    bind(FrontendApplicationContribution).to(PreviewUrlIndicator).inSingletonScope();
    bind(CommandContribution).to(PreviewUrlIndicator).inSingletonScope();
    bind(PreviewUrlQuickOpen).toSelf().inSingletonScope();

    bind(Workspace).toSelf().inSingletonScope();

    bind(VariableContribution).to(ServerVariableContribution).inSingletonScope();

    bind(FrontendApplicationContribution).to(CheTaskWatcher).inSingletonScope();

    bind(CheTerminalWidget).toSelf().inTransientScope();
    bind(WidgetFactory).toDynamicValue(ctx => ({
        id: CHE_TERMINAL_WIDGET_FACTORY_ID,
        createWidget: (options: TerminalWidgetOptions) => {
            const child = new Container({ defaultScope: 'Singleton' });
            child.parent = ctx.container;
            child.bind(TerminalWidgetOptions).toConstantValue({
                id: 'terminal-che',
                caption: 'Terminal Che',
                label: 'Terminal Che',
                destroyTermOnClose: true,
                ...options
            });
            return child.get(CheTerminalWidget);
        }
    }));
});
