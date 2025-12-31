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

// Import UI components
import TabContent from './components/TabContent';
import SteamStatus from './components/SteamStatus';

// Import Steam services
const SteamMonitor = require('./SteamMonitor');
const SteamVDFParser = require('./SteamVDFParser');

/**
 * Steam Plugin Factory
 * Integrates Steam parental control monitoring via Allow2 Agent System
 * @param {Object} context - Allow2Automate plugin context
 */
function plugin(context) {
    let state = null;
    let steamMonitor = null;
    let agentService = null;

    const steam = {};

    /**
     * onLoad - Initialize plugin when Allow2Automate starts
     * @param {Object} loadState - Persisted state from previous session
     */
    steam.onLoad = async function(loadState) {
        console.log('[Steam Plugin] Loading...', loadState);

        // Restore persisted state
        state = loadState || {
            agents: {},           // agentId -> { childId, enabled, lastSeen }
            children: {},         // childId -> { steamId, displayName }
            policies: {},         // agentId -> { processName, allowed, checkInterval }
            violations: [],       // Recent violations
            settings: {
                checkInterval: 30000,    // 30 seconds
                killOnViolation: true,
                notifyParent: true
            },
            lastSync: null
        };

        // Get agent service from context
        agentService = context.services?.agent;
        if (!agentService) {
            console.error('[Steam Plugin] Agent service not available - plugin will not function');
            context.statusUpdate({
                status: 'error',
                message: 'Agent service not available',
                timestamp: Date.now()
            });
            return;
        }

        // Initialize Steam monitor
        steamMonitor = new SteamMonitor(context, agentService);

        // Get all registered agents
        try {
            const agents = await agentService.listAgents();
            console.log(`[Steam Plugin] Found ${agents.length} agents`);

            // Configure Steam monitoring on each agent
            for (const agent of agents) {
                await configureSteamPolicy(agent);
            }
        } catch (error) {
            console.error('[Steam Plugin] Error listing agents:', error);
        }

        // Setup event listeners
        setupEventListeners();

        // Setup IPC handlers
        setupIPCHandlers(context);

        console.log('[Steam Plugin] Loaded successfully');
        context.statusUpdate({
            status: 'ready',
            message: 'Steam monitoring active',
            timestamp: Date.now()
        });
    };

    /**
     * Configure Steam monitoring policy on an agent
     */
    async function configureSteamPolicy(agent) {
        // Platform-specific process names
        const processNames = {
            win32: ['Steam.exe', 'steamwebhelper.exe', 'gameoverlayui.exe'],
            darwin: ['steam_osx', 'Steam.app', 'steamwebhelper'],
            linux: ['steam', 'steamwebhelper', 'reaper']
        };

        const platform = agent.platform || 'win32';
        const mainProcess = processNames[platform][0];
        const alternativeProcesses = processNames[platform];

        try {
            await agentService.createPolicy(agent.id, {
                processName: mainProcess,
                processAlternatives: alternativeProcesses,
                allowed: false,  // Default block, updated by quota check
                checkInterval: state.settings.checkInterval,
                actions: {
                    onDetected: 'check-quota',
                    onViolation: state.settings.killOnViolation ? 'kill-process' : 'notify-only'
                },
                metadata: {
                    plugin: '@allow2/allow2automate-steam',
                    category: 'gaming',
                    platform: platform
                }
            });

            // Update state
            state.policies[agent.id] = {
                processName: mainProcess,
                alternativeProcesses,
                allowed: false,
                checkInterval: state.settings.checkInterval,
                createdAt: Date.now()
            };

            console.log(`[Steam Plugin] Policy configured for agent ${agent.hostname}`);
        } catch (error) {
            console.error(`[Steam Plugin] Error configuring policy for ${agent.hostname}:`, error);
        }
    }

    /**
     * Update Steam policy based on Allow2 state
     */
    async function updateSteamPolicy(agent, allow2State) {
        const steamAllowed = !allow2State.paused && allow2State.quota > 0;

        try {
            await agentService.updatePolicy(agent.id, {
                processName: state.policies[agent.id]?.processName || 'Steam.exe',
                allowed: steamAllowed
            });

            console.log(`[Steam Plugin] Updated ${agent.hostname}: allowed=${steamAllowed}`);

            // Update state
            if (state.agents[agent.id]) {
                state.agents[agent.id].allowed = steamAllowed;
                state.agents[agent.id].lastUpdate = Date.now();
            }

            context.configurationUpdate(state);
        } catch (error) {
            console.error(`[Steam Plugin] Error updating policy for ${agent.hostname}:`, error);
        }
    }

    /**
     * Handle violation events
     */
    function handleViolation(data) {
        console.log(`[Steam Plugin] Violation on ${data.agentId}: ${data.processName}`);

        // Add to violations log
        const violation = {
            agentId: data.agentId,
            processName: data.processName,
            timestamp: data.timestamp || Date.now(),
            hostname: data.hostname
        };

        state.violations.unshift(violation);

        // Keep only last 100 violations
        if (state.violations.length > 100) {
            state.violations = state.violations.slice(0, 100);
        }

        // Notify parent via UI
        if (state.settings.notifyParent && context.sendToRenderer) {
            context.sendToRenderer('steamViolation', violation);
        }

        // Log to activity feed
        if (context.logActivity) {
            context.logActivity({
                type: 'steam_blocked',
                message: `Steam was blocked on ${data.hostname}`,
                timestamp: violation.timestamp,
                severity: 'warning'
            });
        }

        // Persist state
        context.configurationUpdate(state);
    }

    /**
     * Setup event listeners for agent events
     */
    function setupEventListeners() {
        // Listen for Allow2 state changes
        if (context.allow2) {
            context.allow2.on('stateChange', async (childId, newState) => {
                console.log(`[Steam Plugin] Allow2 state change for child ${childId}`, newState);

                // Find agents for this child
                const childAgents = Object.values(state.agents).filter(a => a.childId === childId);

                for (const agentData of childAgents) {
                    // Get full agent object
                    try {
                        const agent = await agentService.getAgent(agentData.id);
                        if (agent) {
                            await updateSteamPolicy(agent, newState);
                        }
                    } catch (error) {
                        console.error('[Steam Plugin] Error getting agent:', error);
                    }
                }
            });
        }

        // Listen for new agents
        if (agentService) {
            agentService.on('agentDiscovered', async (agent) => {
                console.log(`[Steam Plugin] New agent discovered: ${agent.hostname}`);
                await configureSteamPolicy(agent);

                // Add to state
                state.agents[agent.id] = {
                    id: agent.id,
                    hostname: agent.hostname,
                    platform: agent.platform,
                    enabled: true,
                    childId: null,  // To be linked later
                    lastSeen: Date.now()
                };

                context.configurationUpdate(state);
            });

            // Listen for violations
            agentService.on('violation', (data) => {
                // Check if this is a Steam violation
                const processName = data.processName?.toLowerCase() || '';
                if (processName.includes('steam')) {
                    handleViolation(data);
                }
            });

            // Listen for process detected events
            agentService.on('processDetected', (data) => {
                const processName = data.processName?.toLowerCase() || '';
                if (processName.includes('steam')) {
                    console.log(`[Steam Plugin] Steam detected on ${data.hostname}`);

                    // Notify renderer
                    if (context.sendToRenderer) {
                        context.sendToRenderer('steamDetected', {
                            agentId: data.agentId,
                            processName: data.processName,
                            timestamp: data.timestamp || Date.now()
                        });
                    }
                }
            });
        }
    }

    /**
     * Setup IPC handlers for renderer communication
     */
    function setupIPCHandlers(context) {
        // Get agents
        context.ipcMain.handle('steam:getAgents', async (event) => {
            try {
                const agents = await agentService.listAgents();
                return [null, { agents: agents.map(a => ({
                    id: a.id,
                    hostname: a.hostname,
                    platform: a.platform,
                    online: a.online,
                    childId: state.agents[a.id]?.childId,
                    enabled: state.agents[a.id]?.enabled
                }))}];
            } catch (error) {
                return [error];
            }
        });

        // Link agent to child
        context.ipcMain.handle('steam:linkAgent', async (event, { agentId, childId }) => {
            try {
                if (!state.agents[agentId]) {
                    state.agents[agentId] = { id: agentId };
                }

                state.agents[agentId].childId = childId;
                state.agents[agentId].enabled = true;

                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Unlink agent
        context.ipcMain.handle('steam:unlinkAgent', async (event, { agentId }) => {
            try {
                if (state.agents[agentId]) {
                    state.agents[agentId].childId = null;
                    state.agents[agentId].enabled = false;
                }

                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get violations
        context.ipcMain.handle('steam:getViolations', async (event, { limit = 50 }) => {
            try {
                return [null, { violations: state.violations.slice(0, limit) }];
            } catch (error) {
                return [error];
            }
        });

        // Clear violations
        context.ipcMain.handle('steam:clearViolations', async (event) => {
            try {
                state.violations = [];
                context.configurationUpdate(state);
                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get settings
        context.ipcMain.handle('steam:getSettings', async (event) => {
            try {
                return [null, { settings: state.settings }];
            } catch (error) {
                return [error];
            }
        });

        // Update settings
        context.ipcMain.handle('steam:updateSettings', async (event, { settings }) => {
            try {
                state.settings = { ...state.settings, ...settings };
                context.configurationUpdate(state);

                // Update policies if check interval changed
                if (settings.checkInterval) {
                    for (const agent of await agentService.listAgents()) {
                        if (state.policies[agent.id]) {
                            await agentService.updatePolicy(agent.id, {
                                checkInterval: settings.checkInterval
                            });
                        }
                    }
                }

                return [null, { success: true }];
            } catch (error) {
                return [error];
            }
        });

        // Get status
        context.ipcMain.handle('steam:getStatus', async (event) => {
            try {
                const agents = await agentService.listAgents();
                return [null, {
                    agentCount: agents.length,
                    activeAgents: agents.filter(a => a.online).length,
                    monitoredChildren: Object.values(state.agents).filter(a => a.childId).length,
                    recentViolations: state.violations.slice(0, 10),
                    settings: state.settings,
                    lastSync: state.lastSync
                }];
            } catch (error) {
                return [error];
            }
        });
    }

    /**
     * newState - Handle configuration updates
     * @param {Object} newState - Updated state from UI
     */
    steam.newState = function(newState) {
        console.log('[Steam Plugin] State updated:', newState);
        state = newState;
    };

    /**
     * onSetEnabled - Start/stop monitoring when plugin enabled/disabled
     * @param {boolean} enabled - Plugin enabled state
     */
    steam.onSetEnabled = async function(enabled) {
        console.log(`[Steam Plugin] ${enabled ? 'enabled' : 'disabled'}`);

        if (enabled) {
            // Plugin enabled - ensure all policies are active
            context.statusUpdate({
                status: 'active',
                message: 'Steam monitoring active',
                timestamp: Date.now()
            });
        } else {
            // Plugin disabled - disable all policies
            try {
                const agents = await agentService.listAgents();
                for (const agent of agents) {
                    if (state.policies[agent.id]) {
                        await agentService.updatePolicy(agent.id, {
                            enabled: false
                        });
                    }
                }
            } catch (error) {
                console.error('[Steam Plugin] Error disabling policies:', error);
            }

            context.statusUpdate({
                status: 'inactive',
                message: 'Steam monitoring paused',
                timestamp: Date.now()
            });
        }

        // Persist state
        context.configurationUpdate(state);
    };

    /**
     * onUnload - Cleanup when plugin is removed
     * @param {Function} callback - Completion callback
     */
    steam.onUnload = function(callback) {
        console.log('[Steam Plugin] Unloading...');

        // Cleanup Steam monitor
        if (steamMonitor) {
            steamMonitor.cleanup();
        }

        // Remove all policies
        if (agentService) {
            agentService.listAgents()
                .then(agents => {
                    const promises = agents.map(agent => {
                        if (state.policies[agent.id]) {
                            return agentService.deletePolicy(agent.id, state.policies[agent.id].processName);
                        }
                    });
                    return Promise.all(promises);
                })
                .then(() => {
                    console.log('[Steam Plugin] Unloaded successfully');
                    callback(null);
                })
                .catch(err => {
                    console.error('[Steam Plugin] Error during unload:', err);
                    callback(err);
                });
        } else {
            callback(null);
        }
    };

    return steam;
}

module.exports = {
    plugin,
    TabContent,
    SteamStatus
};
