#!/usr/bin/env node

/**
 * PixInsight Multi-Project Package Builder
 * 
 * This script builds PixInsight update repository packages for all "ready" projects
 * defined in packaging.config.json. It:
 * 
 * 1. Reads the packaging configuration
 * 2. Builds ZIP packages for each ready project
 * 3. Generates a unified updates.xri manifest
 * 4. Cleans up temporary files
 * 
 * Usage: npm run build:packages
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import AdmZip from 'adm-zip';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Paths
const REPO_ROOT = path.resolve(__dirname, '..');
const CONFIG_PATH = path.join(REPO_ROOT, 'packaging.config.json');
const UPDATES_DIR = path.join(REPO_ROOT, 'updates');
const TEMP_DIR = path.join(UPDATES_DIR, 'tmp');

/**
 * Load and validate packaging configuration
 */
function loadConfiguration() {
  console.log('📋 Loading packaging configuration...');
  
  if (!fs.existsSync(CONFIG_PATH)) {
    console.error(`❌ Error: Configuration file not found at ${CONFIG_PATH}`);
    process.exit(1);
  }
  
  const configContent = fs.readFileSync(CONFIG_PATH, 'utf8');
  const config = JSON.parse(configContent);
  
  console.log(`✅ Configuration loaded: ${Object.keys(config.projects).length} projects defined`);
  return config;
}

/**
 * Ensure directories exist
 */
function ensureDirectories() {
  console.log('📁 Ensuring directory structure...');
  
  if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
    console.log(`   Created: ${UPDATES_DIR}`);
  }
  
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
  }
  fs.mkdirSync(TEMP_DIR, { recursive: true });
  
  console.log('✅ Directories ready');
}

/**
 * Get current date stamp in YYYYMMDD format
 */
