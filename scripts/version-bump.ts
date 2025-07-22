#!/usr/bin/env tsx

import { program } from "commander";
import { readFileSync, writeFileSync } from "fs";
import { join } from "path";
import { createInterface } from "readline";
import { execSync } from "child_process";

interface PackageJson {
  name: string;
  version: string;
  [key: string]: any;
}

// Utility to read package.json
function readPackageJson(): PackageJson {
  const packagePath = join(process.cwd(), "package.json");
  const content = readFileSync(packagePath, "utf-8");
  return JSON.parse(content);
}

// Utility to write package.json
function writePackageJson(packageData: PackageJson): void {
  const packagePath = join(process.cwd(), "package.json");
  const content = JSON.stringify(packageData, null, 2) + "\n";
  writeFileSync(packagePath, content);
}

// Utility to update version in index.ts
function updateIndexVersion(newVersion: string): void {
  const indexPath = join(process.cwd(), "index.ts");
  let content = readFileSync(indexPath, "utf-8");

  // Update the version in the CLI configuration
  content = content.replace(
    /.version\("[\d.]+"\)/,
    `.version("${newVersion}")`
  );

  // Update the version in the server configuration
  content = content.replace(/version: "[\d.]+"/, `version: "${newVersion}"`);

  writeFileSync(indexPath, content);
}

// Utility to increment version
function incrementVersion(
  currentVersion: string,
  type: "patch" | "minor" | "major"
): string {
  const [major, minor, patch] = currentVersion.split(".").map(Number);

  switch (type) {
    case "patch":
      return `${major}.${minor}.${patch + 1}`;
    case "minor":
      return `${major}.${minor + 1}.0`;
    case "major":
      return `${major + 1}.0.0`;
    default:
      throw new Error(`Invalid version type: ${type}`);
  }
}

// Git utilities
function runGitCommand(command: string): string {
  try {
    return execSync(command, { encoding: "utf-8", stdio: "pipe" }).trim();
  } catch (error) {
    throw new Error(
      `Git command failed: ${command}\n${
        error instanceof Error ? error.message : error
      }`
    );
  }
}

function isGitRepo(): boolean {
  try {
    execSync("git rev-parse --git-dir", { stdio: "ignore" });
    return true;
  } catch {
    return false;
  }
}

function hasUncommittedChanges(): boolean {
  try {
    const status = runGitCommand("git status --porcelain");
    return status.length > 0;
  } catch {
    return false;
  }
}

function commitVersionChanges(version: string): void {
  runGitCommand("git add package.json index.ts");
  runGitCommand(`git commit -m "chore: bump version to ${version}"`);
}

function pushVersionChanges(): void {
  runGitCommand("git push");
}

function getCurrentBranch(): string {
  return runGitCommand("git branch --show-current");
}

// Interactive version selection
async function selectVersionType(): Promise<"patch" | "minor" | "major"> {
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    console.log("\nSelect version bump type:");
    console.log("1. Patch (x.x.X) - Bug fixes");
    console.log("2. Minor (x.X.0) - New features");
    console.log("3. Major (X.0.0) - Breaking changes");

    rl.question("\nEnter your choice (1-3): ", (answer) => {
      rl.close();

      switch (answer.trim()) {
        case "1":
          resolve("patch");
          break;
        case "2":
          resolve("minor");
          break;
        case "3":
          resolve("major");
          break;
        default:
          console.log("Invalid choice, defaulting to patch");
          resolve("patch");
      }
    });
  });
}

