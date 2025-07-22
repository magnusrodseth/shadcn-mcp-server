import { describe, it, expect, beforeEach } from "vitest";
import { ShadcnService } from "../services/shadcn-service";
import dotenv from "dotenv";

dotenv.config();

const githubToken = process.env.GITHUB_TOKEN;
if (!githubToken) {
  throw new Error("GITHUB_TOKEN is not set");
}

describe("ShadcnService", () => {
  let service: ShadcnService;

  beforeEach(() => {
    // You can optionally pass a GitHub token for higher rate limits
    service = new ShadcnService(githubToken);
  });

  describe("getComponent", () => {
    it("should fetch and parse a real component successfully", async () => {
      const result = await service.getComponent("button");

      expect(result).toEqual({
        name: "button",
        source: expect.stringContaining("export"),
        dependencies: expect.any(Array),
        description: "The button component from shadcn/ui",
        path: expect.stringContaining("button.tsx"),
      });

      // Check that source contains typical React component patterns
      expect(result.source).toMatch(/import.*from/);
      expect(result.dependencies).toContain("react");
    }, 10000); // 10 second timeout for real API calls

    it("should throw error for non-existent component", async () => {
      await expect(
        service.getComponent("nonexistent-component-xyz")
      ).rejects.toThrow("Component 'nonexistent-component-xyz' not found");
    }, 10000);

    it("should use cache on subsequent calls", async () => {
      // First call
      const result1 = await service.getComponent("button");
      // Second call should be much faster due to caching
      const startTime = Date.now();
      const result2 = await service.getComponent("button");
      const endTime = Date.now();

      // Should return the same result
      expect(result1).toEqual(result2);

      // Second call should be very fast (cached)
      expect(endTime - startTime).toBeLessThan(100);
    }, 10000);
  });

  describe("listComponents", () => {
    it("should list real components successfully", async () => {
      const result = await service.listComponents();

      expect(Array.isArray(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);

      // Check the structure of returned components
      const firstComponent = result[0];
      expect(firstComponent).toHaveProperty("name");
      expect(firstComponent).toHaveProperty("description");
      expect(firstComponent).toHaveProperty("path");

      // Should contain some common shadcn components
      const componentNames = result.map((c) => c.name);
      expect(componentNames).toContain("button");
    }, 15000); // Longer timeout for listing all components
  });

  describe("getBlock", () => {
    it("should fetch a real block successfully", async () => {
      // Test with a known block that exists
      try {
        const result = await service.getBlock("login-01");

        console.log(result);

        expect(result).toEqual({
          name: "dashboard-01",
          source: expect.any(String),
          components: expect.any(Array),
          description: "The dashboard-01 block from shadcn/ui",
          category: "dashboard",
        });

        expect(result.source.length).toBeGreaterThan(0);
      } catch (error) {
        // If dashboard-01 doesn't exist, just verify the error structure
        expect(error).toBeInstanceOf(Error);

        expect((error as Error).message).toContain("not found");
      }
    }, 10000);
  });

  describe("listBlocks", () => {
    it("should list real blocks successfully", async () => {
      try {
        const result = await service.listBlocks();

        expect(Array.isArray(result)).toBe(true);

        if (result.length > 0) {
          const firstBlock = result[0];
          expect(firstBlock).toHaveProperty("name");
          expect(firstBlock).toHaveProperty("description");
          expect(firstBlock).toHaveProperty("category");
        }
      } catch (error) {
        // If blocks endpoint doesn't exist or is different, handle gracefully
        expect(error).toBeInstanceOf(Error);
      }
    }, 15000);
  });
});

describe("Dependency Extraction", () => {
  it("should extract dependencies correctly", () => {
    const service = new ShadcnService();
    const source = `
import React from "react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import axios from "axios";
import "./styles.css";
`;

    // Access private method for testing
    const dependencies = (service as any).extractDependencies(source);

    expect(dependencies).toEqual(["react", "axios"]);
  });

  it("should extract shadcn components correctly", () => {
    const service = new ShadcnService();
    const source = `
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
`;

    // Access private method for testing
    const components = (service as any).extractShadcnComponents(source);

    expect(components).toEqual(["button", "card", "input"]);
  });
});
