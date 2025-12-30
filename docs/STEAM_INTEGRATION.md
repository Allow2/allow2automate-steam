# Steam Integration Technical Documentation

## Overview

The @allow2/allow2automate-steam plugin integrates Steam parental control monitoring with Allow2Automate via the Agent System. This document provides technical details on how the integration works.

## Architecture

### High-Level Flow

```
Allow2Automate (Main App)
    │
    ├─> Steam Plugin
    │   ├─> SteamMonitor (process detection)
    │   ├─> SteamVDFParser (config file parsing)
    │   └─> UI Components (settings/status)
    │
    └─> Agent Service
        │
        └─> Allow2 Agents (on child devices)
            └─> Process Monitoring Policies
```

### Component Responsibilities

#### 1. Steam Plugin (src/index.js)

**Responsibilities:**
- Plugin lifecycle management (onLoad, onSetEnabled, onUnload)
- Agent discovery and policy configuration
- IPC handler setup for renderer communication
- Event listener registration
- State persistence

**Key Methods:**
- `configureSteamPolicy(agent)`: Creates monitoring policy on agent
- `updateSteamPolicy(agent, allow2State)`: Updates policy based on quota
- `handleViolation(data)`: Processes violation events
- `setupEventListeners()`: Registers event handlers
- `setupIPCHandlers()`: Registers IPC handlers

#### 2. SteamMonitor (src/services/SteamMonitor.js)

**Responsibilities:**
- Steam path detection (Windows/macOS/Linux)
- Process name management per platform
- Steam installation verification
- User directory discovery

**Platform-Specific Process Names:**

| Platform | Main Process | Alternative Processes |
|----------|-------------|----------------------|
| Windows | Steam.exe | steamwebhelper.exe, gameoverlayui.exe |
| macOS | steam_osx | Steam.app, steamwebhelper |
| Linux | steam | steamwebhelper, reaper |

#### 3. SteamVDFParser (src/services/SteamVDFParser.js)

**Responsibilities:**
- Parse VDF (Valve Data Format) files
- Extract parental control settings
- Read user persona names
- List installed games
- File watching for real-time updates

**VDF File Locations:**

```
Windows:
C:\Program Files (x86)\Steam\
    ├─ config\
    │   └─ config.vdf
    └─ userdata\
        └─ {SteamID3}\
            └─ config\
                └─ localconfig.vdf

macOS:
~/Library/Application Support/Steam/
    ├─ config\
    └─ userdata\

Linux:
~/.steam/steam/
    ├─ config\
    └─ userdata\
```

## Process Monitoring Flow

### 1. Policy Creation

When an agent is discovered:

```javascript
const policy = {
    processName: 'Steam.exe',              // Main process to monitor
    processAlternatives: [                  // Alternative process names
        'steamwebhelper.exe',
        'gameoverlayui.exe'
    ],
    allowed: false,                         // Default: blocked
    checkInterval: 30000,                   // Check every 30 seconds
    actions: {
        onDetected: 'check-quota',          // Check Allow2 quota when detected
        onViolation: 'kill-process'         // Kill Steam if violation
    },
    metadata: {
        plugin: '@allow2/allow2automate-steam',
        category: 'gaming',
        platform: 'win32'
    }
};

await agentService.createPolicy(agent.id, policy);
```

### 2. Process Detection

The agent continuously monitors for Steam processes:

```
Agent Loop (every checkInterval):
    1. Scan running processes
    2. Match against processName and processAlternatives
    3. If Steam detected:
        a. Check policy.allowed
        b. If allowed === false:
            - Execute policy.actions.onDetected
            - Check Allow2 quota
        c. If quota exceeded:
            - Execute policy.actions.onViolation
            - Kill process
            - Emit violation event
```

### 3. Quota Checking

When Steam is detected, the agent checks Allow2 quota:

