// Copyright [2025] [Allow2 Pty Ltd]
//
// Licensed under the Apache License, Version 2.0 (the "License");
// you may not use this file except in compliance with the License.
// You may obtain a copy of the License at
//
//    http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing, software
// distributed under the License is distributed on an "AS IS" BASIS,
// WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
// See the License for the specific language governing permissions and
// limitations under the License.
//

'use strict';

const assert = require('assert');
const SteamMonitor = require('../src/services/SteamMonitor');

describe('SteamMonitor', () => {
    let monitor;
    let mockContext;
    let mockAgentService;

    beforeEach(() => {
        mockContext = {
            statusUpdate: () => {},
            configurationUpdate: () => {},
            sendToRenderer: () => {},
            logActivity: () => {}
        };

        mockAgentService = {
            listAgents: async () => [],
            getAgent: async (id) => ({ id, hostname: 'test-host', platform: 'win32' }),
            createPolicy: async () => {},
            updatePolicy: async () => {},
            deletePolicy: async () => {},
            on: () => {}
        };

        monitor = new SteamMonitor(mockContext, mockAgentService);
    });

    describe('getProcessNames', () => {
        it('should return Windows process names on Windows', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'win32' });

            const names = monitor.getProcessNames();
            assert(names.includes('Steam.exe'));
            assert(names.includes('steamwebhelper.exe'));

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should return macOS process names on macOS', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'darwin' });

            const names = monitor.getProcessNames();
            assert(names.includes('steam_osx'));
            assert(names.includes('Steam.app'));

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });

        it('should return Linux process names on Linux', () => {
            const originalPlatform = process.platform;
            Object.defineProperty(process, 'platform', { value: 'linux' });

            const names = monitor.getProcessNames();
            assert(names.includes('steam'));
            assert(names.includes('steamwebhelper'));

            Object.defineProperty(process, 'platform', { value: originalPlatform });
        });
    });

    describe('getMainProcessName', () => {
        it('should return the first process name', () => {
            const mainProcess = monitor.getMainProcessName();
            assert(typeof mainProcess === 'string');
            assert(mainProcess.length > 0);
        });
    });

    describe('detectSteamPaths', () => {
        it('should detect Steam paths', () => {
            const paths = monitor.detectSteamPaths();
            assert(paths !== null);
            assert('config' in paths);
            assert('userdata' in paths);
            assert('steamapps' in paths);
        });
    });

    describe('getSteamUserDirectories', () => {
        it('should return array even if userdata does not exist', () => {
            const users = monitor.getSteamUserDirectories();
            assert(Array.isArray(users));
        });
    });

    describe('getVDFConfigPath', () => {
        it('should return null if userdata path not set', () => {
            monitor.steamPaths.userdata = null;
            const path = monitor.getVDFConfigPath('12345');
            assert(path === null);
        });

        it('should construct path correctly', () => {
            monitor.steamPaths.userdata = '/steam/userdata';
            const path = monitor.getVDFConfigPath('12345');
            assert(path.includes('12345'));
            assert(path.includes('localconfig.vdf'));
        });
    });

    describe('isSteamInstalled', () => {
        it('should return boolean', async () => {
            const installed = await monitor.isSteamInstalled('agent-1');
            assert(typeof installed === 'boolean');
        });
    });

    describe('cleanup', () => {
        it('should cleanup without errors', () => {
            assert.doesNotThrow(() => {
                monitor.cleanup();
            });
        });
    });
});
