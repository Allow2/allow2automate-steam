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

const fs = require('fs');
const vdf = require('simple-vdf');

/**
 * SteamVDFParser - Parse Steam VDF (Valve Data Format) configuration files
 * VDF files store Steam configuration, user settings, and parental control settings
 */
class SteamVDFParser {
    constructor() {
        this.cache = new Map();
    }

    /**
     * Parse VDF file
     * @param {string} filePath - Path to VDF file
     * @param {boolean} useCache - Use cached result if available
     * @returns {Object} Parsed VDF data
     */
    parseFile(filePath, useCache = true) {
        // Check cache
        if (useCache && this.cache.has(filePath)) {
            const cached = this.cache.get(filePath);
            const stats = fs.statSync(filePath);

            // Return cached if file hasn't changed
            if (cached.mtime === stats.mtime.getTime()) {
                return cached.data;
            }
        }

        try {
            // Read and parse VDF file
            const content = fs.readFileSync(filePath, 'utf8');
            const parsed = vdf.parse(content);

            // Cache result
            const stats = fs.statSync(filePath);
            this.cache.set(filePath, {
                data: parsed,
                mtime: stats.mtime.getTime()
            });

            return parsed;
        } catch (error) {
            console.error('[SteamVDFParser] Error parsing VDF file:', filePath, error);
            throw error;
        }
    }

    /**
     * Parse VDF content string
     * @param {string} content - VDF content
     * @returns {Object} Parsed data
     */
    parseContent(content) {
        try {
            return vdf.parse(content);
        } catch (error) {
            console.error('[SteamVDFParser] Error parsing VDF content:', error);
            throw error;
        }
    }

    /**
     * Get parental settings from localconfig.vdf
     * @param {string} filePath - Path to localconfig.vdf
     * @returns {Object|null} Parental settings or null if not found
     */
    getParentalSettings(filePath) {
        try {
            const config = this.parseFile(filePath);

            // Navigate to parental settings
            // Structure: UserLocalConfigStore -> parental
            const userConfig = config.UserLocalConfigStore;
            if (!userConfig) {
                return null;
            }

            return userConfig.parental || null;
        } catch (error) {
            console.error('[SteamVDFParser] Error getting parental settings:', error);
            return null;
        }
    }

    /**
     * Get user persona name from localconfig.vdf
     * @param {string} filePath - Path to localconfig.vdf
     * @returns {string|null} Persona name or null
     */
    getPersonaName(filePath) {
        try {
            const config = this.parseFile(filePath);

            // Navigate to friends -> PersonaName
            const userConfig = config.UserLocalConfigStore;
            if (!userConfig || !userConfig.friends) {
                return null;
            }

            return userConfig.friends.PersonaName || null;
        } catch (error) {
            console.error('[SteamVDFParser] Error getting persona name:', error);
            return null;
        }
    }

    /**
     * Get installed games from appmanifest files
     * @param {string} steamappsPath - Path to steamapps directory
     * @returns {Array} Array of installed games
     */
    getInstalledGames(steamappsPath) {
        try {
            const files = fs.readdirSync(steamappsPath);
            const manifestFiles = files.filter(f => f.startsWith('appmanifest_') && f.endsWith('.acf'));

            const games = [];
            for (const file of manifestFiles) {
                try {
                    const filePath = require('path').join(steamappsPath, file);
                    const manifest = this.parseFile(filePath, false);

                    if (manifest.AppState) {
                        games.push({
                            appId: manifest.AppState.appid,
                            name: manifest.AppState.name,
                            installDir: manifest.AppState.installdir,
                            lastUpdated: manifest.AppState.LastUpdated,
                            sizeOnDisk: manifest.AppState.SizeOnDisk
                        });
                    }
                } catch (error) {
                    console.error('[SteamVDFParser] Error parsing manifest:', file, error);
                }
            }

            return games;
        } catch (error) {
            console.error('[SteamVDFParser] Error getting installed games:', error);
            return [];
        }
    }

    /**
     * Watch VDF file for changes
     * @param {string} filePath - Path to VDF file
     * @param {Function} callback - Callback(parsedData) called when file changes
     * @returns {FSWatcher} File watcher instance
     */
    watchFile(filePath, callback) {
        return fs.watch(filePath, (eventType) => {
            if (eventType === 'change') {
                try {
                    // Clear cache and re-parse
                    this.cache.delete(filePath);
                    const data = this.parseFile(filePath);
                    callback(data);
                } catch (error) {
                    console.error('[SteamVDFParser] Error in watch callback:', error);
                }
            }
        });
    }

    /**
     * Clear cache
     */
    clearCache() {
        this.cache.clear();
    }

    /**
     * Clear cache for specific file
     * @param {string} filePath - Path to file
     */
    clearCacheForFile(filePath) {
        this.cache.delete(filePath);
    }
}

module.exports = SteamVDFParser;
