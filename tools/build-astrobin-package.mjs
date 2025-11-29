#!/usr/bin/env node

/**
 * AstroBin Export Package Builder
 * 
 * This script creates a PixInsight update repository package for the AstroBin Export tool.
 * It:
 * 1. Copies required files to a staging directory with the proper PixInsight layout
 * 2. Creates a ZIP package
 * 3. Generates/updates the updates.xri file with correct metadata
 * 
 * Usage: node tools/build-astrobin-package.mjs [--version X.Y.Z]
 */

import fs from 'fs';
import path from 'path';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Configuration
const REPO_ROOT = path.resolve(__dirname, '..');
const SOURCE_DIR = path.join(REPO_ROOT, 'AstroBin Export');
const BUILD_DIR = path.join(REPO_ROOT, 'build', 'astrobin-temp');
const UPDATES_DIR = path.join(REPO_ROOT, 'updates');
const VERSION = process.argv.find(arg => arg.startsWith('--version='))?.split('=')[1] || '1.0.0';

// Files to include in the package
const JS_FILES = [
  'AstroBin_CSV_Export_v3_Modular.js',
  'AstroBin-core.js',
  'AstroBin-filter-database.js',
  'AstroBin-analysis.js',
  'AstroBin-gui.js',
  'AstroBin-gui-methods.js'
];

const RESOURCE_FILES = [
  'astrobin_filters.csv'
];

/**
 * Clean and create build directory
 */
function prepareBuildDirectory() {
  console.log('📁 Preparing build directory...');
  
  // Remove old build directory if it exists
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  
  // Create fresh directory structure
  const scriptsDir = path.join(BUILD_DIR, 'src', 'scripts', 'AstroBin');
  const resourcesDir = path.join(BUILD_DIR, 'rsc', 'AstroBin');
  
  fs.mkdirSync(scriptsDir, { recursive: true });
  fs.mkdirSync(resourcesDir, { recursive: true });
  
  console.log('✅ Build directory created');
  return { scriptsDir, resourcesDir };
}

/**
 * Copy source files to build directory
 */
function copySourceFiles(scriptsDir, resourcesDir) {
  console.log('📋 Copying source files...');
  
  let fileCount = 0;
  
  // Copy JavaScript files
  for (const file of JS_FILES) {
    const srcPath = path.join(SOURCE_DIR, file);
    const destPath = path.join(scriptsDir, file);
    
    if (!fs.existsSync(srcPath)) {
      console.error(`❌ Error: ${file} not found in source directory`);
      process.exit(1);
    }
    
    fs.copyFileSync(srcPath, destPath);
    fileCount++;
    console.log(`   ✓ ${file}`);
  }
  
  // Copy resource files
  for (const file of RESOURCE_FILES) {
    const srcPath = path.join(SOURCE_DIR, file);
    const destPath = path.join(resourcesDir, file);
    
    if (fs.existsSync(srcPath)) {
      fs.copyFileSync(srcPath, destPath);
      fileCount++;
      console.log(`   ✓ ${file}`);
    } else {
      console.log(`   ⚠ ${file} (optional, not found)`);
    }
  }
  
  console.log(`✅ Copied ${fileCount} files`);
}

/**
 * Create ZIP package using PowerShell
 */
function createZipPackage() {
  const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
  const zipName = `AstroBinExport-${VERSION}-${timestamp}.zip`;
  const zipPath = path.join(UPDATES_DIR, zipName);
  
  console.log(`📦 Creating ZIP package: ${zipName}...`);
  
  // Ensure updates directory exists
  if (!fs.existsSync(UPDATES_DIR)) {
    fs.mkdirSync(UPDATES_DIR, { recursive: true });
  }
  
  // Remove old zip if it exists
  if (fs.existsSync(zipPath)) {
    fs.unlinkSync(zipPath);
  }
  
  try {
    // Use PowerShell Compress-Archive
    const psCommand = `Compress-Archive -Path "${BUILD_DIR}\\*" -DestinationPath "${zipPath}" -Force`;
    execSync(psCommand, { 
      shell: 'powershell.exe',
      stdio: 'inherit'
    });
    
    console.log('✅ ZIP package created');
    return { zipName, zipPath };
  } catch (error) {
    console.error('❌ Error creating ZIP:', error.message);
    process.exit(1);
  }
}

/**
 * Calculate SHA1 hash of a file
 */
