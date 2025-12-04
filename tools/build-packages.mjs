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
 * Validate the generated updates.xri file
 */
function validateUpdatesXri(xriPath, packages) {
  console.log('\n🔍 Validating updates.xri...');
  
  const errors = [];
  const warnings = [];
  
  // Read the XRI file
  if (!fs.existsSync(xriPath)) {
    errors.push('updates.xri file does not exist');
    return { valid: false, errors, warnings };
  }
  
  const xriContent = fs.readFileSync(xriPath, 'utf8');
  
  // Check 1: No BOM
  if (xriContent.charCodeAt(0) === 0xFEFF) {
    errors.push('File contains BOM (Byte Order Mark) - must be pure UTF-8');
  }
  
  // Check 2: Valid XML structure
  try {
    // Basic XML structure validation
    if (!xriContent.includes('<?xml version="1.0" encoding="UTF-8"?>')) {
      errors.push('Missing or incorrect XML declaration');
    }
    
    if (!xriContent.includes('<xri version="1.0">')) {
      errors.push('Missing <xri version="1.0"> root element');
    }
    
    if (!xriContent.includes('</xri>')) {
      errors.push('Missing </xri> closing tag');
    }
    
    if (!xriContent.includes('<platform ')) {
      errors.push('Missing <platform> element');
    }
  } catch (e) {
    errors.push(`XML structure error: ${e.message}`);
  }
  
  // Check 3: Validate all fileName attributes match actual files
  for (const pkg of packages) {
    const fileNamePattern = `fileName="${pkg.fileName}"`;
    if (!xriContent.includes(fileNamePattern)) {
      errors.push(`Package ${pkg.fileName} not found in updates.xri or filename mismatch`);
    }
    
    // Verify file exists on disk (case-sensitive)
    const actualPath = path.join(UPDATES_DIR, pkg.fileName);
    if (!fs.existsSync(actualPath)) {
      errors.push(`ZIP file referenced in XRI does not exist: ${pkg.fileName}`);
    } else {
      // Verify exact case match
      const dirFiles = fs.readdirSync(UPDATES_DIR);
      if (!dirFiles.includes(pkg.fileName)) {
        errors.push(`Case mismatch: ${pkg.fileName} not found with exact casing in updates/`);
      }
    }
  }
  
  // Check 4: Validate releaseDate format (digits only, YYYYMMDD or YYYYMMDDHHMM)
  for (const pkg of packages) {
    const releaseDatePattern = `releaseDate="${pkg.releaseDate}"`;
    if (!xriContent.includes(releaseDatePattern)) {
      errors.push(`Release date mismatch for ${pkg.fileName}`);
    }
    
    // Verify format is digits only
    if (!/^\d{8}(\d{4})?$/.test(pkg.releaseDate)) {
      errors.push(`Invalid releaseDate format for ${pkg.fileName}: ${pkg.releaseDate} (must be YYYYMMDD or YYYYMMDDHHMM)`);
    }
  }
  
  // Check 5: Validate platform version range
  const platformMatch = xriContent.match(/<platform[^>]+version="([^"]+)"/);
  if (platformMatch) {
    const versionRange = platformMatch[1];
    // Must be in format "MIN:MAX", not half-open like "1.8.0:"
    if (!versionRange.includes(':')) {
      errors.push(`Platform version range must include colon: ${versionRange}`);
    } else if (versionRange.endsWith(':')) {
      errors.push(`Platform version range must be fully specified (MIN:MAX), not half-open: ${versionRange}`);
    }
  } else {
    errors.push('Platform version attribute not found');
  }
  
  // Check 6: No trailing whitespace before closing tags
  const lines = xriContent.split('\n');
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    // Check for trailing spaces before >
    if (/ >/.test(line)) {
      warnings.push(`Line ${i + 1}: Trailing space before closing '>' - may cause parser issues`);
    }
    // Check for trailing whitespace at end of line
    if (/\s+$/.test(line)) {
      warnings.push(`Line ${i + 1}: Trailing whitespace at end of line`);
    }
  }
  
  // Check 7: All <package> elements are inside <platform>
  const platformStart = xriContent.indexOf('<platform');
  const platformEnd = xriContent.indexOf('</platform>');
  
  if (platformStart === -1 || platformEnd === -1) {
    errors.push('<platform> element not properly formed');
  } else {
    const packageMatches = [...xriContent.matchAll(/<package /g)];
    for (const match of packageMatches) {
      if (match.index < platformStart || match.index > platformEnd) {
        errors.push('<package> element found outside <platform> element');
      }
    }
  }
  
  // Check 8: Validate SHA1 format (40 hex characters)
  for (const pkg of packages) {
    if (!/^[a-f0-9]{40}$/.test(pkg.sha1)) {
      errors.push(`Invalid SHA1 hash format for ${pkg.fileName}: ${pkg.sha1}`);
    }
  }
  
  // Report results
  if (errors.length > 0) {
    console.log('   ❌ Validation FAILED:');
    errors.forEach(err => console.log(`      • ${err}`));
  }
  
  if (warnings.length > 0) {
    console.log('   ⚠️  Warnings:');
    warnings.forEach(warn => console.log(`      • ${warn}`));
  }
  
  if (errors.length === 0 && warnings.length === 0) {
    console.log('   ✅ Validation passed - updates.xri is valid');
  }
  
  return {
    valid: errors.length === 0,
    errors,
    warnings
  };
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
      // Ensure target directory exists for nested files
      const targetFileDir = path.dirname(targetPath);
      if (!fs.existsSync(targetFileDir)) {
        fs.mkdirSync(targetFileDir, { recursive: true });
      }
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
  
  // AUTO-DISCOVER: Read the actual filename from disk
  // This ensures case-sensitivity is correct
  const actualFiles = fs.readdirSync(UPDATES_DIR);
  const actualZipFile = actualFiles.find(f => f === zipFileName);
  
  if (!actualZipFile) {
    console.error(`   ❌ Error: ZIP file not found after creation: ${zipFileName}`);
    return null;
  }
  
  const actualZipPath = path.join(UPDATES_DIR, actualZipFile);
  
  // Calculate metadata using the actual discovered file
  const fileSize = fs.statSync(actualZipPath).size;
  const fileBuffer = fs.readFileSync(actualZipPath);
  const sha1 = createHash('sha1').update(fileBuffer).digest('hex');
  
  console.log(`   📊 Package size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`   🔐 SHA1: ${sha1}`);
  
  // Generate release date in strict YYYYMMDD format (digits only)
  const releaseDate = dateStamp;
  
  return {
    fileName: actualZipFile,  // Use the ACTUAL filename from disk
    filePath: actualZipPath,
    fileSize: fileSize,
    sha1: sha1,
    releaseDate: releaseDate,  // YYYYMMDD format
    project: projectConfig
  };
}

/**
 * Escape XML special characters
 */
function escapeXml(text) {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

/**
 * Generate updates.xri manifest with strict formatting
 */
function generateUpdatesXri(packages, repoConfig) {
  console.log('\n📝 Generating updates.xri manifest...');
  
  if (packages.length === 0) {
    console.log('   ⚠ No packages to include in manifest');
    return;
  }
  
  // Build package entries with NO trailing whitespace
  const packageEntries = [];
  
  for (const pkg of packages) {
    const featuresHtml = pkg.project.features
      .map(f => `          <li>${escapeXml(f)}</li>`)
      .join('\n');
    
    // Strict formatting: no trailing spaces, attributes on separate lines for clarity
    const packageXml = `    <package fileName="${pkg.fileName}"
             sha1="${pkg.sha1}"
             type="script"
             releaseDate="${pkg.releaseDate}">
      <title>
        ${escapeXml(pkg.project.name)}
      </title>
      <description>
        <p>
          ${escapeXml(pkg.project.name)} v${pkg.project.version}
        </p>
        <p>
          ${escapeXml(pkg.project.description)}
        </p>
        <p>
          <b>Key Features:</b>
        </p>
        <ul>
${featuresHtml}
        </ul>
      </description>
    </package>`;
    
    packageEntries.push(packageXml);
  }
  
  // Determine description based on number of packages
  let repoDescription;
  if (packages.length === 1) {
    repoDescription = `This repository provides the ${packages[0].project.name} tool.`;
  } else {
    const projectNames = packages.map(p => p.project.name).join(', ');
    repoDescription = `This repository provides multiple tools: ${projectNames}.`;
  }
  
  // Build complete XRI with strict version range format: "MIN:MAX"
  // PixInsight requires a fully-specified range, not half-open like "1.8.0:"
  const minVersion = repoConfig.minPixInsightVersion || '1.8.0';
  const maxVersion = '2.0.0'; // Conservative upper bound
  
  const xriContent = `<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
  <description>
    <p>
      ${escapeXml(repoConfig.name)}
    </p>
    <p>
      ${escapeXml(repoDescription)}
    </p>
  </description>

  <platform os="all" arch="noarch" version="${minVersion}:${maxVersion}">
${packageEntries.join('\n\n')}
  </platform>
</xri>
`;
  
  const xriPath = path.join(UPDATES_DIR, 'updates.xri');
  
  // Write with explicit UTF-8, no BOM
  fs.writeFileSync(xriPath, xriContent, { encoding: 'utf8' });
  
  console.log(`   ✅ Generated manifest with ${packages.length} package(s)`);
  console.log(`   📄 ${xriPath}`);
  
  return xriPath;
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
    const xriPath = generateUpdatesXri(packages, config.repository);
    
    // Validate the generated updates.xri
    const validation = validateUpdatesXri(xriPath, packages);
    
    if (!validation.valid) {
      console.error('\n❌ updates.xri validation failed!');
      console.error('The generated manifest contains errors that will cause PixInsight to reject it.');
      cleanup();
      process.exit(1);
    }
    
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
