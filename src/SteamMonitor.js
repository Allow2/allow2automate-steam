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

const os = require('os');
const path = require('path');
const fs = require('fs');

/**
 * SteamMonitor - Handles Steam-specific monitoring logic
 */
class SteamMonitor {
    constructor(context, agentService) {
        this.context = context;
        this.agentService = agentService;
        this.steamPaths = this.detectSteamPaths();
    }

    /**
     * Detect Steam installation paths based on platform
     */
    detectSteamPaths() {
        const platform = os.platform();
        const paths = {
            config: null,
            userdata: null,
            steamapps: null
        };

        try {
            if (platform === 'win32') {
                // Windows
                const programFiles = process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)';
                const steamBase = path.join(programFiles, 'Steam');
                paths.config = path.join(steamBase, 'config');
                paths.userdata = path.join(steamBase, 'userdata');
                paths.steamapps = path.join(steamBase, 'steamapps');
            } else if (platform === 'darwin') {
                // macOS
                const homeDir = os.homedir();
                const steamBase = path.join(homeDir, 'Library', 'Application Support', 'Steam');
                paths.config = path.join(steamBase, 'config');
                paths.userdata = path.join(steamBase, 'userdata');
                paths.steamapps = path.join(steamBase, 'steamapps');
            } else if (platform === 'linux') {
                // Linux
                const homeDir = os.homedir();
                const steamBase = path.join(homeDir, '.steam', 'steam');
                paths.config = path.join(steamBase, 'config');
                paths.userdata = path.join(steamBase, 'userdata');
                paths.steamapps = path.join(steamBase, 'steamapps');
            }

            // Validate paths exist
            if (paths.config && fs.existsSync(paths.config)) {
                console.log('[SteamMonitor] Steam installation detected:', paths.config);
            } else {
                console.warn('[SteamMonitor] Steam installation not found at expected location');
                paths.config = null;
            }
        } catch (error) {
            console.error('[SteamMonitor] Error detecting Steam paths:', error);
        }

        return paths;
    }

    /**
     * Get Steam process names for current platform
     */
    getProcessNames() {
        const platform = os.platform();

        const processNames = {
            win32: ['Steam.exe', 'steamwebhelper.exe', 'gameoverlayui.exe'],
            darwin: ['steam_osx', 'Steam.app', 'steamwebhelper'],
            linux: ['steam', 'steamwebhelper', 'reaper']
        };

        return processNames[platform] || processNames.win32;
    }

    /**
     * Get main Steam process name for platform
     */
    getMainProcessName() {
        const processNames = this.getProcessNames();
        return processNames[0];
    }

    /**
     * Check if Steam is installed on agent
     */
    async isSteamInstalled(agentId) {
        try {
            // This would query the agent to check for Steam installation
            // For now, we'll assume it's installed if the agent can detect the process
            return true;
        } catch (error) {
            console.error('[SteamMonitor] Error checking Steam installation:', error);
            return false;
        }
    }

    /**
     * Get Steam user directories
     * Returns list of SteamID3 directories in userdata/
     */
    getSteamUserDirectories() {
        if (!this.steamPaths.userdata || !fs.existsSync(this.steamPaths.userdata)) {
            return [];
        }

        try {
            const entries = fs.readdirSync(this.steamPaths.userdata, { withFileTypes: true });
            return entries
                .filter(entry => entry.isDirectory())
                .filter(entry => /^\d+$/.test(entry.name)) // Only numeric directories (SteamID3)
                .map(entry => ({
                    steamId3: entry.name,
                    path: path.join(this.steamPaths.userdata, entry.name)
                }));
        } catch (error) {
            console.error('[SteamMonitor] Error reading userdata directory:', error);
            return [];
        }
    }

    /**
     * Get VDF config file path for a Steam user
     */
    getVDFConfigPath(steamId3) {
        if (!this.steamPaths.userdata) {
            return null;
        }

        return path.join(this.steamPaths.userdata, steamId3, 'config', 'localconfig.vdf');
    }

    /**
     * Cleanup resources
     */
    cleanup() {
        // Cleanup any resources if needed
        console.log('[SteamMonitor] Cleanup complete');
    }
}

module.exports = SteamMonitor;