function getDateStamp() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}${month}${day}`;
}

/**
 * Copy files recursively, excluding specified patterns
 */
function copyFiles(sourceDir, targetDir, files, excludePatterns = []) {
  let copiedCount = 0;
  
  for (const file of files) {
    const sourcePath = path.join(sourceDir, file);
    
    if (!fs.existsSync(sourcePath)) {
      console.log(`   ⚠ Skipping missing file: ${file}`);
      continue;
    }
    
    const stat = fs.statSync(sourcePath);
    const targetPath = path.join(targetDir, file);
    
    if (stat.isDirectory()) {
      // Skip excluded directories
      const baseName = path.basename(file);
      if (excludePatterns.includes(baseName)) {
        console.log(`   ⊗ Excluding directory: ${file}`);
        continue;
      }
      
      // Copy directory recursively
      fs.mkdirSync(targetPath, { recursive: true });
      const dirFiles = fs.readdirSync(sourcePath);
      const subFiles = dirFiles.map(f => path.join(file, f));
      copiedCount += copyFiles(sourceDir, targetDir, subFiles, excludePatterns);
    } else {
      // Copy file
      const targetFileDir = path.dirname(targetPath);
      if (!fs.existsSync(targetFileDir)) {
        fs.mkdirSync(targetFileDir, { recursive: true });
      }
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
    }
  }
  
  return copiedCount;
}

/**
 * Build a package for a single project
 */
function buildProjectPackage(projectKey, projectConfig) {
  console.log(`\n📦 Building package: ${projectConfig.name}`);
  console.log(`   Version: ${projectConfig.version}`);
  
  const dateStamp = getDateStamp();
  const zipFileName = `${projectConfig.zipNamePrefix}-${projectConfig.version}-${dateStamp}.zip`;
  const zipPath = path.join(UPDATES_DIR, zipFileName);
  
  // Create temp staging directory for this project
  const projectTempDir = path.join(TEMP_DIR, projectKey);
  fs.mkdirSync(projectTempDir, { recursive: true });
  
  // Create PixInsight directory structure
  const scriptsDir = path.join(projectTempDir, projectConfig.piScriptRoot);
  const resourcesDir = path.join(projectTempDir, projectConfig.piResourceRoot);
  
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  
  // Source directory
  const sourceDir = path.join(REPO_ROOT, projectConfig.sourceDir);
  
  if (!fs.existsSync(sourceDir)) {
    console.error(`   ❌ Error: Source directory not found: ${sourceDir}`);
    return null;
  }
  
  // Copy script files
  console.log('   📝 Copying script files...');
  let copiedCount = 0;
  
  for (const scriptFile of projectConfig.files.scripts) {
    const sourcePath = path.join(sourceDir, scriptFile);
    const targetPath = path.join(scriptsDir, scriptFile);
    
    if (fs.existsSync(sourcePath)) {
      fs.copyFileSync(sourcePath, targetPath);
      copiedCount++;
      console.log(`      ✓ ${scriptFile}`);
    } else {
      console.log(`      ⚠ Missing: ${scriptFile}`);
    }
  }
  
  // Copy resource files
  if (projectConfig.files.resources.length > 0) {
    console.log('   📁 Copying resource files...');
    
    for (const resourceFile of projectConfig.files.resources) {
      const sourcePath = path.join(sourceDir, resourceFile);
      const targetPath = path.join(resourcesDir, path.basename(resourceFile));
      
      if (fs.existsSync(sourcePath)) {
        const targetFileDir = path.dirname(targetPath);
        if (!fs.existsSync(targetFileDir)) {
          fs.mkdirSync(targetFileDir, { recursive: true });
        }
        fs.copyFileSync(sourcePath, targetPath);
        copiedCount++;
        console.log(`      ✓ ${resourceFile}`);
      } else {
        console.log(`      ⚠ Missing: ${resourceFile}`);
      }
    }
  }
  
  console.log(`   ✅ Copied ${copiedCount} files`);
  
  // Create ZIP package
  console.log(`   🗜️  Creating ZIP: ${zipFileName}...`);
  
  try {
    const zip = new AdmZip();
    
    // Add all contents from the temp directory
    // This ensures the ZIP structure starts with src/ and rsc/
    const addDirectoryRecursive = (dirPath, zipPath = '') => {
      const items = fs.readdirSync(dirPath);
      
      for (const item of items) {
        const itemPath = path.join(dirPath, item);
        const itemZipPath = zipPath ? `${zipPath}/${item}` : item;
        const stat = fs.statSync(itemPath);
        
        if (stat.isDirectory()) {
          addDirectoryRecursive(itemPath, itemZipPath);
        } else {
          zip.addLocalFile(itemPath, zipPath);
        }
      }
    };
    
    addDirectoryRecursive(projectTempDir);
    
    // Remove old ZIP if it exists
    if (fs.existsSync(zipPath)) {
      fs.unlinkSync(zipPath);
    }
    
    zip.writeZip(zipPath);
    console.log('   ✅ ZIP created successfully');
    
  } catch (error) {
    console.error(`   ❌ Error creating ZIP: ${error.message}`);
    return null;
  }
  
  // Calculate metadata
  const fileSize = fs.statSync(zipPath).size;
  const fileBuffer = fs.readFileSync(zipPath);
  const sha1 = createHash('sha1').update(fileBuffer).digest('hex');
  
  console.log(`   📊 Package size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`   🔐 SHA1: ${sha1}`);
  
  return {
    fileName: zipFileName,
    filePath: zipPath,
    fileSize: fileSize,
    sha1: sha1,
    releaseDate: new Date().toISOString(),
    project: projectConfig
  };
}

/**
 * Generate updates.xri manifest
 */
function generateUpdatesXri(packages, repoConfig) {
  console.log('\n📝 Generating updates.xri manifest...');
  
  if (packages.length === 0) {
    console.log('   ⚠ No packages to include in manifest');
    return;
  }
  
  // Build package entries
  let packageEntries = '';
  
  for (const pkg of packages) {
    const featuresHtml = pkg.project.features
      .map(f => `          <li>${f}</li>`)
      .join('\n');
    
    packageEntries += `
    <package fileName="${pkg.fileName}"
             sha1="${pkg.sha1}"
             type="script"
             releaseDate="${pkg.releaseDate}">
      <title>
        ${pkg.project.name}
      </title>
      <description>
        <p>
          ${pkg.project.name} v${pkg.project.version}
        </p>
        <p>
          ${pkg.project.description}
        </p>
        <p>
          <b>Key Features:</b>
        </p>
        <ul>
${featuresHtml}
        </ul>
      </description>
    </package>
`;
  }
  
  // Determine description based on number of packages
  let repoDescription;
  if (packages.length === 1) {
    repoDescription = `This repository provides the ${packages[0].project.name} tool.`;
  } else {
    const projectNames = packages.map(p => p.project.name).join(', ');
    repoDescription = `This repository provides multiple tools: ${projectNames}.`;
  }
  
  // Build complete XRI
  const xriContent = `<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
  <description>
    <p>
      ${repoConfig.name}
    </p>
    <p>
      ${repoDescription}
    </p>
  </description>

  <platform os="all" arch="noarch" version="${repoConfig.minPixInsightVersion}:">
${packageEntries}
  </platform>
</xri>
`;
  
  const xriPath = path.join(UPDATES_DIR, 'updates.xri');
  fs.writeFileSync(xriPath, xriContent, 'utf8');
  
  console.log(`   ✅ Generated manifest with ${packages.length} package(s)`);
  console.log(`   📄 ${xriPath}`);
}

