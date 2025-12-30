import { jest } from '@jest/globals';
import { SteamMonitor } from '../src/SteamMonitor.js';
import fs from 'fs/promises';
import path from 'path';

// Mock dependencies
jest.mock('fs/promises');

describe('SteamMonitor', () => {
  let steamMonitor;
  let mockPolicyCallback;

  beforeEach(() => {
    jest.clearAllMocks();
    mockPolicyCallback = jest.fn();
    steamMonitor = new SteamMonitor(mockPolicyCallback);
  });

  describe('constructor', () => {
    test('initializes with empty games list', () => {
      expect(steamMonitor.installedGames).toEqual([]);
    });
  });

  describe('generatePolicies', () => {
    test('generates policies for Steam games', () => {
      steamMonitor.installedGames = [
        { appid: '440', name: 'Team Fortress 2', installdir: 'Team Fortress 2' }
      ];

      const policies = steamMonitor.generatePolicies('win32');

      expect(policies.length).toBeGreaterThan(0);
      expect(policies.some(p => p.processName === 'Steam.exe')).toBe(true);
    });
  });
});
