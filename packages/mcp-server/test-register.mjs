import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";

const server = new McpServer(
  {
    name: "test-server",
    version: "1.0.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Register a tool with enum
server.registerTool(
  "test_tool",
  {
    description: "Test tool",
    inputSchema: {
      type: "object",
      properties: {
        skill_name: {
          type: "string",
          description: "Skill name",
          enum: ["skill1", "skill2"],
        },
      },
      required: ["skill_name"],
    },
  },
  async (args) => {
    return { content: [{ type: "text", text: "test" }] };
  }
);

console.log("Tool registered");

// Try to access the registered tools
const handlers = server._requestHandlers;
console.log("Handlers:", handlers);
