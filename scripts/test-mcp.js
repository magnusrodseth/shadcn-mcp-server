#!/usr/bin/env node

import { spawn } from "child_process";
import { fileURLToPath } from "url";
import { dirname, join } from "path";
import { readFileSync } from "fs";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

class MCPTester {
  constructor() {
    this.requestId = 1;
    this.serverProcess = null;
    this.responseBuffer = "";
    this.responses = [];
  }

  async testServer() {
    console.log("🚀 Starting Shadcn MCP Server Test...\n");

    // Check if dist directory exists
    const packageJson = JSON.parse(
      readFileSync(join(__dirname, "../package.json"), "utf-8")
    );
    const mainScript = join(__dirname, "..", packageJson.main);

    console.log(`📂 Starting server: ${mainScript}`);

    this.serverProcess = spawn("node", [mainScript], {
      stdio: ["pipe", "pipe", "pipe"],
      env: {
        ...process.env,
        NODE_ENV: "development",
        DEBUG: "true",
      },
    });

    this.setupEventHandlers();

    // Give server time to start
    await this.sleep(1000);

    try {
      // Run test sequence
      await this.runTestSequence();
    } catch (error) {
      console.error("❌ Test failed:", error);
    } finally {
      console.log("\n✅ Test completed. Shutting down server...");
      this.cleanup();
    }
  }

  setupEventHandlers() {
    this.serverProcess.stdout.on("data", (data) => {
      this.responseBuffer += data.toString();

      // Process complete JSON messages
      const lines = this.responseBuffer.split("\n");
      this.responseBuffer = lines.pop() || ""; // Keep incomplete line

      lines.forEach((line) => {
        if (line.trim()) {
          try {
            const response = JSON.parse(line);
            this.responses.push(response);
            console.log(`📨 Response:`, JSON.stringify(response, null, 2));
            console.log("─".repeat(50));
          } catch (error) {
            console.log(`📝 Raw output: ${line}`);
          }
        }
      });
    });

    this.serverProcess.stderr.on("data", (data) => {
      const output = data.toString();
      if (!output.includes("[INFO]")) {
        // Don't show info logs as errors
        console.log(`🐛 Server Error: ${output}`);
      }
    });

    this.serverProcess.on("error", (error) => {
      console.error("❌ Server process error:", error);
    });

    this.serverProcess.on("close", (code) => {
      console.log(`🏁 Server exited with code ${code}`);
    });
  }

  async runTestSequence() {
    console.log("📋 Running test sequence...\n");

    // Test 1: Initialize
    console.log("🔧 Test 1: Initialize MCP connection");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "initialize",
      params: {
        protocolVersion: "2024-11-05",
        capabilities: { tools: {} },
        clientInfo: { name: "test-client", version: "1.0.0" },
      },
    });
    await this.sleep(500);

    // Test 2: List tools
    console.log("📝 Test 2: List available tools");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/list",
    });
    await this.sleep(500);

    // Test 3: List components
    console.log("📦 Test 3: List components");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: {
        name: "list_components",
        arguments: {},
      },
    });
    await this.sleep(1000);

    // Test 4: Get specific component
    console.log("🔍 Test 4: Get button component");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: {
        name: "get_component",
        arguments: { componentName: "button" },
      },
    });
    await this.sleep(1500);

    // Test 5: List blocks
    console.log("🧱 Test 5: List blocks");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: {
        name: "list_blocks",
        arguments: {},
      },
    });
    await this.sleep(1500);

    // Test 6: Test error handling
    console.log("⚠️  Test 6: Error handling (non-existent component)");
    await this.sendMessage({
      jsonrpc: "2.0",
      id: this.requestId++,
      method: "tools/call",
      params: {
        name: "get_component",
        arguments: { componentName: "nonexistent-component" },
      },
    });
    await this.sleep(1000);

    // Summary
    this.printSummary();
  }

  async sendMessage(message) {
    console.log(`📤 Sending:`, JSON.stringify(message, null, 2));
    this.serverProcess.stdin?.write(JSON.stringify(message) + "\n");
  }

  printSummary() {
    console.log("\n" + "=".repeat(60));
    console.log("📊 TEST SUMMARY");
    console.log("=".repeat(60));

    const successCount = this.responses.filter((r) => !r.error).length;
    const errorCount = this.responses.filter((r) => r.error).length;

    console.log(`✅ Successful responses: ${successCount}`);
    console.log(`❌ Error responses: ${errorCount}`);
    console.log(`📨 Total responses: ${this.responses.length}`);

    if (errorCount > 0) {
      console.log("\n❌ Errors encountered:");
      this.responses
        .filter((r) => r.error)
        .forEach((r) => {
          console.log(`  - ${r.error.code}: ${r.error.message}`);
        });
    }

    console.log("\n🎉 MCP Server appears to be working correctly!");
    console.log("\n💡 Next steps:");
    console.log("  1. Run: node scripts/test-cursor.js");
    console.log("  2. Follow the Cursor integration instructions");
    console.log(
      "  3. Test in Cursor by asking: 'List available shadcn components'"
    );
  }

  cleanup() {
    if (this.serverProcess) {
      this.serverProcess.kill();
      this.serverProcess = null;
    }
  }

  sleep(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}

// Handle interruption
process.on("SIGINT", () => {
  console.log("\n⚠️  Test interrupted by user");
  process.exit(0);
});

process.on("unhandledRejection", (reason, promise) => {
  console.error("Unhandled rejection at:", promise, "reason:", reason);
  process.exit(1);
});

// Run the test
const tester = new MCPTester();
tester.testServer().catch(console.error);
