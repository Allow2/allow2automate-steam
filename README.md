# @allow2/allow2automate-steam

Steam parental control monitoring plugin for Allow2Automate via the Agent System.

## Features

- **Process Monitoring**: Monitors Steam processes across all connected agent devices
- **Automatic Enforcement**: Terminates Steam when quota is exceeded or paused
- **Multi-Platform**: Supports Windows, macOS, and Linux
- **Real-time Violations**: Tracks and logs Steam access violations
- **Child Linking**: Link agents to specific Allow2 children
- **Configurable**: Adjust check intervals and enforcement actions

## Installation

```bash
npm install @allow2/allow2automate-steam
```

## Requirements

- Allow2Automate v2.0.0 or higher
- Allow2 Agent installed on target devices
- React 16+ and Material-UI 4+

## How It Works

This plugin integrates with the Allow2 Agent system to monitor Steam processes:

1. **Agent Discovery**: Detects all connected agent devices
2. **Policy Creation**: Creates Steam process monitoring policies on each agent
3. **Quota Checking**: Checks Allow2 quotas when Steam is detected
4. **Enforcement**: Terminates Steam process if quota exceeded or paused
5. **Violation Logging**: Records all blocking events

## Usage

### Basic Setup

1. Install the plugin in Allow2Automate
2. Ensure Allow2 Agent is installed and running on target devices
3. Link agents to children in the plugin settings
4. Steam will be automatically monitored based on Allow2 quotas

### Configuration

The plugin provides several configuration options:

- **Check Interval**: How often to check if Steam is running (default: 30 seconds)
- **Kill on Violation**: Automatically terminate Steam when quota exceeded
- **Notify Parent**: Send notifications on violations

### Linking Agents to Children

1. Navigate to the Steam plugin settings
2. Find the agent device in the list
3. Select the child from the dropdown menu
4. Agent will now enforce quotas for that child

## Architecture

### Components

- **src/index.js**: Main plugin entry point and lifecycle management
- **src/services/SteamMonitor.js**: Steam-specific monitoring logic
- **src/services/SteamVDFParser.js**: Parse Steam VDF configuration files
- **src/components/TabContent.js**: Settings UI component
- **src/components/SteamStatus.js**: Real-time status display

### Process Names by Platform

- **Windows**: Steam.exe, steamwebhelper.exe, gameoverlayui.exe
- **macOS**: steam_osx, Steam.app, steamwebhelper
- **Linux**: steam, steamwebhelper, reaper

## API

### Plugin Lifecycle

- `onLoad(state)`: Initialize plugin
- `onSetEnabled(enabled)`: Enable/disable monitoring
- `newState(state)`: Handle state updates
- `onUnload(callback)`: Cleanup on removal

### IPC Handlers

- `steam:getAgents`: List all agent devices
- `steam:linkAgent`: Link agent to child
- `steam:unlinkAgent`: Unlink agent
- `steam:getViolations`: Get violation history
- `steam:clearViolations`: Clear violations log
- `steam:getSettings`: Get plugin settings
- `steam:updateSettings`: Update settings
- `steam:getStatus`: Get monitoring status

### Events

- `steamViolation`: Emitted when Steam is blocked
- `steamDetected`: Emitted when Steam starts running

## Development

### Build

```bash
npm run build
```

### Watch Mode

```bash
npm start
```

### Testing

```bash
npm test
```

## Limitations

- Requires Allow2 Agent running on target devices
- Cannot modify Steam's built-in parental controls
- VDF parsing may break on Steam updates
- Child could potentially bypass by closing the agent

## Future Enhancements

- VDF file monitoring for additional metadata
- Steam Web API integration for game library info
- Playtime statistics and reporting
- Per-game quota management
- Integration with Steam Family View

## Troubleshooting

### Agent Not Detected

- Ensure Allow2 Agent is installed and running
- Check network connectivity
- Verify agent service is available in Allow2Automate

### Steam Not Being Blocked

- Check agent is linked to correct child
- Verify quota is configured in Allow2
- Check settings: "Kill on Violation" enabled
- Review violation logs for errors

### Process Detection Issues

- Verify Steam is installed at default location
- Check process names for your platform
- Agent may need elevated permissions

## Support

- Documentation: https://github.com/Allow2/allow2automate-steam
- Issues: https://github.com/Allow2/allow2automate-steam/issues
- Allow2 Support: https://allow2.com/support

## License

MIT License - see LICENSE file for details

## Credits

Developed by Allow2 Pty Ltd
