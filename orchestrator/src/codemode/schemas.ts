export const EXECUTE_CODE_SCHEMA = {
  type: 'object',
  properties: {
    userRequest: { type: 'string', description: 'Natural language description of the task' },
  },
  required: ['userRequest'],
} as const;

export const EXECUTE_CODE_WITH_TOOLS_SCHEMA = {
  type: 'object',
  properties: {
    code: { type: 'string', description: 'JavaScript to execute. Use tools[...] to call MCP tools.' },
  },
  required: ['code'],
} as const;

export const LIST_AVAILABLE_TOOLS_SCHEMA = {
  type: 'object',
  properties: {},
  required: [],
} as const;


