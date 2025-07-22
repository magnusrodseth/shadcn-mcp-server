import axios, { type AxiosInstance } from "axios";
import { logger } from "../utils/logger";
import {
  type ComponentData,
  type BlockData,
  type ComponentSummary,
  type BlockSummary,
} from "../types/shadcn";

export class ShadcnService {
  private client: AxiosInstance;
  private cache = new Map<string, any>();
  private cacheTimeoutInMs = 1 * 60 * 60 * 1000; // 1 hour in milliseconds

  constructor(private githubToken?: string) {
    this.client = axios.create({
      baseURL: "https://api.github.com",
      headers: {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "shadcn-mcp-server",
        ...(githubToken && { Authorization: `token ${githubToken}` }),
      },
    });

    // Add response interceptor for rate limiting
    this.client.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 403) {
          logger.warn(
            "GitHub API rate limit exceeded. Consider adding a GitHub token."
          );
        }
        throw error;
      }
    );
  }

  private getCacheKey(operation: string, ...params: string[]): string {
    return `${operation}:${params.join(":")}`;
  }

  private getFromCache<T>(key: string): T | null {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const { data, timestamp } = cached;
    if (Date.now() - timestamp > this.cacheTimeoutInMs) {
      this.cache.delete(key);
      return null;
    }

    return data;
  }

  private setCache<T>(key: string, data: T): void {
    this.cache.set(key, { data, timestamp: Date.now() });
  }

  async getComponent(componentName: string): Promise<ComponentData> {
    const cacheKey = this.getCacheKey("component", componentName);
    const cached = this.getFromCache<ComponentData>(cacheKey);
    if (cached) return cached;

    logger.debug(`Fetching component: ${componentName}`);

    try {
      // Get component source from shadcn/ui repository
      const response = await this.client.get(
        `/repos/shadcn-ui/ui/contents/apps/www/registry/default/ui/${componentName}.tsx`
      );

      if (response.data.type !== "file") {
        throw new Error(`Component ${componentName} not found`);
      }

      const source = Buffer.from(response.data.content, "base64").toString(
        "utf-8"
      );

      // Parse dependencies from the source
      const dependencies = this.extractDependencies(source);

      // Get component description (you might want to parse this from docs or maintain a mapping)
      const description = `The ${componentName} component from shadcn/ui`;

      const componentData: ComponentData = {
        name: componentName,
        source,
        dependencies,
        description,
        path: response.data.path,
      };

      this.setCache(cacheKey, componentData);
      return componentData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(
          `Component '${componentName}' not found. Make sure the component name is correct.`
        );
      }
      throw error;
    }
  }

  async listComponents(category?: string): Promise<ComponentSummary[]> {
    const cacheKey = this.getCacheKey("list_components", category || "all");
    const cached = this.getFromCache<ComponentSummary[]>(cacheKey);
    if (cached) return cached;

    logger.debug(
      `Listing components${category ? ` in category: ${category}` : ""}`
    );

    try {
      // Get the UI directory contents
      const response = await this.client.get(
        "/repos/shadcn-ui/ui/contents/apps/www/registry/default/ui"
      );

      const components: ComponentSummary[] = response.data
        .filter(
          (item: any) => item.type === "file" && item.name.endsWith(".tsx")
        )
        .map((item: any) => ({
          name: item.name.replace(".tsx", ""),
          description: `The ${item.name.replace(".tsx", "")} component`,
          path: item.path,
        }));

      this.setCache(cacheKey, components);
      return components;
    } catch (error) {
      logger.error("Error listing components:", error);
      throw new Error("Failed to list components from shadcn/ui repository");
    }
  }

  async getBlock(blockName: string): Promise<BlockData> {
    const cacheKey = this.getCacheKey("block", blockName);
    const cached = this.getFromCache<BlockData>(cacheKey);
    if (cached) return cached;

    logger.debug(`Fetching block: ${blockName}`);

    try {
      // Blocks are typically in the blocks directory
      const response = await this.client.get(
        `/repos/shadcn-ui/ui/contents/apps/www/registry/default/blocks/${blockName}`
      );

      let source = "";
      let components: string[] = [];

      if (response.data.type === "dir") {
        // If it's a directory, look for the main component file
        const files = response.data;

        // Look for .tsx or .ts files, prioritizing page.tsx, component.tsx, or files with the blockName
        const mainFile =
          files.find(
            (f: any) =>
              f.type === "file" &&
              (f.name.endsWith(".tsx") || f.name.endsWith(".ts")) &&
              (f.name === "page.tsx" ||
                f.name === "component.tsx" ||
                f.name.includes(blockName))
          ) ||
          files.find(
            (f: any) =>
              f.type === "file" &&
              (f.name.endsWith(".tsx") || f.name.endsWith(".ts"))
          );

        if (mainFile) {
          const fileResponse = await this.client.get(
            `/repos/shadcn-ui/ui/contents/${mainFile.path}`
          );

          if (fileResponse.data.content) {
            source = Buffer.from(fileResponse.data.content, "base64").toString(
              "utf-8"
            );
          }
        }

        // If we still don't have source, try to look in subdirectories (like components/)
        if (!source) {
          const componentsDir = files.find(
            (f: any) => f.type === "dir" && f.name === "components"
          );
          if (componentsDir) {
            const componentsResponse = await this.client.get(
              `/repos/shadcn-ui/ui/contents/${componentsDir.path}`
            );

            const componentFile = componentsResponse.data.find(
              (f: any) =>
                f.type === "file" &&
                (f.name.endsWith(".tsx") || f.name.endsWith(".ts"))
            );

            if (componentFile) {
              const fileResponse = await this.client.get(
                `/repos/shadcn-ui/ui/contents/${componentFile.path}`
              );

              if (fileResponse.data.content) {
                source = Buffer.from(
                  fileResponse.data.content,
                  "base64"
                ).toString("utf-8");
              }
            }
          }
        }
      } else if (response.data.content) {
        source = Buffer.from(response.data.content, "base64").toString("utf-8");
      }

      if (!source) {
        throw new Error(
          `Block '${blockName}' not found. No suitable source file found in the block directory.`
        );
      }

      components = this.extractShadcnComponents(source);

      const blockData: BlockData = {
        name: blockName,
        source,
        components,
        description: `The ${blockName} block from shadcn/ui`,
        category: "general",
      };

      this.setCache(cacheKey, blockData);
      return blockData;
    } catch (error) {
      if (axios.isAxiosError(error) && error.response?.status === 404) {
        throw new Error(
          `Block '${blockName}' not found. Make sure the block name is correct.`
        );
      }

      throw error;
    }
  }

  async listBlocks(): Promise<BlockSummary[]> {
    const cacheKey = this.getCacheKey("list_blocks");
    const cached = this.getFromCache<BlockSummary[]>(cacheKey);
    if (cached) return cached;

    logger.debug("Listing blocks");

    try {
      const response = await this.client.get(
        "/repos/shadcn-ui/ui/contents/apps/www/registry/default/blocks"
      );

      const blocks: BlockSummary[] = response.data
        .filter((item: any) => item.type === "dir")
        .map((item: any) => ({
          name: item.name,
          description: `The ${item.name} block`,
          category: this.categorizeBlock(item.name),
        }));

      this.setCache(cacheKey, blocks);
      return blocks;
    } catch (error) {
      logger.error("Error listing blocks:", error);
      throw new Error("Failed to list blocks from shadcn/ui repository");
    }
  }

  private extractDependencies(source: string): string[] {
    const dependencies: string[] = [];

    // Extract import statements
    const importRegex = /import\s+.*?\s+from\s+['"]([^'"]+)['"]/g;
    let match;

    while ((match = importRegex.exec(source)) !== null) {
      const importPath = match[1];
      if (!importPath.startsWith(".") && !importPath.startsWith("@/")) {
        dependencies.push(importPath);
      }
    }

    return [...new Set(dependencies)]; // Remove duplicates
  }

  private extractShadcnComponents(source: string): string[] {
    const components: string[] = [];

    // Look for shadcn component imports
    const componentRegex =
      /import\s+.*?\s+from\s+['"]@\/components\/ui\/([^'"]+)['"]/g;
    let match;

    while ((match = componentRegex.exec(source)) !== null) {
      components.push(match[1]);
    }

    return [...new Set(components)];
  }

  private categorizeBlock(blockName: string): string {
    if (blockName.includes("dashboard")) return "dashboard";
    if (blockName.includes("login") || blockName.includes("auth"))
      return "authentication";
    if (blockName.includes("form")) return "forms";
    if (blockName.includes("chart") || blockName.includes("graph"))
      return "charts";
    if (blockName.includes("calendar")) return "calendar";
    if (blockName.includes("card")) return "cards";
    if (blockName.includes("table")) return "tables";
    return "general";
  }
}