```javascript
const quota = await allow2.checkQuota(childId, 'gaming');

const steamAllowed = (
    !quota.paused &&          // Not paused
    quota.remaining > 0       // Has time remaining
);

await agentService.updatePolicy(agent.id, {
    processName: 'Steam.exe',
    allowed: steamAllowed
});
```

### 4. Violation Handling

When a violation occurs:

```javascript
// Agent emits violation event
agentService.emit('violation', {
    agentId: 'agent-123',
    processName: 'Steam.exe',
    timestamp: Date.now(),
    hostname: 'johns-pc'
});

// Plugin handles violation
handleViolation(data) {
    // Log violation
    state.violations.push(data);

    // Notify parent UI
    context.sendToRenderer('steamViolation', data);

    // Log to activity feed
    context.logActivity({
        type: 'steam_blocked',
        message: `Steam blocked on ${data.hostname}`,
        severity: 'warning'
    });
}
```

## State Management

### Plugin State Structure

```javascript
state = {
    agents: {
        'agent-123': {
            id: 'agent-123',
            hostname: 'johns-pc',
            platform: 'win32',
            enabled: true,
            childId: 'child-456',
            lastSeen: 1234567890
        }
    },
    children: {
        'child-456': {
            steamId: '76561198012345678',
            displayName: 'John'
        }
    },
    policies: {
        'agent-123': {
            processName: 'Steam.exe',
            alternativeProcesses: ['steamwebhelper.exe'],
            allowed: false,
            checkInterval: 30000,
            createdAt: 1234567890
        }
    },
    violations: [
        {
            agentId: 'agent-123',
            processName: 'Steam.exe',
            timestamp: 1234567890,
            hostname: 'johns-pc'
        }
    ],
    settings: {
        checkInterval: 30000,
        killOnViolation: true,
        notifyParent: true
    },
    lastSync: 1234567890
};
```

## Event System

### Events Emitted by Agent Service

```javascript
// New agent discovered
agentService.on('agentDiscovered', (agent) => {
    // Configure Steam policy on new agent
});

// Process detected
agentService.on('processDetected', (data) => {
    // Steam started running
});

// Violation occurred
agentService.on('violation', (data) => {
    // Steam blocked
});

// Agent disconnected
agentService.on('agentDisconnected', (agentId) => {
    // Agent went offline
});
```

### Events Emitted by Plugin

```javascript
// To renderer (UI)
context.sendToRenderer('steamViolation', {
    agentId: 'agent-123',
    timestamp: Date.now()
});

context.sendToRenderer('steamDetected', {
    agentId: 'agent-123',
    processName: 'Steam.exe'
});
```

## IPC Communication

### Renderer → Main Process

```javascript
// Get agents
const [error, result] = await ipcRenderer.invoke('steam:getAgents');
// Returns: { agents: [...] }

// Link agent to child
await ipcRenderer.invoke('steam:linkAgent', {
    agentId: 'agent-123',
    childId: 'child-456'
});

// Get violations
const violations = await ipcRenderer.invoke('steam:getViolations', {
    limit: 50
});

// Update settings
await ipcRenderer.invoke('steam:updateSettings', {
    settings: { checkInterval: 60000 }
});

// Get status
const status = await ipcRenderer.invoke('steam:getStatus');
```

## VDF File Parsing

### VDF Format Example

```vdf
"UserLocalConfigStore"
{
    "friends"
    {
        "PersonaName"    "JohnDoe"
    }
    "parental"
    {
        "enabled"    "1"
        "pin"        "encrypted_hash_here"
    }
    "Software"
    {
        "Valve"
        {
            "Steam"
            {
                "RunningAppID"    "570"  // Dota 2
            }
        }
    }
}
```

### Parsing Parental Settings

```javascript
const parser = new SteamVDFParser();
const config = parser.parseFile(vdfPath);

const parentalSettings = parser.getParentalSettings(vdfPath);
// Returns: { enabled: "1", pin: "hash..." }

const personaName = parser.getPersonaName(vdfPath);
// Returns: "JohnDoe"
```

