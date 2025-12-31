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

import React, { Component } from 'react';
import {
    Typography,
    Card,
    CardContent,
    CardHeader,
    List,
    ListItem,
    ListItemText,
    ListItemSecondaryAction,
    Switch,
    Button,
    TextField,
    Select,
    MenuItem,
    FormControl,
    InputLabel,
    Divider,
    Chip,
    Box,
    CircularProgress,
    IconButton,
    Tooltip
} from '@material-ui/core';
import Alert from '@material-ui/lab/Alert';
import {
    Computer as ComputerIcon,
    Refresh as RefreshIcon,
    Settings as SettingsIcon,
    Block as BlockIcon,
    CheckCircle as CheckCircleIcon,
    Info as InfoIcon
} from '@material-ui/icons';

const { ipcRenderer } = window.require('electron');

class TabContent extends Component {
    constructor(props) {
        super(props);

        this.state = {
            agents: [],
            children: [],
            violations: [],
            settings: {
                checkInterval: 30000,
                killOnViolation: true,
                notifyParent: true
            },
            status: null,
            loading: true,
            error: null,
            selectedChild: {}
        };
    }

    async componentDidMount() {
        await this.loadData();

        // Setup event listeners
        ipcRenderer.on('steamViolation', (event, data) => {
            this.handleViolation(data);
        });

        ipcRenderer.on('steamDetected', (event, data) => {
            this.handleSteamDetected(data);
        });

        // Refresh data every 30 seconds
        this.refreshInterval = setInterval(() => {
            this.loadData(false);
        }, 30000);
    }

    componentWillUnmount() {
        // Cleanup
        if (this.refreshInterval) {
            clearInterval(this.refreshInterval);
        }

        ipcRenderer.removeAllListeners('steamViolation');
        ipcRenderer.removeAllListeners('steamDetected');
    }

    async loadData(showLoading = true) {
        if (showLoading) {
            this.setState({ loading: true, error: null });
        }

        try {
            // Get agents
            const [agentsError, agentsResult] = await ipcRenderer.invoke('steam:getAgents');
            if (agentsError) throw agentsError;

            // Get violations
            const [violationsError, violationsResult] = await ipcRenderer.invoke('steam:getViolations', { limit: 50 });
            if (violationsError) throw violationsError;

            // Get settings
            const [settingsError, settingsResult] = await ipcRenderer.invoke('steam:getSettings');
            if (settingsError) throw settingsError;

            // Get status
            const [statusError, statusResult] = await ipcRenderer.invoke('steam:getStatus');
            if (statusError) throw statusError;

            this.setState({
                agents: agentsResult.agents || [],
                violations: violationsResult.violations || [],
                settings: settingsResult.settings || this.state.settings,
                status: statusResult,
                loading: false
            });
        } catch (error) {
            console.error('[Steam Settings] Error loading data:', error);
            this.setState({ error: error.message, loading: false });
        }
    }

    handleViolation(data) {
        // Add violation to list
        this.setState(prevState => ({
            violations: [data, ...prevState.violations].slice(0, 50)
        }));
    }

    handleSteamDetected(data) {
        console.log('[Steam Settings] Steam detected:', data);
        // Could show notification or update UI
    }

    async handleLinkAgent(agentId, childId) {
        try {
            const [error] = await ipcRenderer.invoke('steam:linkAgent', { agentId, childId });
            if (error) throw error;

            await this.loadData(false);
        } catch (error) {
            console.error('[Steam Settings] Error linking agent:', error);
            this.setState({ error: error.message });
        }
    }

    async handleUnlinkAgent(agentId) {
        try {
            const [error] = await ipcRenderer.invoke('steam:unlinkAgent', { agentId });
            if (error) throw error;

            await this.loadData(false);
        } catch (error) {
            console.error('[Steam Settings] Error unlinking agent:', error);
            this.setState({ error: error.message });
        }
    }

    async handleUpdateSettings(newSettings) {
        try {
            const [error] = await ipcRenderer.invoke('steam:updateSettings', { settings: newSettings });
            if (error) throw error;

            this.setState({ settings: { ...this.state.settings, ...newSettings } });
        } catch (error) {
            console.error('[Steam Settings] Error updating settings:', error);
            this.setState({ error: error.message });
        }
    }

    async handleClearViolations() {
        try {
            const [error] = await ipcRenderer.invoke('steam:clearViolations');
            if (error) throw error;

            this.setState({ violations: [] });
        } catch (error) {
            console.error('[Steam Settings] Error clearing violations:', error);
            this.setState({ error: error.message });
        }
    }

    formatTimestamp(timestamp) {
        return new Date(timestamp).toLocaleString();
    }