// Main function
async function main() {
  program
    .name("version-bump")
    .description("Bump version in package.json and related files")
    .version("1.0.0")
    .option("-t, --type <type>", "Version bump type (patch, minor, major)")
    .option(
      "-i, --interactive",
      "Interactive mode for selecting version type",
      true
    )
    .option("--dry-run", "Show what would be changed without making changes")
    .option("--no-git", "Skip Git operations (commit and push)")
    .option(
      "--no-push",
      "Skip pushing changes to remote (still commits locally)"
    )
    .option("--no-git-check", "Skip checking for uncommitted changes")
    .parse();

  const options = program.opts();

  try {
    // Check Git status if not disabled
    if (!options.noGitCheck && isGitRepo()) {
      if (hasUncommittedChanges()) {
        console.log(
          "⚠️  You have uncommitted changes. This script will commit the version changes automatically."
        );
        console.log("Current uncommitted changes:");
        try {
          const status = runGitCommand("git status --short");
          console.log(status);
        } catch (error) {
          console.log("Unable to show git status");
        }
        console.log();
      }
    }

    // Read current package.json
    const packageData = readPackageJson();
    const currentVersion = packageData.version;

    console.log(`Current version: ${currentVersion}`);

    // Determine version type
    let versionType: "patch" | "minor" | "major";

    if (options.type) {
      if (!["patch", "minor", "major"].includes(options.type)) {
        throw new Error(
          `Invalid version type: ${options.type}. Use patch, minor, or major.`
        );
      }
      versionType = options.type;
    } else if (options.interactive) {
      versionType = await selectVersionType();
    } else {
      versionType = "patch"; // Default
    }

    // Calculate new version
    const newVersion = incrementVersion(currentVersion, versionType);

    console.log(
      `\nBumping ${versionType} version: ${currentVersion} → ${newVersion}`
    );

    if (options.dryRun) {
      console.log("\n[DRY RUN] Would update:");
      console.log(`- package.json version: ${currentVersion} → ${newVersion}`);
      console.log(
        `- index.ts version references: ${currentVersion} → ${newVersion}`
      );
      if (!options.noGit && isGitRepo()) {
        console.log(`- Git commit: "chore: bump version to ${newVersion}"`);
        if (!options.noPush) {
          try {
            const currentBranch = getCurrentBranch();
            console.log(`- Git push to remote (${currentBranch})`);
          } catch {
            console.log("- Git push to remote (branch info unavailable)");
          }
        }
      }
      return;
    }

    // Update package.json
    packageData.version = newVersion;
    writePackageJson(packageData);
    console.log(`✅ Updated package.json version to ${newVersion}`);

    // Update index.ts
    updateIndexVersion(newVersion);
    console.log(`✅ Updated index.ts version references to ${newVersion}`);

    // Commit and push changes if Git is available and not disabled
    if (!options.noGit && isGitRepo()) {
      try {
        commitVersionChanges(newVersion);
        console.log(`✅ Committed version changes to Git`);

        // Push changes to remote if not disabled
        if (!options.noPush) {
          try {
            const currentBranch = getCurrentBranch();
            pushVersionChanges();
            console.log(`✅ Pushed changes to remote (${currentBranch})`);
          } catch (error) {
            console.warn(
              `⚠️  Failed to push changes: ${
                error instanceof Error ? error.message : error
              }`
            );
            console.log(
              "The commit was successful, but you may need to push manually."
            );
            console.log("Run: git push");
          }
        }
      } catch (error) {
        console.warn(
          `⚠️  Failed to commit changes: ${
            error instanceof Error ? error.message : error
          }`
        );
        console.log("You may need to commit the changes manually.");
      }
    }

    console.log(`\n🎉 Version successfully bumped to ${newVersion}`);

    if (!options.noGit && isGitRepo()) {
      if (!options.noPush) {
        console.log(
          "Ready to publish! The version changes have been committed and pushed."
        );
      } else {
        console.log(
          "Ready to publish! The version changes have been committed locally."
        );
        console.log("Don't forget to push: git push");
      }
    } else {
      console.log(
        "You can now run 'pnpm run package:publish' to publish the new version."
      );
    }
  } catch (error) {
    console.error(
      "❌ Error bumping version:",
      error instanceof Error ? error.message : error
    );
    process.exit(1);
  }
}

main().catch((error) => {
  console.error("❌ Unexpected error:", error);
  process.exit(1);
});
