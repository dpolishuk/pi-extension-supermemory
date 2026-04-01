import { describe, it, expect, vi, beforeEach } from 'vitest';
import supermemoryExtension from './index';
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

describe('Supermemory Extension', () => {
  let mockPi: any;
  let mockCtx: any;
  let registeredTools: Record<string, any> = {};
  let registeredCommands: Record<string, any> = {};
  let eventHandlers: Record<string, any[]> = {};

  beforeEach(() => {
    vi.clearAllMocks();
    registeredTools = {};
    registeredCommands = {};
    eventHandlers = {};

    mockPi = {
      on: vi.fn((event, handler) => {
        if (!eventHandlers[event]) eventHandlers[event] = [];
        eventHandlers[event].push(handler);
      }),
      registerCommand: vi.fn((name, options) => {
        registeredCommands[name] = options;
      }),
      registerTool: vi.fn((options) => {
        registeredTools[options.name] = options;
      }),
      appendEntry: vi.fn(),
    };

    mockCtx = {
      ui: {
        input: vi.fn(),
        notify: vi.fn(),
      },
      sessionManager: {
        getBranch: vi.fn(() => []),
      },
      cwd: '/test/cwd',
    };

    // Global fetch mock
    global.fetch = vi.fn();
  });

  it('should register commands and tools on load', () => {
    supermemoryExtension(mockPi as unknown as ExtensionAPI);

    expect(mockPi.registerCommand).toHaveBeenCalledWith('supermemory-setup', expect.any(Object));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_search' }));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_add' }));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_add_memory' }));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_list_documents' }));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_delete_document' }));
    expect(mockPi.registerTool).toHaveBeenCalledWith(expect.objectContaining({ name: 'supermemory_profile' }));
  });

  describe('supermemory-setup command', () => {
    it('should save configuration when apiKey is provided', async () => {
      supermemoryExtension(mockPi as unknown as ExtensionAPI);
      const setupHandler = registeredCommands['supermemory-setup'].handler;

      mockCtx.ui.input.mockResolvedValueOnce('test-api-key');
      mockCtx.ui.input.mockResolvedValueOnce('test-tag');

      await setupHandler('', mockCtx as unknown as ExtensionContext);

      expect(mockPi.appendEntry).toHaveBeenCalledWith('supermemory-config', {
        apiKey: 'test-api-key',
        apiUrl: 'https://api.supermemory.ai',
        containerTag: 'test-tag',
      });
      expect(mockCtx.ui.notify).toHaveBeenCalledWith('Supermemory configured!', 'success');
    });
  });

  describe('supermemory_search tool', () => {
    it('should throw error if apiKey is not configured', async () => {
      supermemoryExtension(mockPi as unknown as ExtensionAPI);
      const searchTool = registeredTools['supermemory_search'];

      await expect(searchTool.execute('call-id', { query: 'test' }, undefined, undefined, mockCtx))
        .rejects.toThrow('Supermemory API key not configured');
    });

    it('should call fetch with correct parameters when configured', async () => {
      supermemoryExtension(mockPi as unknown as ExtensionAPI);
      
      // Simulate session_start to load config
      const sessionStartHandler = eventHandlers['session_start'][0];
      mockCtx.sessionManager.getBranch.mockReturnValue([
        {
          type: 'custom',
          customType: 'supermemory-config',
          data: { apiKey: 'key-123', apiUrl: 'https://api.supermemory.ai', containerTag: 'tag-123' }
        }
      ]);
      await sessionStartHandler({}, mockCtx);

      const searchTool = registeredTools['supermemory_search'];
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ results: [] })
      });

      await searchTool.execute('call-id', { query: 'search query', searchMode: 'semantic' }, undefined, undefined, mockCtx);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.supermemory.ai/v4/search',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer key-123'
          },
          body: JSON.stringify({
            q: 'search query',
            searchMode: 'semantic',
            containerTags: ['tag-123']
          })
        })
      );
    });
  });

  describe('supermemory_profile tool', () => {
    it('should use v4 endpoint', async () => {
      supermemoryExtension(mockPi as unknown as ExtensionAPI);
      
      // Load config
      const sessionStartHandler = eventHandlers['session_start'][0];
      mockCtx.sessionManager.getBranch.mockReturnValue([
        {
          type: 'custom',
          customType: 'supermemory-config',
          data: { apiKey: 'key-123', apiUrl: 'https://api.supermemory.ai', containerTag: 'tag-123' }
        }
      ]);
      await sessionStartHandler({}, mockCtx);

      const profileTool = registeredTools['supermemory_profile'];
      (global.fetch as any).mockResolvedValue({
        ok: true,
        json: async () => ({ profile: {} })
      });

      await profileTool.execute('call-id', { query: 'who am i' }, undefined, undefined, mockCtx);

      expect(global.fetch).toHaveBeenCalledWith(
        'https://api.supermemory.ai/v4/profile',
        expect.any(Object)
      );
    });
  });
});
