import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  requestUserSelection,
  formatPrice,
  formatRating,
  formatSimilarity,
  formatTool,
  formatToolTable,
  generateCurlCommand,
  generateRejectCommand,
  configurePrompt,
  resetPromptConfig,
  getPromptConfig,
  notifySelectionMade,
  notifySelectionRejected,
  notifySelectionExpired,
  PromptableTool,
} from '../../src/discovery/interaction/prompt';

vi.mock('../../src/obs/log.js', () => ({
  log: vi.fn(),
}));

const createMockTool = (
  id: string,
  name: string,
  price: number,
  rating: number,
  similarity?: number
): PromptableTool => ({
  id,
  name,
  description: `${name} description`,
  endpoint_url: `https://api.example.com/${id}`,
  price_per_call: price,
  average_rating: rating,
  listing_status: 'ACTIVE',
  ...(similarity !== undefined ? { similarity_score: similarity } : {}),
});

describe('User Prompt Interface', () => {
  let consoleWarnSpy: ReturnType<typeof vi.spyOn>;
  let consoleLogSpy: ReturnType<typeof vi.spyOn>;

  beforeEach(() => {
    vi.clearAllMocks();
    resetPromptConfig();
    consoleWarnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {});
    consoleLogSpy = vi.spyOn(console, 'log').mockImplementation(() => {});
  });

  afterEach(() => {
    consoleWarnSpy.mockRestore();
    consoleLogSpy.mockRestore();
  });

  describe('formatPrice', () => {
    it('formats price with 4 decimal places', () => {
      expect(formatPrice(0.0123)).toBe('$0.0123');
    });

    it('shows "Free" for zero price', () => {
      expect(formatPrice(0)).toBe('Free');
    });

    it('shows "N/A" for undefined price', () => {
      expect(formatPrice(undefined)).toBe('N/A');
    });
  });

  describe('formatRating', () => {
    it('formats rating with 1 decimal and star', () => {
      expect(formatRating(4.5)).toBe('4.5★');
    });

    it('shows "N/A" for undefined rating', () => {
      expect(formatRating(undefined)).toBe('N/A');
    });
  });

  describe('formatSimilarity', () => {
    it('formats as percentage', () => {
      expect(formatSimilarity(0.85)).toBe('85%');
    });

    it('returns empty string for undefined', () => {
      expect(formatSimilarity(undefined)).toBe('');
    });
  });

  describe('formatTool', () => {
    it('formats tool with all fields', () => {
      const tool = createMockTool('tool-123', 'Weather API', 0.01, 4.5, 0.92);
      const formatted = formatTool(tool, 0);

      expect(formatted.index).toBe(1); // 1-based
      expect(formatted.id).toBe('tool-123');
      expect(formatted.name).toBe('Weather API');
      expect(formatted.price).toBe('$0.0100');
      expect(formatted.rating).toBe('4.5★');
      expect(formatted.similarity).toBe('92%');
    });

    it('uses correct 1-based index', () => {
      const tool = createMockTool('t1', 'Tool', 0, 4);
      expect(formatTool(tool, 0).index).toBe(1);
      expect(formatTool(tool, 5).index).toBe(6);
    });
  });

  describe('formatToolTable', () => {
    it('creates readable table with header', () => {
      const tools = [
        createMockTool('t1', 'Tool One', 0.01, 4.5),
        createMockTool('t2', 'Tool Two', 0.02, 3.8),
      ];

      const table = formatToolTable(tools);

      expect(table).toContain('#');
      expect(table).toContain('Name');
      expect(table).toContain('Price');
      expect(table).toContain('Rating');
      expect(table).toContain('Tool One');
      expect(table).toContain('Tool Two');
      expect(table).toContain('t1');
      expect(table).toContain('t2');
    });

    it('handles empty tool list', () => {
      const table = formatToolTable([]);
      expect(table).toContain('Name');
    });
  });

  describe('generateCurlCommand', () => {
    it('generates correct curl command', () => {
      configurePrompt({ adminHost: 'localhost', adminPort: 8080 });
      const cmd = generateCurlCommand('req-123', 'tool-456');

      expect(cmd).toContain('curl -X POST');
      expect(cmd).toContain('http://localhost:8080/admin/select-tool');
      expect(cmd).toContain('"requestId"');
      expect(cmd).toContain('req-123');
      expect(cmd).toContain('"toolId"');
      expect(cmd).toContain('tool-456');
      expect(cmd).toContain('"action":"select"');
    });

    it('uses configured host and port', () => {
      configurePrompt({ adminHost: '192.168.1.1', adminPort: 3000 });
      const cmd = generateCurlCommand('r1', 't1');

      expect(cmd).toContain('http://192.168.1.1:3000');
    });
  });

  describe('generateRejectCommand', () => {
    it('generates correct reject command', () => {
      configurePrompt({ adminHost: 'localhost', adminPort: 8080 });
      const cmd = generateRejectCommand('req-123');

      expect(cmd).toContain('http://localhost:8080/admin/select-tool');
      expect(cmd).toContain('"requestId"');
      expect(cmd).toContain('req-123');
      expect(cmd).toContain('"action":"reject"');
      expect(cmd).not.toContain('toolId');
    });
  });

  describe('requestUserSelection', () => {
    it('outputs formatted prompt to console.warn', () => {
      const tools = [
        createMockTool('t1', 'Tool One', 0.01, 4.5),
        createMockTool('t2', 'Tool Two', 0.02, 3.8),
        createMockTool('t3', 'Tool Three', 0.03, 4.0),
      ];

      const result = requestUserSelection('req-123', tools, 'get weather');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];

      expect(output).toContain('ACTION REQUIRED');
      expect(output).toContain('req-123');
      expect(output).toContain('get weather');
      expect(output).toContain('Tool One');
      expect(output).toContain('Tool Two');
      expect(output).toContain('Tool Three');
    });

    it('includes curl examples', () => {
      const tools = [createMockTool('t1', 'Tool', 0.01, 4.5)];

      requestUserSelection('req-123', tools);

      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('curl');
      expect(output).toContain('/admin/select-tool');
    });

    it('includes reject command', () => {
      const tools = [createMockTool('t1', 'Tool', 0.01, 4.5)];

      requestUserSelection('req-123', tools);

      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('reject');
    });

    it('returns result with message', () => {
      const tools = [
        createMockTool('t1', 'Tool One', 0.01, 4.5),
        createMockTool('t2', 'Tool Two', 0.02, 3.8),
      ];

      const result = requestUserSelection('req-123', tools);

      expect(result.requestId).toBe('req-123');
      expect(result.candidateCount).toBe(2);
      expect(result.message).toContain('ACTION REQUIRED');
    });

    it('can disable curl examples', () => {
      configurePrompt({ includeCurlExamples: false });
      const tools = [createMockTool('t1', 'Tool', 0.01, 4.5)];

      requestUserSelection('req-123', tools);

      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).not.toContain('curl');
    });
  });

  describe('notifySelectionMade', () => {
    it('logs selection confirmation', () => {
      notifySelectionMade('req-123', 'tool-456', 'Weather API');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('req-123');
      expect(output).toContain('Weather API');
      expect(output).toContain('tool-456');
    });
  });

  describe('notifySelectionRejected', () => {
    it('logs rejection', () => {
      notifySelectionRejected('req-123');

      expect(consoleLogSpy).toHaveBeenCalled();
      const output = consoleLogSpy.mock.calls[0][0];
      expect(output).toContain('rejected');
      expect(output).toContain('req-123');
    });
  });

  describe('notifySelectionExpired', () => {
    it('logs expiration warning', () => {
      notifySelectionExpired('req-123');

      expect(consoleWarnSpy).toHaveBeenCalled();
      const output = consoleWarnSpy.mock.calls[0][0];
      expect(output).toContain('expired');
      expect(output).toContain('req-123');
    });
  });

  describe('configuration', () => {
    it('uses custom configuration', () => {
      configurePrompt({ adminPort: 9000, adminHost: 'myhost.local' });
      const config = getPromptConfig();

      expect(config.adminPort).toBe(9000);
      expect(config.adminHost).toBe('myhost.local');
    });

    it('resetPromptConfig restores defaults', () => {
      configurePrompt({ adminPort: 9000 });
      resetPromptConfig();
      const config = getPromptConfig();

      expect(config.adminPort).toBe(8080);
    });
  });
});

