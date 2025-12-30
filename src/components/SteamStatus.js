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
    Card,
    CardContent,
    Typography,
    Chip,
    Box,
    List,
    ListItem,
    ListItemText,
    LinearProgress
} from '@material-ui/core';
import {
    Computer as ComputerIcon,
    Block as BlockIcon,
    CheckCircle as CheckCircleIcon,
    Warning as WarningIcon
} from '@material-ui/icons';

const { ipcRenderer } = window.require('electron');

/**
 * SteamStatus - Real-time status display component
 * Shows quick overview of Steam monitoring status
 */
class SteamStatus extends Component {
    constructor(props) {
        super(props);

        this.state = {
            status: null,
            loading: true
        };
    }

    async componentDidMount() {
        await this.loadStatus();

        // Refresh status every 10 seconds
        this.statusInterval = setInterval(() => {
            this.loadStatus();
        }, 10000);

        // Listen for real-time events
        ipcRenderer.on('steamViolation', () => {
            this.loadStatus();
        });

        ipcRenderer.on('steamDetected', () => {
            this.loadStatus();
        });
    }

    componentWillUnmount() {
        if (this.statusInterval) {
            clearInterval(this.statusInterval);
        }

        ipcRenderer.removeAllListeners('steamViolation');
        ipcRenderer.removeAllListeners('steamDetected');
    }

    async loadStatus() {
        try {
            const [error, result] = await ipcRenderer.invoke('steam:getStatus');
            if (error) throw error;

            this.setState({ status: result, loading: false });
        } catch (error) {
            console.error('[SteamStatus] Error loading status:', error);
            this.setState({ loading: false });
        }
    }

    getStatusIcon() {
        const { status } = this.state;

        if (!status) return <WarningIcon style={{ color: '#ff9800' }} />;

        if (status.recentViolations?.length > 0) {
            return <BlockIcon style={{ color: '#f44336' }} />;
        }

        if (status.activeAgents > 0) {
            return <CheckCircleIcon style={{ color: '#4caf50' }} />;
        }

        return <ComputerIcon style={{ color: '#2196f3' }} />;
    }

    getStatusText() {
        const { status } = this.state;

        if (!status) return 'Loading...';

        if (status.recentViolations?.length > 0) {
            return `${status.recentViolations.length} recent violations`;
        }

        if (status.activeAgents === 0) {
            return 'No agents online';
        }

        if (status.monitoredChildren === 0) {
            return 'No children linked';
        }

        return `Monitoring ${status.monitoredChildren} ${status.monitoredChildren === 1 ? 'child' : 'children'}`;
    }

    formatTimestamp(timestamp) {
        const now = Date.now();
        const diff = now - timestamp;

        if (diff < 60000) return 'Just now';
        if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
        if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
        return new Date(timestamp).toLocaleDateString();
    }

    render() {
        const { status, loading } = this.state;
        const { compact } = this.props;

        if (loading) {
            return <LinearProgress />;
        }

        if (compact) {
            // Compact view for dashboard
            return (
                <Box display="flex" alignItems="center" gap={1}>
                    {this.getStatusIcon()}
                    <Typography variant="body2">
                        {this.getStatusText()}
                    </Typography>
                </Box>
            );
        }

        // Full status card
        return (
            <Card>
                <CardContent>
                    <Box display="flex" alignItems="center" marginBottom={2}>
                        {this.getStatusIcon()}
                        <Typography variant="h6" style={{ marginLeft: '10px' }}>
                            Steam Monitoring
                        </Typography>
                    </Box>

                    <Box display="flex" gap={1} flexWrap="wrap" marginBottom={2}>
                        <Chip
                            size="small"
                            icon={<ComputerIcon />}
                            label={`${status?.activeAgents || 0}/${status?.agentCount || 0} Agents`}
                            color={status?.activeAgents > 0 ? "primary" : "default"}
                        />
                        <Chip
                            size="small"
                            label={`${status?.monitoredChildren || 0} Children`}
                            color={status?.monitoredChildren > 0 ? "secondary" : "default"}
                        />
                    </Box>

                    {status?.recentViolations?.length > 0 && (
                        <>
                            <Typography variant="subtitle2" gutterBottom>
                                Recent Violations:
                            </Typography>
                            <List dense>
                                {status.recentViolations.slice(0, 3).map((violation, index) => (
                                    <ListItem key={index} disableGutters>
                                        <ListItemText
                                            primary={violation.hostname}
                                            secondary={this.formatTimestamp(violation.timestamp)}
                                            primaryTypographyProps={{ variant: 'body2' }}
                                            secondaryTypographyProps={{ variant: 'caption' }}
                                        />
                                    </ListItem>
                                ))}
                            </List>
                        </>
                    )}

                    {status?.lastSync && (
                        <Typography variant="caption" color="textSecondary">
                            Last sync: {this.formatTimestamp(status.lastSync)}
                        </Typography>
                    )}
                </CardContent>
            </Card>
        );
    }
}

export default SteamStatus;