/**
 * Clean up temporary files
 */
function cleanup() {
  console.log('\n🧹 Cleaning up temporary files...');
  
  if (fs.existsSync(TEMP_DIR)) {
    fs.rmSync(TEMP_DIR, { recursive: true, force: true });
    console.log('   ✅ Cleanup complete');
  }
}

/**
 * Clean up old ZIP files (keep only the latest for each project)
 */
function cleanupOldZips(currentPackages) {
  console.log('\n🗑️  Cleaning up old package files...');
  
  const currentFileNames = new Set(currentPackages.map(p => p.fileName));
  const allFiles = fs.readdirSync(UPDATES_DIR);
  
  let removedCount = 0;
  for (const file of allFiles) {
    if (file.endsWith('.zip') && !currentFileNames.has(file)) {
      const filePath = path.join(UPDATES_DIR, file);
      fs.unlinkSync(filePath);
      console.log(`   🗑️  Removed: ${file}`);
      removedCount++;
    }
  }
  
  if (removedCount === 0) {
    console.log('   ✅ No old files to remove');
  } else {
    console.log(`   ✅ Removed ${removedCount} old package(s)`);
  }
}

/**
 * Main build process
 */
function main() {
  console.log('='.repeat(70));
  console.log('PixInsight Multi-Project Package Builder');
  console.log('='.repeat(70));
  console.log('');
  
  try {
    // Load configuration
    const config = loadConfiguration();
    
    // Ensure directory structure
    ensureDirectories();
    
    // Find ready projects
    const readyProjects = Object.entries(config.projects)
      .filter(([key, proj]) => proj.ready === true);
    
    const notReadyProjects = Object.entries(config.projects)
      .filter(([key, proj]) => proj.ready !== true);
    
    console.log(`\n📌 Project Status:`);
    console.log(`   Ready: ${readyProjects.length}`);
    for (const [key, proj] of readyProjects) {
      console.log(`      ✓ ${proj.name} (v${proj.version})`);
    }
    
    if (notReadyProjects.length > 0) {
      console.log(`   Not Ready: ${notReadyProjects.length}`);
      for (const [key, proj] of notReadyProjects) {
        console.log(`      ⊗ ${proj.name} (v${proj.version}) - skipped`);
      }
    }
    
    if (readyProjects.length === 0) {
      console.log('\n⚠️  No projects marked as ready. Nothing to build.');
      cleanup();
      return;
    }
    
    // Build packages for ready projects
    const packages = [];
    
    for (const [projectKey, projectConfig] of readyProjects) {
      const packageInfo = buildProjectPackage(projectKey, projectConfig);
      if (packageInfo) {
        packages.push(packageInfo);
      }
    }
    
    if (packages.length === 0) {
      console.error('\n❌ No packages were built successfully');
      cleanup();
      process.exit(1);
    }
    
    // Generate updates.xri
    generateUpdatesXri(packages, config.repository);
    
    // Clean up old ZIPs
    cleanupOldZips(packages);
    
    // Clean up temp directory
    cleanup();
    
    // Success summary
    console.log('\n' + '='.repeat(70));
    console.log('✅ BUILD SUCCESSFUL!');
    console.log('='.repeat(70));
    console.log(`\n📦 Built ${packages.length} package(s):`);
    
    for (const pkg of packages) {
      console.log(`   • ${pkg.fileName}`);
      console.log(`     Size: ${(pkg.fileSize / 1024).toFixed(2)} KB`);
      console.log(`     SHA1: ${pkg.sha1}`);
    }
    
    console.log('\n📍 Next Steps:');
    console.log('   1. Review the generated packages in updates/');
    console.log('   2. Commit the changes: git add updates/');
    console.log('   3. Push to GitHub: git push origin main');
    console.log('   4. Test in PixInsight using the repository URL');
    console.log('');
    
  } catch (error) {
    console.error('\n❌ BUILD FAILED:', error.message);
    console.error(error.stack);
    cleanup();
    process.exit(1);
  }
}

// Run the build
main();
