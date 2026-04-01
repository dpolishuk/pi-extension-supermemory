import { describe, it, expect, vi, beforeEach } from 'vitest';
import supermemoryExtension from './index';
import type { ExtensionAPI, ExtensionContext } from "@mariozechner/pi-coding-agent";

describe('Supermemory Integration', () => {
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

    global.fetch = vi.fn();
  });

  it('should handle full flow: setup -> add -> search', async () => {
    supermemoryExtension(mockPi as unknown as ExtensionAPI);

    // 1. Setup
    const setupHandler = registeredCommands['supermemory-setup'].handler;
    mockCtx.ui.input.mockResolvedValueOnce('integration-key');
    mockCtx.ui.input.mockResolvedValueOnce('integration-tag');
    await setupHandler('', mockCtx);

    // Verify config saved
    const savedConfig = mockPi.appendEntry.mock.calls[0][1];
    expect(savedConfig.apiKey).toBe('integration-key');

    // 2. Add document
    const addTool = registeredTools['supermemory_add'];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ id: 'doc-1', status: 'queued' })
    });

    const addResult = await addTool.execute('call-1', { content: 'test content' }, undefined, undefined, mockCtx);
    expect(addResult.content[0].text).toContain('Successfully added');
    expect(addResult.details.result.id).toBe('doc-1');

    // 3. Search
    const searchTool = registeredTools['supermemory_search'];
    (global.fetch as any).mockResolvedValueOnce({
      ok: true,
      json: async () => ({ results: [{ content: 'test content', score: 0.9 }], total: 1 })
    });

    const searchResult = await searchTool.execute('call-2', { query: 'test' }, undefined, undefined, mockCtx);
    expect(searchResult.details.results.total).toBe(1);
    expect(searchResult.details.results.results[0].content).toBe('test content');
  });

  it('should handle API errors gracefully', async () => {
    supermemoryExtension(mockPi as unknown as ExtensionAPI);

    // Setup config
    mockCtx.sessionManager.getBranch.mockReturnValue([
      { type: 'custom', customType: 'supermemory-config', data: { apiKey: 'key' } }
    ]);
    await eventHandlers['session_start'][0]({}, mockCtx);

    const searchTool = registeredTools['supermemory_search'];
    (global.fetch as any).mockResolvedValueOnce({
      ok: false,
      status: 401,
      text: async () => 'Unauthorized access'
    });

    await expect(searchTool.execute('call-1', { query: 'test' }, undefined, undefined, mockCtx))
      .rejects.toThrow('Supermemory search failed: 401 - Unauthorized access');
  });
});
