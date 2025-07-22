#!/usr/bin/env node

import { Server } from "@modelcontextprotocol/sdk/server/index.js";
import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import {
  CallToolRequestSchema,
  ListToolsRequestSchema,
} from "@modelcontextprotocol/sdk/types.js";
import { program } from "commander";
import dotenv from "dotenv";
import { ShadcnService } from "./services/shadcn-service.js";
import { logger } from "./utils/logger.js";
import { z } from "zod";

// Load environment variables
dotenv.config();

// CLI configuration
program
  .name("shadcn-mcp")
  .description("MCP Server for shadcn/ui components")
  .version("1.1.0")
  .option("-g, --github-token <token>", "GitHub Personal Access Token")
  .option("-d, --debug", "Enable debug logging")
  .parse();

const options = program.opts();

// Setup logging level
if (options.debug) {
  logger.level = "debug";
}

// Initialize GitHub token
const githubToken = options.githubToken || process.env.GITHUB_TOKEN;
if (!githubToken) {
  logger.warn(
    "No GitHub token provided. Rate limits will be lower (60 req/hour vs 5000 req/hour)"
  );
}

// Initialize services
const shadcnService = new ShadcnService(githubToken);

// Create MCP server
const server = new Server(
  {
    name: "shadcn-mcp-server",
    version: "1.1.0",
  },
  {
    capabilities: {
      tools: {},
    },
  }
);

// Tool schemas
const GetComponentSchema = z.object({
  componentName: z
    .string()
    .describe('Name of the shadcn/ui component (e.g., "button", "card")'),
});

const ListComponentsSchema = z.object({
  category: z.string().optional().describe("Optional category filter"),
});

const GetBlockSchema = z.object({
  blockName: z
    .string()
    .describe('Name of the shadcn/ui block (e.g., "dashboard-01")'),
});

// List available tools
server.setRequestHandler(ListToolsRequestSchema, async () => {
  return {
    tools: [
      {
        name: "get_component",
        description:
          "Get the source code and metadata for a specific shadcn/ui component",
        inputSchema: {
          type: "object",
          properties: {
            componentName: {
              type: "string",
              description:
                'Name of the component (e.g., "button", "card", "input")',
            },
          },
          required: ["componentName"],
        },
      },
      {
        name: "list_components",
        description: "List all available shadcn/ui components",
        inputSchema: {
          type: "object",
          properties: {
            category: {
              type: "string",
              description: "Optional category filter",
            },
          },
        },
      },
      {
        name: "get_block",
        description: "Get a complete shadcn/ui block implementation",
        inputSchema: {
          type: "object",
          properties: {
            blockName: {
              type: "string",
              description:
                'Name of the block (e.g., "dashboard-01", "login-form")',
            },
          },
          required: ["blockName"],
        },
      },
      {
        name: "list_blocks",
        description: "List all available shadcn/ui blocks",
        inputSchema: {
          type: "object",
          properties: {},
        },
      },
    ],
  };
});

// Handle tool calls
server.setRequestHandler(CallToolRequestSchema, async (request) => {
  const { name, arguments: args } = request.params;

  try {
    switch (name) {
      case "get_component": {
        const { componentName } = GetComponentSchema.parse(args);
        logger.debug(`Getting component: ${componentName}`);

        const component = await shadcnService.getComponent(componentName);
        return {
          content: [
            {
              type: "text",
              text: `# ${componentName} Component\n\n## Source Code\n\n\`\`\`typescript\n${
                component.source
              }\`\`\`\n\n## Dependencies\n\n${component.dependencies
                .map((dep) => `- ${dep}`)
                .join("\n")}\n\n## Description\n\n${component.description}`,
            },
          ],
        };
      }

      case "list_components": {
        const { category } = ListComponentsSchema.parse(args);
        logger.debug(
          `Listing components${category ? ` in category: ${category}` : ""}`
        );

        const components = await shadcnService.listComponents(category);
        return {
          content: [
            {
              type: "text",
              text: `# Available Components\n\n${components
                .map((comp) => `- **${comp.name}**: ${comp.description}`)
                .join("\n")}`,
            },
          ],
        };
      }

      case "get_block": {
        const { blockName } = GetBlockSchema.parse(args);
        logger.debug(`Getting block: ${blockName}`);

        const block = await shadcnService.getBlock(blockName);
        return {
          content: [
            {
              type: "text",
              text: `# ${blockName} Block\n\n## Implementation\n\n\`\`\`typescript\n${
                block.source
              }\`\`\`\n\n## Components Used\n\n${block.components
                .map((comp) => `- ${comp}`)
                .join("\n")}\n\n## Description\n\n${block.description}`,
            },
          ],
        };
      }

      case "list_blocks": {
        logger.debug("Listing blocks");

        const blocks = await shadcnService.listBlocks();
        return {
          content: [
            {
              type: "text",
              text: `# Available Blocks\n\n${blocks
                .map(
                  (block) =>
                    `- **${block.name}**: ${block.description} (Category: ${block.category})`
                )
                .join("\n")}`,
            },
          ],
        };
      }

      default:
        throw new Error(`Unknown tool: ${name}`);
    }
  } catch (error) {
    logger.error(`Error handling tool call ${name}:`, error);
    return {
      content: [
        {
          type: "text",
          text: `Error: ${
            error instanceof Error ? error.message : "Unknown error occurred"
          }`,
        },
      ],
      isError: true,
    };
  }
});

// Start the server
async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  logger.info("Shadcn MCP Server started successfully");
}

// Handle errors
process.on("SIGINT", async () => {
  logger.info("Shutting down server...");
  process.exit(0);
});

process.on("uncaughtException", (error) => {
  logger.error("Uncaught exception:", error);
  process.exit(1);
});

process.on("unhandledRejection", (reason, promise) => {
  logger.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

main().catch((error) => {
  logger.error("Failed to start server:", error);
  process.exit(1);
});
