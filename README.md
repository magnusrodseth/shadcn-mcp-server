# Shadcn MCP Server

A Model Context Protocol (MCP) server for shadcn/ui components. This server provides AI assistants with access to shadcn/ui component source code, blocks, and metadata.

## 🚀 Quick Start

### Prerequisites

- Node.js ≥ 18.0.0
- pnpm (preferred) or npm
- Optional: GitHub Personal Access Token (for higher rate limits)

### Installation & Development

1. **Install dependencies:**

   ```bash
   pnpm install
   ```

2. **Set up environment (optional):**

   ```bash
   cp .env.example .env
   # Edit .env with your GitHub token
   ```

3. **Build the project:**

   ```bash
   pnpm run build
   ```

4. **Test locally:**

   ```bash
   # Run unit tests
   pnpm test

   # Test MCP server integration
   pnpm run test:mcp

   # Test manually (server will listen on stdin/stdout)
   pnpm run test:manual
   ```

## 🧪 Local Testing

### Unit Tests with Vitest

```bash
# Run tests once
pnpm test

# Watch mode
pnpm run test:watch

# With coverage
pnpm run test:coverage
```

### MCP Server Integration Testing

```bash
# Automated MCP protocol testing
pnpm run test:mcp
```

This will:

- Start the MCP server
- Send JSON-RPC messages to test all endpoints
- Verify responses and error handling
- Show a comprehensive test summary

### Testing with Cursor

1. **Set up Cursor integration:**

   ```bash
   node scripts/test-cursor.js
   ```

2. **Follow the generated instructions** to configure Cursor

3. **Test in Cursor by asking:**
   - "List available shadcn components"
   - "Show me the button component source code"
   - "Get the dashboard-01 block"

## 🔧 Available Tools

| Tool              | Description                                           | Arguments                    |
| ----------------- | ----------------------------------------------------- | ---------------------------- |
| `get_component`   | Get source code and metadata for a specific component | `componentName` (string)     |
| `list_components` | List all available shadcn/ui components               | `category` (optional string) |
| `get_block`       | Get a complete shadcn/ui block implementation         | `blockName` (string)         |
| `list_blocks`     | List all available shadcn/ui blocks                   | none                         |

## 📦 Deployment Options

### Option 1: Local Development

Perfect for learning and development:

```bash
# Build and run locally
pnpm run build
pnpm start
```

### Option 2: npm Package (published as npm for wider compatibility)

1. **Update package.json** with your details:

   ```json
   {
     "name": "@yourusername/shadcn-mcp-server",
     "author": "Your Name <your.email@example.com>",
     "repository": "https://github.com/yourusername/shadcn-mcp-server"
   }
   ```

2. **Publish to npm:**

   ```bash
   pnpm publish --access public
   ```

3. **Install globally:**

   ```bash
   # Users can install with any package manager
   npm install -g @yourusername/shadcn-mcp-server
   # or
   pnpm install -g @yourusername/shadcn-mcp-server
   ```

4. **Use in Cursor config:**
   ```json
   {
     "mcpServers": {
       "shadcn": {
         "command": "shadcn-mcp",
         "args": ["--github-token", "your_token"]
       }
     }
   }
   ```

### Option 3: Direct Git Installation

```bash
pnpm install -g git+https://github.com/yourusername/shadcn-mcp-server.git
```

## 🛠️ Development Workflow

```bash
# Development with hot reload
pnpm run dev

# Build for production
pnpm run build

# Clean build artifacts
pnpm run clean

# Test everything
pnpm test && pnpm run test:mcp

# Set up Cursor testing
node scripts/test-cursor.js
```

## 🎯 Architecture

- **index.ts**: Main MCP server setup and request handlers
- **services/shadcn-service.ts**: Core logic for fetching components/blocks
- **types/shadcn.ts**: TypeScript type definitions
- **utils/logger.ts**: Winston logging configuration
- **scripts/**: Testing and setup utilities

## 📝 Environment Variables

| Variable       | Description                          | Required |
| -------------- | ------------------------------------ | -------- |
| `GITHUB_TOKEN` | GitHub token for higher rate limits  | No       |
| `NODE_ENV`     | Environment (development/production) | No       |
| `DEBUG`        | Enable debug logging                 | No       |

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests (`pnpm test`)
5. Run the test suite (`pnpm run test:mcp`)
6. Submit a pull request

## 📄 License

MIT License - see LICENSE file for details.