function calculateSHA1(filePath) {
  const fileBuffer = fs.readFileSync(filePath);
  const hashSum = createHash('sha1');
  hashSum.update(fileBuffer);
  return hashSum.digest('hex');
}

/**
 * Get file size in bytes
 */
function getFileSize(filePath) {
  return fs.statSync(filePath).size;
}

/**
 * Generate or update updates.xri file
 */
function updateXriFile(zipName, zipPath) {
  console.log('📝 Updating updates.xri...');
  
  const fileSize = getFileSize(zipPath);
  const sha1Hash = calculateSHA1(zipPath);
  const releaseDate = new Date().toISOString();
  
  console.log(`   File size: ${fileSize} bytes`);
  console.log(`   SHA1: ${sha1Hash}`);
  
  const xriContent = `<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
  <description>
    <p>
      PixInsight custom scripts update repository.
    </p>
    <p>
      This repository provides the AstroBin Export tool for generating CSV files
      compatible with AstroBin's bulk acquisition upload feature.
    </p>
  </description>

  <platform os="all" arch="noarch" version="1.8.0:">
    <package fileName="${zipName}"
             sha1="${sha1Hash}"
             type="script"
             releaseDate="${releaseDate}">
      <title>
        AstroBin Export
      </title>
      <description>
        <p>
          AstroBin CSV Export Tool v${VERSION}
        </p>
        <p>
          Generates CSV files compatible with AstroBin's bulk acquisition upload feature.
          Includes automatic FITS header analysis, comprehensive filter database (200+ filters),
          personal filter sets, selectable CSV columns, and more.
        </p>
        <p>
          <b>Key Features:</b>
        </p>
        <ul>
          <li>Automatic FITS header analysis</li>
          <li>200+ filters across 22+ manufacturers</li>
          <li>Personal LRGB + SHO filter set support</li>
          <li>Selectable/persistent CSV columns</li>
          <li>Improved SQM derivation</li>
          <li>Raw frame filtering</li>
          <li>Manual filter ID entry</li>
          <li>Bortle scale integration</li>
        </ul>
      </description>
    </package>
  </platform>
</xri>
`;
  
  const xriPath = path.join(UPDATES_DIR, 'updates.xri');
  fs.writeFileSync(xriPath, xriContent, 'utf8');
  
  console.log('✅ updates.xri updated');
  console.log(`\n📦 Package Details:`);
  console.log(`   Name: ${zipName}`);
  console.log(`   Version: ${VERSION}`);
  console.log(`   Size: ${(fileSize / 1024).toFixed(2)} KB`);
  console.log(`   SHA1: ${sha1Hash}`);
  console.log(`   Release: ${releaseDate}`);
}

/**
 * Clean up temporary build directory
 */
function cleanup() {
  console.log('\n🧹 Cleaning up...');
  if (fs.existsSync(BUILD_DIR)) {
    fs.rmSync(BUILD_DIR, { recursive: true, force: true });
  }
  console.log('✅ Cleanup complete');
}

/**
 * Main build process
 */
function main() {
  console.log('='.repeat(60));
  console.log('AstroBin Export Package Builder');
  console.log('='.repeat(60));
  console.log(`Version: ${VERSION}\n`);
  
  try {
    // Step 1: Prepare build directory
    const { scriptsDir, resourcesDir } = prepareBuildDirectory();
    
    // Step 2: Copy source files
    copySourceFiles(scriptsDir, resourcesDir);
    
    // Step 3: Create ZIP package
    const { zipName, zipPath } = createZipPackage();
    
    // Step 4: Update updates.xri
    updateXriFile(zipName, zipPath);
    
    // Step 5: Cleanup
    cleanup();
    
    console.log('\n' + '='.repeat(60));
    console.log('✅ BUILD SUCCESSFUL!');
    console.log('='.repeat(60));
    console.log('\n📍 Next Steps:');
    console.log('   1. Commit the new ZIP and updates.xri files');
    console.log('   2. Push to GitHub');
    console.log('   3. Test installation via PixInsight Update Repository');
    console.log('\n💡 Repository URL:');
    console.log('   https://raw.githubusercontent.com/<USERNAME>/<REPO>/main/updates/\n');
    
  } catch (error) {
    console.error('\n❌ BUILD FAILED:', error.message);
    cleanup();
    process.exit(1);
  }
}

// Run the build
main();
