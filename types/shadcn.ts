export interface ComponentData {
  name: string;
  source: string;
  dependencies: string[];
  description: string;
  path: string;
}

export interface ComponentSummary {
  name: string;
  description: string;
  path: string;
}

export interface BlockData {
  name: string;
  source: string;
  components: string[]; // shadcn components used in this block
  description: string;
  category: string;
}

export interface BlockSummary {
  name: string;
  description: string;
  category: string;
}

export interface GitHubFileResponse {
  type: "file" | "dir";
  name: string;
  path: string;
  content?: string; // base64 encoded
  download_url?: string;
}

export interface RateLimitInfo {
  limit: number;
  remaining: number;
  reset: number;
  used: number;
}
