/*
 * SNRAnalysis-core.js
 * Core configuration, utilities, and Settings persistence
 * 
 * MODULE SCOPE HYGIENE NOTES:
 * This module is loaded via PJSR #include, which shares global scope.
 * The following globals are INTENTIONAL and required for cross-module access:
 *   - CONFIG: Shared configuration object (read/written by UI and processing modules)
 *   - SCRIPT_NAME, SCRIPT_VERSION: Metadata constants
 *   - SNR_SETTINGS_MODULE: Settings namespace constant
 *   - Helper functions: loadSettings, saveSettings, formatTime, closeImageWindow, etc.
 * 
 * All other variables should be scoped to functions to avoid pollution.
 * Entry point (main script) uses "use strict" + IIFE wrapper to catch accidental globals.
 */

var SCRIPT_NAME = "SNR Analysis";
var SCRIPT_VERSION = "1.6.6";  // Bumped for hygiene improvements
var SCRIPT_DESCRIPTION = "Analyzes how SNR improves with integration depth by creating partial integrations and measuring SNR in user-defined ROIs.";

// Settings module ID (unique to avoid conflicts with other tools)
var SNR_SETTINGS_MODULE = "SNRAnalysisSettings";
var SETTINGS_VERSION = 1;

// Supported file extensions
var FILE_EXTS = [".xisf", ".fits", ".fit", ".fts"];

/**
 * Global configuration object
 * Stores all user preferences and analysis parameters
 */
var CONFIG = {
   // Input
   inputDir: "",
   filePattern: "*_c_r.xisf;*_c_r.fits",  // Default to calibrated and registered files
   analyzeAllFilters: true,  // If true, group by FILTER header and analyze each separately
   
   // ROI Mode
   roiMode: "rangeMask",  // "rangeMask" (default), "auto", or "manual" - how to define BG/FG regions
   autoRoiTileSize: 96,  // Tile size for auto ROI detection
   saveDebugOverlay: false,  // Save debug overlay for range mask mode
   
   // Depth strategy
   depthStrategy: "preset_osc",  // preset_osc, doubling, fibonacci, logarithmic, custom
   customDepths: "",  // comma-separated list for custom mode
   includeFullDepth: true, // Always add a full-depth stack (all subs)
   
   // Star removal (required)
   generateStarless: true,
   starRemovalMethod: "StarNet2",  // StarNet2, StarXTerminator
   starRemovalLinear: true,  // Assume linear data (true for integrated stacks)
   starRemovalStrength: 0.70,  // Strength parameter (0.0-1.0) for StarXTerminator unscreen_correction
   
   // Integration rejection settings (WBPP-style)
   rejectionAlgorithm: "Auto",  // Auto, PercentileClip, WinsorizedSigmaClip, LinearFit, ESD
   percentileLow: 0.27,
   percentileHigh: 0.13,
   sigmaLow: 4.00,
   sigmaHigh: 3.00,
   linearFitLow: 5.00,
   linearFitHigh: 2.50,
   
   // Stretch
   applyStretch: false,
   
   // Signal normalization
   lockSignalScale: true,  // Background-normalize all depths to fix SNR scaling (recommended)
   
   // Output
   outputDir: "",
   outputCSV: true,
   outputJSON: true,
   generateGraph: true,
   generateInsights: true,
   logTimings: true,
   keepIntermediateImages: false,
   
   // Output structure (set automatically)
   baseAnalysisDir: "",    // [outputDir]/SNRAnalysis/
   dataDir: "",             // [baseAnalysisDir]/data/
   graphsDir: "",           // [baseAnalysisDir]/graphs/
   integrationsDir: "",     // [baseAnalysisDir]/integrations/
   previewsDir: ""          // [baseAnalysisDir]/previews/
};

/**
 * Load settings from PixInsight Settings API
 */