## Steam Family Compatibility

### Steam Families (New System)

Steam Families launched September 2024, replacing Steam Family Sharing and Family View.

**Compatibility:**
- ✅ Process monitoring works independently
- ✅ Can enforce alongside Steam Families
- ❌ Cannot modify Steam Families settings
- ❌ Cannot read Steam Families parental controls via VDF

**Recommendation:**
Use Steam plugin for **time limits** (what Steam Families lacks), while Steam Families handles content restrictions.

## Security Considerations

### 1. No Credential Storage

- Plugin NEVER stores Steam credentials
- Uses process monitoring only
- No interaction with Steam accounts

### 2. Agent Trust Model

- Agents must be trusted devices
- Agent runs with sufficient permissions to monitor processes
- Communication encrypted between agent and main app

### 3. Process Termination

- Uses OS-level process termination (SIGTERM/SIGKILL)
- Child could restart Steam (requires monitoring to be continuous)
- Agent must have permissions to kill processes

## Limitations

### Current Limitations

1. **No Steam API Access**
   - Steam Web API doesn't expose parental controls
   - Cannot modify Steam's settings programmatically

2. **Process-Based Detection**
   - Relies on process names (could change)
   - Child could rename process (unlikely)

3. **Agent Dependency**
   - Requires agent running on each device
   - Agent must have process monitoring permissions

4. **VDF Format**
   - Valve Data Format is undocumented
   - Structure may change with Steam updates
   - Parental control location in VDF unclear

5. **Bypass Potential**
   - Child could close agent (requires protection)
   - Could use Steam in offline mode
   - Could use Steam Deck or other devices

### Future Improvements

1. **VDF Monitoring**
   - Watch localconfig.vdf for changes
   - Detect game launches from VDF
   - Extract playtime statistics

2. **Steam Web API Integration**
   - Get game library and metadata
   - Display game names/icons in UI
   - Show playtime stats from Steam

3. **Per-Game Quotas**
   - Different quotas for different games
   - Block specific games vs. all games

4. **Network Monitoring**
   - Detect Steam even if process renamed
   - Monitor Steam network traffic

## Troubleshooting

### Agent Not Detecting Steam

**Symptoms:**
- Steam running but not being blocked
- No violations logged

**Solutions:**
1. Check process names are correct for platform
2. Verify agent has permission to monitor processes
3. Check Steam is installed at default location
4. Review agent logs for errors

### Policy Not Enforcing

**Symptoms:**
- Steam detected but not terminated
- Violations logged but Steam continues running

**Solutions:**
1. Verify "Kill on Violation" setting enabled
2. Check agent has permission to kill processes
3. Review agent configuration
4. Check quota is actually exceeded

### VDF Parsing Errors

**Symptoms:**
- Cannot read Steam config
- Parental settings not found

**Solutions:**
1. Verify Steam is installed
2. Check userdata directory exists
3. Confirm VDF files are not corrupted
4. Review parser logs

## Testing

### Unit Tests

Run tests with:
```bash
npm test
```

### Manual Testing

1. Install plugin
2. Install agent on test device
3. Link agent to test child
4. Set low quota in Allow2
5. Launch Steam
6. Verify Steam is terminated
7. Check violation logged

## References

- [Steam Web API Documentation](https://developer.valvesoftware.com/wiki/Steam_Web_API)
- [Steamworks SDK](https://partner.steamgames.com/doc/sdk/api)
- [Steam Families](https://help.steampowered.com/en/faqs/view/6B1A-66BE-E911-3D98)
- [simple-vdf Library](https://www.npmjs.com/package/simple-vdf)
- [Epic/Steam Integration Research](/mnt/ai/automate/automate/docs/research/epic-steam-integration-investigation.md)

---

**Version:** 1.0.0
**Last Updated:** 2025-12-29
**Author:** Allow2 Pty Ltd
