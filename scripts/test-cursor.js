#!/usr/bin/env node

import { writeFileSync, readFileSync, existsSync, chmodSync } from "fs";
import { join, resolve } from "path";
import { fileURLToPath } from "url";
import { dirname } from "path";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class CursorSetup {
  constructor() {
    this.projectRoot = join(__dirname, "..");
    this.packageJson = JSON.parse(
      readFileSync(join(this.projectRoot, "package.json"), "utf-8")
    );
  }

  setup() {
    console.log("🔧 Setting up Cursor MCP integration...\n");

    this.createWrapperScript();
    this.generateCursorConfig();
    this.showInstructions();
  }

  createWrapperScript() {
    const scriptPath = join(this.projectRoot, "cursor-mcp-wrapper.sh");
    const absoluteDistPath = resolve(this.projectRoot, "dist/index.js");

    const script = `#!/bin/bash

# Shadcn MCP Server Wrapper for Cursor
# This script ensures the server is built before running

PROJECT_DIR="$(cd "$(dirname "\${BASH_SOURCE[0]}")" && pwd)"
cd "$PROJECT_DIR"

# Build if needed
if [ ! -f "dist/index.js" ] || [ "index.ts" -nt "dist/index.js" ]; then
    echo "Building MCP server..." >&2
    pnpm run build >&2
fi

# Run the server
exec node "${absoluteDistPath}" "$@"
`;

    writeFileSync(scriptPath, script);
    chmodSync(scriptPath, 0o755);

    console.log(`✅ Created wrapper script: ${scriptPath}`);
  }

  generateCursorConfig() {
    const wrapperPath = resolve(this.projectRoot, "cursor-mcp-wrapper.sh");

    const config = {
      mcpServers: {
        "local-shadcn": {
          command: wrapperPath,
          args: ["--debug"],
          env: {
            NODE_ENV: "development",
          },
        },
      },
    };

    const configPath = join(this.projectRoot, "cursor-mcp-config.json");
    writeFileSync(configPath, JSON.stringify(config, null, 2));

    console.log(`✅ Generated Cursor config: ${configPath}`);
  }

  showInstructions() {
    const configPath = resolve(this.projectRoot, "cursor-mcp-config.json");

    console.log("\n" + "=".repeat(60));
    console.log("📋 CURSOR INTEGRATION INSTRUCTIONS");
    console.log("=".repeat(60));

    console.log(`
1. 🔨 Build your project:
   pnpm run build

2. 🧪 Test locally first:
   pnpm run test:mcp

3. 📝 Configure Cursor:
   Option A - Manual Configuration:
   • Open Cursor Settings (Cmd/Ctrl + ,)
   • Search for "MCP"
   • Add this configuration:
   
   {
     "mcpServers": {
       "local-shadcn": {
         "command": "${resolve(this.projectRoot, "cursor-mcp-wrapper.sh")}",
         "args": ["--debug"],
         "env": {
           "NODE_ENV": "development"
         }
       }
     }
   }

   Option B - Copy Generated Config:
   • Copy the content from: ${configPath}
   • Paste it into your Cursor settings under "mcpServers"

4. 🔄 Restart Cursor completely

5. 🎮 Test in Cursor:
   • Ask: "List available shadcn components"
   • Ask: "Show me the button component source code"
   • Ask: "Get the dashboard-01 block"

6. 🐛 Debugging:
   • Check Cursor's Developer Console for MCP errors
   • Run 'pnpm run test:manual' to test server directly
   • Ensure wrapper script has execute permissions
   • Check the Cursor output panel for MCP logs

📍 Pro Tips:
• Use absolute paths in Cursor config
• Set GITHUB_TOKEN in your environment
• The wrapper script automatically rebuilds when needed
• Use pnpm for faster dependency management
• Test with 'pnpm test' before integrating with Cursor
    `);

    console.log("=".repeat(60));
    console.log("🚀 Ready for local testing with Cursor!");
    console.log("\n🎯 Next steps:");
    console.log("  1. pnpm run build");
    console.log("  2. pnpm run test:mcp");
    console.log("  3. Configure Cursor with the settings above");
    console.log("  4. Test in Cursor!");
  }
}

// Run setup
const setup = new CursorSetup();
setup.setup();