function loadSettings() {
   try {
      var init = Settings.read(SNR_SETTINGS_MODULE + "/_initialized", DataType_UInt32);
      if (!Settings.lastReadOK || init !== SETTINGS_VERSION) {
         // First run or version mismatch - use defaults
         return;
      }
      
      // Input settings
      var dir = Settings.read(SNR_SETTINGS_MODULE + "/inputDir", DataType_String);
      if (Settings.lastReadOK) CONFIG.inputDir = dir;
      
      var pattern = Settings.read(SNR_SETTINGS_MODULE + "/filePattern", DataType_String);
      if (Settings.lastReadOK) CONFIG.filePattern = pattern;
      
      var analyzeAll = Settings.read(SNR_SETTINGS_MODULE + "/analyzeAllFilters", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.analyzeAllFilters = analyzeAll;
      
      // ROI Mode
      var roiMode = Settings.read(SNR_SETTINGS_MODULE + "/roiMode", DataType_String);
      if (Settings.lastReadOK) CONFIG.roiMode = roiMode;
      
      var tileSize = Settings.read(SNR_SETTINGS_MODULE + "/autoRoiTileSize", DataType_UInt32);
      if (Settings.lastReadOK) CONFIG.autoRoiTileSize = tileSize;
      
      var debugOverlay = Settings.read(SNR_SETTINGS_MODULE + "/saveDebugOverlay", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.saveDebugOverlay = debugOverlay;
      
      // Depth strategy
      var strategy = Settings.read(SNR_SETTINGS_MODULE + "/depthStrategy", DataType_String);
      if (Settings.lastReadOK) CONFIG.depthStrategy = strategy;
      
      var custom = Settings.read(SNR_SETTINGS_MODULE + "/customDepths", DataType_String);
      if (Settings.lastReadOK) CONFIG.customDepths = custom;
      
      var includeFullDepth = Settings.read(SNR_SETTINGS_MODULE + "/includeFullDepth", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.includeFullDepth = includeFullDepth;
      
      // Star removal
      var starless = Settings.read(SNR_SETTINGS_MODULE + "/generateStarless", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.generateStarless = starless;
      // Enforce starless processing for SNR fidelity
      CONFIG.generateStarless = true;
      
      var method = Settings.read(SNR_SETTINGS_MODULE + "/starRemovalMethod", DataType_String);
      if (Settings.lastReadOK) CONFIG.starRemovalMethod = method;
      
      var linear = Settings.read(SNR_SETTINGS_MODULE + "/starRemovalLinear", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.starRemovalLinear = linear;
      
      var strength = Settings.read(SNR_SETTINGS_MODULE + "/starRemovalStrength", DataType_Double);
      if (Settings.lastReadOK) CONFIG.starRemovalStrength = strength;
      
      // Signal normalization
      var lockScale = Settings.read(SNR_SETTINGS_MODULE + "/lockSignalScale", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.lockSignalScale = lockScale;
      
      // Rejection algorithm settings
      var rejAlgo = Settings.read(SNR_SETTINGS_MODULE + "/rejectionAlgorithm", DataType_String);
      if (Settings.lastReadOK) CONFIG.rejectionAlgorithm = rejAlgo;
      
      var pctLow = Settings.read(SNR_SETTINGS_MODULE + "/percentileLow", DataType_Double);
      if (Settings.lastReadOK) CONFIG.percentileLow = pctLow;
      
      var pctHigh = Settings.read(SNR_SETTINGS_MODULE + "/percentileHigh", DataType_Double);
      if (Settings.lastReadOK) CONFIG.percentileHigh = pctHigh;
      
      var sigLow = Settings.read(SNR_SETTINGS_MODULE + "/sigmaLow", DataType_Double);
      if (Settings.lastReadOK) CONFIG.sigmaLow = sigLow;
      
      var sigHigh = Settings.read(SNR_SETTINGS_MODULE + "/sigmaHigh", DataType_Double);
      if (Settings.lastReadOK) CONFIG.sigmaHigh = sigHigh;
      
      var linLow = Settings.read(SNR_SETTINGS_MODULE + "/linearFitLow", DataType_Double);
      if (Settings.lastReadOK) CONFIG.linearFitLow = linLow;
      
      var linHigh = Settings.read(SNR_SETTINGS_MODULE + "/linearFitHigh", DataType_Double);
      if (Settings.lastReadOK) CONFIG.linearFitHigh = linHigh;
      
      // Stretch
      var stretch = Settings.read(SNR_SETTINGS_MODULE + "/applyStretch", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.applyStretch = stretch;
      
      // Output
      var outDir = Settings.read(SNR_SETTINGS_MODULE + "/outputDir", DataType_String);
      if (Settings.lastReadOK) CONFIG.outputDir = outDir;
      
      var csv = Settings.read(SNR_SETTINGS_MODULE + "/outputCSV", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.outputCSV = csv;
      
      var json = Settings.read(SNR_SETTINGS_MODULE + "/outputJSON", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.outputJSON = json;
      
      var graph = Settings.read(SNR_SETTINGS_MODULE + "/generateGraph", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.generateGraph = graph;
      
      var insights = Settings.read(SNR_SETTINGS_MODULE + "/generateInsights", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.generateInsights = insights;
      
      var timings = Settings.read(SNR_SETTINGS_MODULE + "/logTimings", DataType_Boolean);
      if (Settings.lastReadOK) CONFIG.logTimings = timings;
      
   } catch (error) {
      Console.warningln("Failed to load settings: " + error.message);
   }
}

/**
 * Save settings to PixInsight Settings API
 */
function saveSettings() {
   try {
      Settings.write(SNR_SETTINGS_MODULE + "/_initialized", DataType_UInt32, SETTINGS_VERSION);
      
      // Input
      Settings.write(SNR_SETTINGS_MODULE + "/inputDir", DataType_String, CONFIG.inputDir);
      Settings.write(SNR_SETTINGS_MODULE + "/filePattern", DataType_String, CONFIG.filePattern);
      Settings.write(SNR_SETTINGS_MODULE + "/analyzeAllFilters", DataType_Boolean, CONFIG.analyzeAllFilters);
      
      // ROI Mode
      Settings.write(SNR_SETTINGS_MODULE + "/roiMode", DataType_String, CONFIG.roiMode);
      Settings.write(SNR_SETTINGS_MODULE + "/autoRoiTileSize", DataType_UInt32, CONFIG.autoRoiTileSize);
      Settings.write(SNR_SETTINGS_MODULE + "/saveDebugOverlay", DataType_Boolean, CONFIG.saveDebugOverlay);
      
      // Depth strategy
      Settings.write(SNR_SETTINGS_MODULE + "/depthStrategy", DataType_String, CONFIG.depthStrategy);
      Settings.write(SNR_SETTINGS_MODULE + "/customDepths", DataType_String, CONFIG.customDepths);
      Settings.write(SNR_SETTINGS_MODULE + "/includeFullDepth", DataType_Boolean, CONFIG.includeFullDepth);
      
      // Star removal
      Settings.write(SNR_SETTINGS_MODULE + "/generateStarless", DataType_Boolean, CONFIG.generateStarless);
      Settings.write(SNR_SETTINGS_MODULE + "/starRemovalMethod", DataType_String, CONFIG.starRemovalMethod);
      Settings.write(SNR_SETTINGS_MODULE + "/starRemovalLinear", DataType_Boolean, CONFIG.starRemovalLinear);
      Settings.write(SNR_SETTINGS_MODULE + "/starRemovalStrength", DataType_Double, CONFIG.starRemovalStrength);
      
      // Signal normalization
      Settings.write(SNR_SETTINGS_MODULE + "/lockSignalScale", DataType_Boolean, CONFIG.lockSignalScale);
      
      // Rejection algorithm settings
      Settings.write(SNR_SETTINGS_MODULE + "/rejectionAlgorithm", DataType_String, CONFIG.rejectionAlgorithm);
      Settings.write(SNR_SETTINGS_MODULE + "/percentileLow", DataType_Double, CONFIG.percentileLow);
      Settings.write(SNR_SETTINGS_MODULE + "/percentileHigh", DataType_Double, CONFIG.percentileHigh);
      Settings.write(SNR_SETTINGS_MODULE + "/sigmaLow", DataType_Double, CONFIG.sigmaLow);
      Settings.write(SNR_SETTINGS_MODULE + "/sigmaHigh", DataType_Double, CONFIG.sigmaHigh);
      Settings.write(SNR_SETTINGS_MODULE + "/linearFitLow", DataType_Double, CONFIG.linearFitLow);
      Settings.write(SNR_SETTINGS_MODULE + "/linearFitHigh", DataType_Double, CONFIG.linearFitHigh);
      
      // Stretch
      Settings.write(SNR_SETTINGS_MODULE + "/applyStretch", DataType_Boolean, CONFIG.applyStretch);
      
      // Output
      Settings.write(SNR_SETTINGS_MODULE + "/outputDir", DataType_String, CONFIG.outputDir);
      Settings.write(SNR_SETTINGS_MODULE + "/outputCSV", DataType_Boolean, CONFIG.outputCSV);
      Settings.write(SNR_SETTINGS_MODULE + "/outputJSON", DataType_Boolean, CONFIG.outputJSON);
      Settings.write(SNR_SETTINGS_MODULE + "/generateGraph", DataType_Boolean, CONFIG.generateGraph);
      Settings.write(SNR_SETTINGS_MODULE + "/generateInsights", DataType_Boolean, CONFIG.generateInsights);
      Settings.write(SNR_SETTINGS_MODULE + "/logTimings", DataType_Boolean, CONFIG.logTimings);
      
   } catch (error) {
      Console.warningln("Failed to save settings: " + error.message);
   }
}

/**
 * Utility: Format time in seconds to human-readable string
 */
function formatTime(seconds) {
   var h = Math.floor(seconds / 3600);
   var m = Math.floor((seconds % 3600) / 60);
   var s = Math.floor(seconds % 60);
   
   if (h > 0) {
      return h + "h " + m + "m " + s + "s";
   } else if (m > 0) {
      return m + "m " + s + "s";
   } else {
      return s + "s";
   }
}

/**
 * Utility: Format rectangle for display
 */
function formatRect(rect) {
   return "(" + rect.x0 + "," + rect.y0 + ") - (" + rect.x1 + "," + rect.y1 + ") " +
          "[" + (rect.x1 - rect.x0) + "x" + (rect.y1 - rect.y0) + "]";
}

/**
 * Utility: Calculate total exposure time from subframes
 */
function getTotalExposure(subframes) {
   var total = 0;
   for (var i = 0; i < subframes.length; i++) {
      total += subframes[i].exposure;
   }
   return total;
}

/**
 * Utility: Close an image window by ID
 */
function closeImageWindow(imageId) {
   try {
      var window = ImageWindow.windowById(imageId);
      if (window && !window.isNull) {
         window.forceClose();
      }
   } catch (error) {
      Console.warningln("Failed to close window " + imageId + ": " + error.message);
   }
}

/**
 * Utility: Ensure directory exists
 */
function ensureDirectory(path) {
   if (!File.directoryExists(path)) {
      File.createDirectory(path, true);
   }
}

/**
 * Setup organized output directory structure
 * Creates: [outputDir]/SNRAnalysis/data/, graphs/, integrations/, previews/
 * Updates CONFIG with full paths to each subdirectory
 */
function setupOutputDirectories(baseOutputDir) {
   // Create main SNRAnalysis folder
   CONFIG.baseAnalysisDir = baseOutputDir + "/SNRAnalysis";
   
   if (!File.directoryExists(CONFIG.baseAnalysisDir)) {
      File.createDirectory(CONFIG.baseAnalysisDir, true);
      Console.writeln("Created analysis directory: " + CONFIG.baseAnalysisDir);
   }
   
   // Create subdirectories
   CONFIG.dataDir = CONFIG.baseAnalysisDir + "/data";
   CONFIG.graphsDir = CONFIG.baseAnalysisDir + "/graphs";
   CONFIG.integrationsDir = CONFIG.baseAnalysisDir + "/integrations";
   CONFIG.previewsDir = CONFIG.baseAnalysisDir + "/previews";
   
   var subdirs = [CONFIG.dataDir, CONFIG.graphsDir, CONFIG.integrationsDir, CONFIG.previewsDir];
   
   for (var i = 0; i < subdirs.length; i++) {
      if (!File.directoryExists(subdirs[i])) {
         File.createDirectory(subdirs[i], true);
         Console.writeln("Created subdirectory: " + subdirs[i]);
      }
   }
   
   Console.writeln("");
   Console.writeln("Output structure:");
   Console.writeln("  Data (CSV/JSON): " + CONFIG.dataDir);
   Console.writeln("  Graphs: " + CONFIG.graphsDir);
   Console.writeln("  Integrations: " + CONFIG.integrationsDir);
   Console.writeln("  Previews: " + CONFIG.previewsDir);
   Console.writeln("");
}

/**
 * Utility: Safe file write
 */
function writeTextFile(path, content) {
   try {
      var f = new File();
      f.createForWriting(path);
      f.outTextLn(content);
      f.close();
      return true;
   } catch (error) {
      Console.criticalln("Failed to write file " + path + ": " + error.message);
      return false;
   }
}

// Load settings on module initialization
loadSettings();