    render() {
        const { agents, violations, settings, status, loading, error, selectedChild } = this.state;
        const { allow2Children } = this.props;

        if (loading) {
            return (
                <Box display="flex" justifyContent="center" alignItems="center" minHeight="400px">
                    <CircularProgress />
                </Box>
            );
        }

        return (
            <div style={{ padding: '20px' }}>
                <Typography variant="h5" gutterBottom>
                    Steam Parental Control Monitoring
                </Typography>
                <Typography variant="body2" color="textSecondary" paragraph>
                    Monitor Steam usage across all agent devices with parental controls enforced via Allow2.
                </Typography>

                {error && (
                    <Alert severity="error" style={{ marginBottom: '20px' }}>
                        {error}
                    </Alert>
                )}

                {/* Status Overview */}
                {status && (
                    <Card style={{ marginBottom: '20px' }}>
                        <CardHeader title="Status Overview" />
                        <CardContent>
                            <Box display="flex" gap={2}>
                                <Chip
                                    icon={<ComputerIcon />}
                                    label={`${status.activeAgents}/${status.agentCount} Agents Online`}
                                    color="primary"
                                />
                                <Chip
                                    label={`${status.monitoredChildren} Children Monitored`}
                                    color="secondary"
                                />
                                <Chip
                                    icon={<BlockIcon />}
                                    label={`${status.recentViolations?.length || 0} Recent Violations`}
                                    color={status.recentViolations?.length > 0 ? "default" : "primary"}
                                />
                            </Box>
                        </CardContent>
                    </Card>
                )}

                {/* Agents List */}
                <Card style={{ marginBottom: '20px' }}>
                    <CardHeader
                        title="Agent Devices"
                        action={
                            <IconButton onClick={() => this.loadData(true)}>
                                <RefreshIcon />
                            </IconButton>
                        }
                    />
                    <CardContent>
                        {agents.length === 0 ? (
                            <Alert severity="info">
                                No agent devices found. Install and run Allow2 Agent on devices to monitor Steam.
                            </Alert>
                        ) : (
                            <List>
                                {agents.map(agent => (
                                    <ListItem key={agent.id}>
                                        <ComputerIcon style={{ marginRight: '10px' }} />
                                        <ListItemText
                                            primary={agent.hostname}
                                            secondary={
                                                <>
                                                    {agent.platform} • {agent.online ? 'Online' : 'Offline'}
                                                    {agent.childId && ` • Linked to child ${agent.childId}`}
                                                </>
                                            }
                                        />
                                        <ListItemSecondaryAction>
                                            {agent.childId ? (
                                                <Button
                                                    size="small"
                                                    onClick={() => this.handleUnlinkAgent(agent.id)}
                                                >
                                                    Unlink
                                                </Button>
                                            ) : (
                                                <FormControl size="small" style={{ minWidth: 120 }}>
                                                    <Select
                                                        value={selectedChild[agent.id] || ''}
                                                        onChange={(e) => {
                                                            const childId = e.target.value;
                                                            this.setState({
                                                                selectedChild: { ...selectedChild, [agent.id]: childId }
                                                            });
                                                            if (childId) {
                                                                this.handleLinkAgent(agent.id, childId);
                                                            }
                                                        }}
                                                        displayEmpty
                                                    >
                                                        <MenuItem value="">Link to child...</MenuItem>
                                                        {allow2Children?.map(child => (
                                                            <MenuItem key={child.id} value={child.id}>
                                                                {child.name}
                                                            </MenuItem>
                                                        ))}
                                                    </Select>
                                                </FormControl>
                                            )}
                                        </ListItemSecondaryAction>
                                    </ListItem>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>

                {/* Settings */}
                <Card style={{ marginBottom: '20px' }}>
                    <CardHeader title="Settings" avatar={<SettingsIcon />} />
                    <CardContent>
                        <FormControl fullWidth style={{ marginBottom: '15px' }}>
                            <TextField
                                label="Check Interval (ms)"
                                type="number"
                                value={settings.checkInterval}
                                onChange={(e) => this.handleUpdateSettings({ checkInterval: parseInt(e.target.value) })}
                                helperText="How often to check if Steam is running (default: 30000ms = 30 seconds)"
                            />
                        </FormControl>

                        <Box display="flex" alignItems="center" justifyContent="space-between" marginBottom={1}>
                            <Typography>Kill Steam on Violation</Typography>
                            <Switch
                                checked={settings.killOnViolation}
                                onChange={(e) => this.handleUpdateSettings({ killOnViolation: e.target.checked })}
                            />
                        </Box>

                        <Box display="flex" alignItems="center" justifyContent="space-between">
                            <Typography>Notify Parent</Typography>
                            <Switch
                                checked={settings.notifyParent}
                                onChange={(e) => this.handleUpdateSettings({ notifyParent: e.target.checked })}
                            />
                        </Box>
                    </CardContent>
                </Card>

                {/* Violations Log */}
                <Card>
                    <CardHeader
                        title="Violation Log"
                        action={
                            <Button size="small" onClick={() => this.handleClearViolations()}>
                                Clear
                            </Button>
                        }
                    />
                    <CardContent>
                        {violations.length === 0 ? (
                            <Alert severity="success" icon={<CheckCircleIcon />}>
                                No violations recorded
                            </Alert>
                        ) : (
                            <List dense>
                                {violations.map((violation, index) => (
                                    <React.Fragment key={index}>
                                        <ListItem>
                                            <ListItemText
                                                primary={`${violation.hostname} - ${violation.processName}`}
                                                secondary={this.formatTimestamp(violation.timestamp)}
                                            />
                                        </ListItem>
                                        {index < violations.length - 1 && <Divider />}
                                    </React.Fragment>
                                ))}
                            </List>
                        )}
                    </CardContent>
                </Card>

                <Box marginTop={2}>
                    <Alert severity="info" icon={<InfoIcon />}>
                        <strong>How it works:</strong> This plugin monitors Steam processes on all connected agent devices.
                        When Steam is detected, it checks Allow2 quotas for the linked child. If quota is exceeded or paused,
                        Steam is automatically terminated.
                    </Alert>
                </Box>
            </div>
        );
    }
}

export default TabContent;
