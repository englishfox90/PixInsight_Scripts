/*
 * PixInsight PJSR: SNR vs Integration Time Analysis Tool
 * 
 * Analyzes how SNR improves with integration depth by creating partial integrations
 * from calibrated subframes and measuring SNR in user-defined regions.
 * 
 * Version: 1.0.0
 * Author: PixInsight Community
 */

#feature-id    SNRAnalysis : PFRAstro > SNR Analysis

#feature-info  Analyzes how SNR improves with integration depth. Creates partial integrations \
               from calibrated subframes at various depths, measures SNR in background and \
               foreground ROIs, generates graphs, and provides insights about diminishing \
               returns and optimal integration times.

// Include necessary PJSR libraries
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/StdCursor.jsh>
#include <pjsr/Color.jsh>
#include <pjsr/FontFamily.jsh>
#include <pjsr/DataType.jsh>

// Include our modular components
// Core modules
#include "core/SNRAnalysis-core.js"
#include "core/SNRAnalysis-depth-planner.js"

// Utilities
#include "utils/SNRAnalysis-subframe-scanner.js"

// Processing modules
#include "processing/SNRAnalysis-integrator.js"
#include "processing/SNRAnalysis-star-removal.js"
#include "processing/SNRAnalysis-stretch.js"
#include "processing/SNRAnalysis-snr.js"

// Analysis modules
#include "analysis/SNRAnalysis-roi-auto.js"
#include "analysis/SNRAnalysis-graph.js"
#include "analysis/SNRAnalysis-insights.js"
#include "analysis/SNRAnalysis-output.js"

// UI modules
#include "ui/SNRAnalysis-ui-header.js"
#include "ui/SNRAnalysis-ui-sections.js"
#include "ui/SNRAnalysis-ui.js"
#include "ui/SNRAnalysis-progress.js"
#include "ui/SNRAnalysis-stack-preview.js"
#include "ui/SNRAnalysis-results-dialog.js"

/**
 * Process a single filter group (analysis only, ref_master and ROIs already done)
 * Used in multi-filter mode after all reference frames and ROIs are prepared
 */
function processFilterGroupAnalysis(filterName, subframes, refImageId, rois, progress, isMultiFilter, subframesForIntegration) {
   // If no specific subframes provided, use original
   if (!subframesForIntegration) {
      subframesForIntegration = subframes;
   }
   var filterLabel = isMultiFilter ? (" (" + filterName + ")") : "";
   var filterSuffix = isMultiFilter ? ("_" + filterName.replace(/[^a-zA-Z0-9]/g, "_")) : "";
   
   console.writeln("");
   console.writeln("========================================");
   console.writeln("Analyzing Filter: " + filterName);
   console.writeln("Subframes: " + subframes.length);
   console.writeln("========================================");
   
   // Step: Generate integration depth list
   progress.setStatus("Planning integration depths" + filterLabel + "...");
   var stepName = isMultiFilter ? ("plan_" + filterName) : "plan";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   console.writeln("Planning integration depths" + filterLabel + "...");
   var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subframes.length, CONFIG.customDepths);
   
   // Calculate total exposure for each depth
   calculateJobExposures(depthJobs, subframes);
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, depthJobs.length + " depths planned");
   console.writeln("Planned " + depthJobs.length + " integration depths:");
   for (var i = 0; i < depthJobs.length; i++) {
      console.writeln("  " + depthJobs[i].label + ": " + depthJobs[i].depth + " subs (" + 
                    formatTime(depthJobs[i].totalExposure) + ")");
   }
   progress.updateElapsed();
   
   // Continue with the rest of processFilterGroup from depth processing onward...
   // (Copy the depth processing loop and output sections from processFilterGroup)
   
   // Step: Process each depth (integrate, star removal, stretch, SNR)
   progress.setStatus("Processing integration depths" + filterLabel + "...");
   console.writeln("Processing integration depths" + filterLabel + "...");
   var results = [];
   var startTime = new Date();
   
   for (var i = 0; i < depthJobs.length; i++) {
      if (progress.isCancelled()) {
         console.writeln("Analysis cancelled by user.");
         return null;
      }
      
      var job = depthJobs[i];
      stepName = isMultiFilter ? ("depth_" + filterName + "_" + i) : ("depth_" + i);
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Processing " + job.label + filterLabel + " (" + (i + 1) + "/" + depthJobs.length + ")...");
      progress.updateElapsed();
      
      console.writeln("");
      console.writeln("--- Processing " + job.label + " (" + (i + 1) + "/" + depthJobs.length + ") ---");
      
      // Integrate
      var intStart = new Date();
      var imageId = integrateDepth(job, subframes, CONFIG.outputDir, filterSuffix);
      job.integrationTime = (new Date() - intStart) / 1000;
      
      if (!imageId) {
         progress.updateStep(stepName, progress.STATE_WARNING, "Integration failed");
         console.warningln("Integration failed for " + job.label + ", skipping...");
         continue;
      }
      
      // Get the integrated image window
      var imageWindow = ImageWindow.windowById(imageId);
      if (!imageWindow || imageWindow.isNull) {
         progress.updateStep(stepName, progress.STATE_WARNING, "Window not found");
         console.warningln("Image window not found: " + imageId);
         continue;
      }
      
      // Star removal (optional)
      var starResult = runStarRemoval(CONFIG.starRemovalMethod, CONFIG, job, imageWindow);
      
      if (starResult) {
         // Use starless image for SNR measurement
         closeImageWindow(imageId);
         imageId = starResult.id;
         imageWindow = starResult.window;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stars removed (" + 
                           formatTime(job.starRemovalTimeSec) + ")");
      } else {
         // Continue with original starry image
         job.starRemovalTimeSec = 0;
      }
      progress.updateElapsed();
      
      // STF stretch (optional)
      if (CONFIG.applyStretch) {
         var stretchStart = new Date();
         applySTFStretch(imageId);
         job.stretchTime = (new Date() - stretchStart) / 1000;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stretched");
      } else {
         job.stretchTime = 0;
      }
      progress.updateElapsed();
      
      // Measure SNR
      var snrMetrics = measureSNR(imageId, rois.bg, rois.fg);
      job.bgMedian = snrMetrics.bgMedian;
      job.fgMedian = snrMetrics.fgMedian;
      job.fgSigma = snrMetrics.fgSigma;
      job.snr = snrMetrics.snr;
      
      results.push(job);
      
      // Keep image open if user wants to review, otherwise close
      if (!CONFIG.keepIntermediateImages) {
         closeImageWindow(imageId);
      }
      
      progress.updateStep(stepName, progress.STATE_SUCCESS, "SNR: " + job.snr.toFixed(2));
      progress.updateElapsed();
      
      console.writeln("SNR: " + job.snr.toFixed(2) + " (bg: " + job.bgMedian.toFixed(6) + 
                    ", fg: " + job.fgMedian.toFixed(6) + ", σ: " + job.fgSigma.toFixed(6) + ")");
   }
   
   var totalTime = (new Date() - startTime) / 1000;
   
   if (progress.isCancelled()) {
      console.writeln("Analysis cancelled by user.");
      return null;
   }
   
   // Step: Output results
   stepName = isMultiFilter ? ("output_" + filterName) : "output";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   progress.setStatus("Generating outputs" + filterLabel + "...");
   progress.updateElapsed();
   console.writeln("");
   console.writeln("Generating outputs" + filterLabel + "...");
   
   // Console summary
   printResultsSummary(results);
   
   // CSV
   if (CONFIG.outputCSV) {
      writeCSV(results, CONFIG.outputDir, filterSuffix);
      console.writeln("CSV written: snr_results" + filterSuffix + ".csv");
   }
   
   // Insights
   var insights = null;
   if (CONFIG.generateInsights) {
      stepName = isMultiFilter ? ("insights_" + filterName) : "insights";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Computing insights" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Computing insights" + filterLabel + "...");
      insights = computeInsights(results);
      printInsights(insights);
      
      // Create short recommendation for progress display
      var shortRec = "";
      if (insights.diminishingReturns10pct) {
         shortRec = "Diminishing returns after " + insights.diminishingReturns10pct;
      } else {
         shortRec = "Analysis complete";
      }
      progress.updateStep(stepName, progress.STATE_SUCCESS, shortRec);
   }
   
   // JSON
   if (CONFIG.outputJSON) {
      writeJSON(results, rois, insights, CONFIG.outputDir, filterSuffix);
      console.writeln("JSON written: snr_results" + filterSuffix + ".json");
   }
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, "CSV/JSON written");
   progress.updateElapsed();
   
   // Graph
   var graphPath = null;
   if (CONFIG.generateGraph) {
      stepName = isMultiFilter ? ("graph_" + filterName) : "graph";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Generating graph" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Generating graph" + filterLabel + "...");
      graphPath = generateGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (graphPath) {
         console.writeln("Graph written: " + graphPath);
         progress.updateStep(stepName, progress.STATE_SUCCESS, "Graph saved");
      } else {
         console.warningln("Graph generation failed");
         progress.updateStep(stepName, progress.STATE_WARNING, "Graph failed");
      }
   }
   progress.updateElapsed();
   
   // Timing log
   if (CONFIG.logTimings) {
      console.writeln("");
      console.writeln("=== TIMING SUMMARY" + filterLabel + " ===");
      console.writeln("Total runtime: " + totalTime.toFixed(1) + "s");
      for (var i = 0; i < results.length; i++) {
         var r = results[i];
         console.writeln(r.label + ": int=" + r.integrationTime.toFixed(1) + "s, " +
                       "star=" + r.starRemovalTime.toFixed(1) + "s, " +
                       "stretch=" + r.stretchTime.toFixed(1) + "s");
      }
   }
   
   return {
      filterName: filterName,
      results: results,
      rois: rois,
      insights: insights,
      totalTime: totalTime,
      graphPath: graphPath
   };
}

/**
 * Process a single filter group
 * Returns results object with all depth measurements
 */
function processFilterGroup(filterName, subframes, progress, isMultiFilter) {
   var filterLabel = isMultiFilter ? (" (" + filterName + ")") : "";
   var filterSuffix = isMultiFilter ? ("_" + filterName.replace(/[^a-zA-Z0-9]/g, "_")) : "";
   
   console.writeln("");
   console.writeln("========================================");
   console.writeln("Processing Filter: " + filterName);
   console.writeln("Subframes: " + subframes.length);
   console.writeln("========================================");
   
   // Step: Create reference master
   progress.setStatus("Creating reference master" + filterLabel + "...");
   var stepName = isMultiFilter ? ("ref_master_" + filterName) : "ref_master";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   console.writeln("Creating full-depth reference master" + filterLabel + "...");
   
   // Check if reference master already exists
   var refImageId = "ref_master_full" + filterSuffix;
   var refWindow = ImageWindow.windowById(refImageId);
   
   if (!refWindow || refWindow.isNull) {
      // Try to load from disk if it exists
      var refPath = CONFIG.outputDir + "/ref_master_full" + filterSuffix + ".xisf";
      if (File.exists(refPath)) {
         console.writeln("Found existing reference master on disk, loading...");
         var windows = ImageWindow.open(refPath);
         if (windows && windows.length > 0) {
            refWindow = windows[0];
            refWindow.mainView.id = refImageId;
            refImageId = refWindow.mainView.id;
         }
      }
   }
   
   if (!refWindow || refWindow.isNull) {
      // Create new integration
      refImageId = performFullIntegration(subframes, CONFIG.outputDir, filterSuffix);
      if (!refImageId) {
         progress.updateStep(stepName, progress.STATE_ERROR, "Integration failed");
         throw new Error("Full integration failed for " + filterName);
      }
      progress.updateStep(stepName, progress.STATE_SUCCESS, "New master created");
   } else {
      console.writeln("Using existing reference master: " + refImageId);
      progress.updateStep(stepName, progress.STATE_SUCCESS, "Using existing master");
   }
   progress.updateElapsed();
   
   // Step: Define ROI previews (manual or auto mode)
   progress.setStatus("Defining ROI regions" + filterLabel + "...");
   stepName = isMultiFilter ? ("roi_" + filterName) : "roi";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   
   var rois = null;
   
   if (CONFIG.roiMode === "auto") {
      // Auto-detect ROIs
      console.writeln("Auto-detecting ROI regions" + filterLabel + "...");
      var refWindow = ImageWindow.windowById(refImageId);
      if (!refWindow || refWindow.isNull) {
         progress.updateStep(stepName, progress.STATE_ERROR, "Window not found");
         throw new Error("Reference window not found: " + refImageId);
      }
      
      var autoRects = detectAutoRois(refWindow.mainView, CONFIG.autoRoiTileSize);
      
      if (autoRects && createAutoRoiPreviews(refWindow, autoRects)) {
         console.writeln("Auto ROI previews created successfully");
         // Read back the previews we just created
         rois = readExistingROIs(refImageId);
         if (!rois) {
            console.warningln("Failed to read auto-created previews - falling back to manual mode");
         }
      } else {
         console.warningln("Auto ROI detection/creation failed - falling back to manual mode");
      }
   }
   
   // If auto mode failed or manual mode selected, use manual ROI
   if (!rois) {
      console.writeln("Waiting for user to define ROI previews" + filterLabel + "...");
      var autoFailed = (CONFIG.roiMode === "auto");
      rois = promptForROIs(refImageId, autoFailed);
   }
   
   if (progress.isCancelled() || !rois) {
      console.writeln("ROI definition cancelled. Cleaning up...");
      closeImageWindow(refImageId);
      return null;
   }
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, "ROIs defined");
   console.writeln("Background ROI: " + formatRect(rois.bg));
   console.writeln("Foreground ROI: " + formatRect(rois.fg));
   progress.updateElapsed();
   
   // Step: ROI cropping (if cropped mode enabled)
   var subframesForIntegration = subframes;  // Default to original full-frame subframes
   var roiRect = null;
   var refSize = null;
   
   if (CONFIG.stackMode === "cropped") {
      stepName = isMultiFilter ? ("roi_crop_" + filterName) : "roi_crop";
      progress.setStatus("Cropping subframes to ROI" + filterLabel + "...");
      progress.updateStep(stepName, progress.STATE_RUNNING);
      
      // Get reference image dimensions
      var refWindow = ImageWindow.windowById(refImageId);
      if (refWindow && !refWindow.isNull) {
         refSize = {
            width: refWindow.mainView.image.width,
            height: refWindow.mainView.image.height
         };
         
         // Compute bounding box
         roiRect = computeRoiBoundingBox(rois.bg, rois.fg, refSize.width, refSize.height, 16);
         console.writeln("ROI bounding box: " + formatRect(roiRect));
         
         // Prepare temp directory
         var tempRootDir = CONFIG.outputDir + "/_snr_roi_temp";
         
         // Attempt cropping
         var croppedSubs = cropSubframesToRoi(subframes, roiRect, tempRootDir, filterName, refSize);
         
         if (croppedSubs && croppedSubs.length === subframes.length) {
            // Success - use cropped subframes
            subframesForIntegration = croppedSubs;
            progress.updateStep(stepName, progress.STATE_SUCCESS, croppedSubs.length + " subs cropped to ROI");
            console.writeln("Using ROI-cropped subs for integration (" + filterName + ").");
         } else {
            // Fallback to full-frame
            progress.updateStep(stepName, progress.STATE_WARNING, "Disabled (falling back to full-frame subs)");
            console.writeln("ROI cropping failed or incomplete, falling back to full-frame stacking.");
         }
      } else {
         progress.updateStep(stepName, progress.STATE_WARNING, "Reference window not found");
         console.warningln("Could not access reference window for ROI cropping.");
      }
      progress.updateElapsed();
   } else {
      // Full-frame mode - skip cropping
      stepName = isMultiFilter ? ("roi_crop_" + filterName) : "roi_crop";
      progress.updateStep(stepName, progress.STATE_SKIPPED, "Full-frame mode – crop skipped");
   }
   
   // Step: Generate integration depth list
   progress.setStatus("Planning integration depths" + filterLabel + "...");
   stepName = isMultiFilter ? ("plan_" + filterName) : "plan";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   console.writeln("Planning integration depths" + filterLabel + "...");
   var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subframes.length, CONFIG.customDepths);
   
   // Calculate total exposure for each depth
   calculateJobExposures(depthJobs, subframes);
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, depthJobs.length + " depths planned");
   console.writeln("Planned " + depthJobs.length + " integration depths:");
   for (var i = 0; i < depthJobs.length; i++) {
      console.writeln("  " + depthJobs[i].label + ": " + depthJobs[i].depth + " subs (" + 
                    formatTime(depthJobs[i].totalExposure) + ")");
   }
   progress.updateElapsed();
   
   // Step: Process each depth (integrate, star removal, stretch, SNR)
   progress.setStatus("Processing integration depths" + filterLabel + "...");
   console.writeln("Processing integration depths" + filterLabel + "...");
   var results = [];
   var startTime = new Date();
   
   for (var i = 0; i < depthJobs.length; i++) {
      if (progress.isCancelled()) {
         console.writeln("Analysis cancelled by user.");
         return null;
      }
      
      var job = depthJobs[i];
      stepName = isMultiFilter ? ("depth_" + filterName + "_" + i) : ("depth_" + i);
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Processing " + job.label + filterLabel + " (" + (i + 1) + "/" + depthJobs.length + ")...");
      progress.updateElapsed();
      
      console.writeln("");
      console.writeln("--- Processing " + job.label + " (" + (i + 1) + "/" + depthJobs.length + ") ---");
      
      // Integrate
      var intStart = new Date();
      var imageId = integrateDepth(job, subframesForIntegration, CONFIG.outputDir, filterSuffix);
      job.integrationTime = (new Date() - intStart) / 1000;
      
      if (!imageId) {
         progress.updateStep(stepName, progress.STATE_WARNING, "Integration failed");
         console.warningln("Integration failed for " + job.label + ", skipping...");
         continue;
      }
      
      // Get the integrated image window
      var imageWindow = ImageWindow.windowById(imageId);
      if (!imageWindow || imageWindow.isNull) {
         progress.updateStep(stepName, progress.STATE_WARNING, "Window not found");
         console.warningln("Image window not found: " + imageId);
         continue;
      }
      
      // Star removal (optional)
      var starResult = runStarRemoval(CONFIG.starRemovalMethod, CONFIG, job, imageWindow);
      
      if (starResult) {
         // Use starless image for SNR measurement
         closeImageWindow(imageId);
         imageId = starResult.id;
         imageWindow = starResult.window;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stars removed (" + 
                           formatTime(job.starRemovalTimeSec) + ")");
      } else {
         // Continue with original starry image
         job.starRemovalTimeSec = 0;
      }
      progress.updateElapsed();
      
      // STF stretch (optional)
      if (CONFIG.applyStretch) {
         var stretchStart = new Date();
         applySTFStretch(imageId);
         job.stretchTime = (new Date() - stretchStart) / 1000;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stretched");
      } else {
         job.stretchTime = 0;
      }
      progress.updateElapsed();
      
      // Measure SNR
      var snrMetrics = measureSNR(imageId, rois.bg, rois.fg);
      job.bgMedian = snrMetrics.bgMedian;
      job.fgMedian = snrMetrics.fgMedian;
      job.fgSigma = snrMetrics.fgSigma;
      job.snr = snrMetrics.snr;
      
      results.push(job);
      
      // Keep image open if user wants to review, otherwise close
      if (!CONFIG.keepIntermediateImages) {
         closeImageWindow(imageId);
      }
      
      progress.updateStep(stepName, progress.STATE_SUCCESS, "SNR: " + job.snr.toFixed(2));
      progress.updateElapsed();
      
      console.writeln("SNR: " + job.snr.toFixed(2) + " (bg: " + job.bgMedian.toFixed(6) + 
                    ", fg: " + job.fgMedian.toFixed(6) + ", σ: " + job.fgSigma.toFixed(6) + ")");
   }
   
   var totalTime = (new Date() - startTime) / 1000;
   
   if (progress.isCancelled()) {
      console.writeln("Analysis cancelled by user.");
      return null;
   }
   
   // Step: Output results
   stepName = isMultiFilter ? ("output_" + filterName) : "output";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   progress.setStatus("Generating outputs" + filterLabel + "...");
   progress.updateElapsed();
   console.writeln("");
   console.writeln("Generating outputs" + filterLabel + "...");
   
   // Console summary
   printResultsSummary(results);
   
   // CSV
   if (CONFIG.outputCSV) {
      writeCSV(results, CONFIG.outputDir, filterSuffix);
      console.writeln("CSV written: snr_results" + filterSuffix + ".csv");
   }
   
   // Insights
   var insights = null;
   if (CONFIG.generateInsights) {
      stepName = isMultiFilter ? ("insights_" + filterName) : "insights";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Computing insights" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Computing insights" + filterLabel + "...");
      insights = computeInsights(results);
      printInsights(insights);
      
      // Create short recommendation for progress display
      var shortRec = "";
      if (insights.diminishingReturns10pct) {
         shortRec = "Diminishing returns after " + insights.diminishingReturns10pct;
      } else {
         shortRec = "Analysis complete";
      }
      progress.updateStep(stepName, progress.STATE_SUCCESS, shortRec);
   }
   
   // JSON
   if (CONFIG.outputJSON) {
      writeJSON(results, rois, insights, CONFIG.outputDir, filterSuffix);
      console.writeln("JSON written: snr_results" + filterSuffix + ".json");
   }
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, "CSV/JSON written");
   progress.updateElapsed();
   
   // Graph
   var graphPath = null;
   if (CONFIG.generateGraph) {
      stepName = isMultiFilter ? ("graph_" + filterName) : "graph";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Generating graph" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Generating graph" + filterLabel + "...");
      graphPath = generateGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (graphPath) { console.writeln("Graph written: " + graphPath); } else { console.warningln("Graph generation failed"); }
      progress.updateStep(stepName, progress.STATE_SUCCESS, "Graph saved");
   }
   progress.updateElapsed();
   
   // Timing log
   if (CONFIG.logTimings) {
      console.writeln("");
      console.writeln("=== TIMING SUMMARY" + filterLabel + " ===");
      console.writeln("Total runtime: " + totalTime.toFixed(1) + "s");
      for (var i = 0; i < results.length; i++) {
         var r = results[i];
         console.writeln(r.label + ": int=" + r.integrationTime.toFixed(1) + "s, " +
                       "star=" + r.starRemovalTime.toFixed(1) + "s, " +
                       "stretch=" + r.stretchTime.toFixed(1) + "s");
      }
   }
   
   return {
      filterName: filterName,
      results: results,
      rois: rois,
      insights: insights,
      totalTime: totalTime,
      graphPath: graphPath
   };
}

/**
 * Main execution orchestrator
 */
function SNRAnalysisEngine() {
   this.execute = function() {
      console.show();
      console.writeln("========================================");
      console.writeln("SNR vs Integration Time Analysis Tool");
      console.writeln("Version: " + SCRIPT_VERSION);
      console.writeln("========================================");
      console.writeln("");
      
      try {
         // Step 1: Show configuration dialog
         console.writeln("[1/3] Loading configuration dialog...");
         var dialog = new SNRAnalysisDialog();
         if (!dialog.execute()) {
            console.writeln("Analysis cancelled by user.");
            return;
         }
         
         // Create progress monitor
         var progress = new ProgressMonitor();
         progress.show();
         
         // Step 2: Scan subframes
         progress.addStep("scan", "Scanning subframes");
         progress.setStatus("Scanning subframes from: " + CONFIG.inputDir);
         progress.updateStep("scan", progress.STATE_RUNNING);
         console.writeln("[2/3] Scanning subframes from: " + CONFIG.inputDir);
         
         var scanResult = scanSubframes(CONFIG.inputDir, CONFIG.filePattern, CONFIG.analyzeAllFilters);
         
         if (progress.isCancelled()) {
            progress.close();
            console.writeln("Analysis cancelled by user.");
            return;
         }
         
         // Determine if we have filter groups or a single array
         var filterGroups = {};
         var isMultiFilter = (typeof scanResult === "object" && !Array.isArray(scanResult));
         
         if (isMultiFilter) {
            filterGroups = scanResult;
            // Validate we have data
            var hasData = false;
            for (var filterName in filterGroups) {
               if (filterGroups[filterName].length > 0) {
                  hasData = true;
                  break;
               }
            }
            if (!hasData) {
               progress.updateStep("scan", progress.STATE_ERROR, "No subframes found");
               progress.close();
               throw new Error("No subframes found matching criteria.");
            }
         } else {
            // Single group (all filters or no filter grouping)
            var subframes = scanResult;
            if (subframes.length === 0) {
               progress.updateStep("scan", progress.STATE_ERROR, "No subframes found");
               progress.close();
               throw new Error("No subframes found matching criteria.");
            }
            filterGroups["All"] = subframes;
         }
         
         progress.updateStep("scan", progress.STATE_SUCCESS, "Scan complete");
         progress.updateElapsed();
         
         // Add steps for each filter
         for (var filterName in filterGroups) {
            var subs = filterGroups[filterName];
            console.writeln("Total exposure for " + filterName + ": " + formatTime(getTotalExposure(subs)));
            
            if (isMultiFilter) {
               progress.addStep("ref_master_" + filterName, "Reference master (" + filterName + ")");
               progress.addStep("roi_" + filterName, "ROI definition (" + filterName + ")");
               progress.addStep("plan_" + filterName, "Planning (" + filterName + ")");
               
               var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subs.length, CONFIG.customDepths);
               for (var i = 0; i < depthJobs.length; i++) {
                  progress.addStep("depth_" + filterName + "_" + i, depthJobs[i].label + " (" + filterName + ")");
               }
               
               progress.addStep("output_" + filterName, "Output (" + filterName + ")");
               progress.addStep("insights_" + filterName, "Insights (" + filterName + ")");
               progress.addStep("graph_" + filterName, "Graph (" + filterName + ")");
            } else {
               progress.addStep("ref_master", "Creating reference master");
               progress.addStep("roi", "Defining ROI regions");
               progress.addStep("plan", "Planning integration depths");
               
               var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subs.length, CONFIG.customDepths);
               for (var i = 0; i < depthJobs.length; i++) {
                  progress.addStep("depth_" + i, "Processing " + depthJobs[i].label);
               }
               
               progress.addStep("output", "Generating outputs");
               progress.addStep("insights", "Computing insights");
               progress.addStep("graph", "Generating graph");
            }
         }
         
         progress.addStep("complete", "Finalizing");
         
         // Step 3a: Create all reference masters first (for multi-filter)
         if (isMultiFilter) {
            console.writeln("[3/4] Creating reference masters for all filters...");
            var refMasters = {};
            
            for (var filterName in filterGroups) {
               var subs = filterGroups[filterName];
               var filterSuffix = "_" + filterName.replace(/[^a-zA-Z0-9]/g, "_");
               var stepName = "ref_master_" + filterName;
               
               progress.setStatus("Creating reference master (" + filterName + ")...");
               progress.updateStep(stepName, progress.STATE_RUNNING);
               console.writeln("Creating reference master for " + filterName + "...");
               
               var refImageId = "ref_master_full" + filterSuffix;
               var refWindow = ImageWindow.windowById(refImageId);
               
               if (!refWindow || refWindow.isNull) {
                  var refPath = CONFIG.outputDir + "/ref_master_full" + filterSuffix + ".xisf";
                  if (File.exists(refPath)) {
                     console.writeln("Loading existing reference master from disk...");
                     var windows = ImageWindow.open(refPath);
                     if (windows && windows.length > 0) {
                        refWindow = windows[0];
                        refWindow.mainView.id = refImageId;
                        refImageId = refWindow.mainView.id;
                     }
                  }
               }
               
               if (!refWindow || refWindow.isNull) {
                  refImageId = performFullIntegration(subs, CONFIG.outputDir, filterSuffix);
                  if (!refImageId) {
                     progress.updateStep(stepName, progress.STATE_ERROR, "Integration failed");
                     throw new Error("Full integration failed for " + filterName);
                  }
                  progress.updateStep(stepName, progress.STATE_SUCCESS, "New master created");
               } else {
                  console.writeln("Using existing reference master: " + refImageId);
                  progress.updateStep(stepName, progress.STATE_SUCCESS, "Using existing master");
               }
               
               refMasters[filterName] = refImageId;
               
               if (progress.isCancelled()) {
                  progress.close();
                  return;
               }
            }
            
            // Step 3b: Check ROIs for ALL filters
            console.writeln("[3/4] Checking ROI previews for all filters...");
            var allROIs = {};
            var missingROIs = [];
            
            for (var filterName in filterGroups) {
               var refId = refMasters[filterName];
               var stepName = "roi_" + filterName;
               
               progress.setStatus("Defining ROI regions (" + filterName + ")...");
               progress.updateStep(stepName, progress.STATE_RUNNING);
               
               try {
                  var rois = null;
                  
                  if (CONFIG.roiMode === "auto") {
                     // Auto-detect ROIs
                     console.writeln("Auto-detecting ROI regions for " + filterName + "...");
                     var refWindow = ImageWindow.windowById(refId);
                     if (refWindow && !refWindow.isNull) {
                        var autoRects = detectAutoRois(refWindow.mainView, CONFIG.autoRoiTileSize);
                        
                        if (autoRects && createAutoRoiPreviews(refWindow, autoRects)) {
                           console.writeln(filterName + " - Auto ROI previews created successfully");
                           // Read back the previews we just created
                           rois = readExistingROIs(refId);
                           if (!rois) {
                              console.warningln(filterName + " - Failed to read auto-created previews - falling back to manual mode");
                           }
                        } else {
                           console.warningln(filterName + " - Auto ROI detection/creation failed - falling back to manual mode");
                        }
                     }
                  }
                  
                  // If auto mode failed or manual mode selected, use manual ROI
                  if (!rois) {
                     var autoFailed = (CONFIG.roiMode === "auto");
                     rois = promptForROIs(refId, autoFailed);
                  }
                  
                  allROIs[filterName] = rois;
                  progress.updateStep(stepName, progress.STATE_SUCCESS, "ROIs defined");
                  console.writeln(filterName + " - Background ROI: " + formatRect(rois.bg));
                  console.writeln(filterName + " - Foreground ROI: " + formatRect(rois.fg));
               } catch (e) {
                  // ROIs missing for this filter
                  missingROIs.push(filterName);
                  progress.updateStep(stepName, progress.STATE_WARNING, "ROIs missing");
               }
               
               if (progress.isCancelled()) {
                  progress.close();
                  return;
               }
            }
            
            // If any ROIs are missing, show combined message and exit
            if (missingROIs.length > 0) {
               var msg = "Missing ROI previews for the following filters:\n\n";
               for (var i = 0; i < missingROIs.length; i++) {
                  msg += "  • " + missingROIs[i] + " - needs 'BG' and 'FG' previews\n";
               }
               msg += "\nAll reference master windows are open.\n";
               msg += "Create the missing previews and re-run the script.\n\n";
               msg += "The reference masters are saved to disk and will be reloaded automatically.";
               
               console.warningln(msg);
               
               progress.markComplete();
               progress.setStatus("Waiting for ROI creation - " + missingROIs.length + " filter(s) need previews");
               
               for (var i = 0; i < 20; i++) {
                  processEvents();
                  msleep(100);
               }
               
               progress.close();
               
               new MessageBox(msg, "Create ROI Previews", StdIcon_Information, StdButton_Ok).execute();
               return;
            }
            
            // Step 3b: ROI cropping (if in cropped mode) - multi-filter
            if (CONFIG.stackMode === "cropped") {
               console.writeln("[3b/4] Cropping subframes to ROI regions...");
               var tempRootDir = CONFIG.outputDir + "/_snr_roi_temp";
               
               // Store cropped subframes for each filter
               var croppedSubframes = {};
               
               for (var filterName in filterGroups) {
                  var subs = filterGroups[filterName];
                  var rois = allROIs[filterName];
                  var refId = refMasters[filterName];
                  
                  var stepName = "roi_crop_" + filterName;
                  progress.addStep(stepName, "ROI crop (" + filterName + ")");
                  progress.updateStep(stepName, progress.STATE_RUNNING);
                  
                  // Get reference dimensions
                  var refWindow = ImageWindow.windowById(refId);
                  if (refWindow && !refWindow.isNull) {
                     var refSize = {
                        width: refWindow.mainView.image.width,
                        height: refWindow.mainView.image.height
                     };
                     
                     // Compute bounding box
                     var roiRect = computeRoiBoundingBox(rois.bg, rois.fg, refSize.width, refSize.height, 16);
                     
                     // Attempt cropping
                     var croppedSubs = cropSubframesToRoi(subs, roiRect, tempRootDir, filterName, refSize);
                     
                     if (croppedSubs && croppedSubs.length === subs.length) {
                        croppedSubframes[filterName] = croppedSubs;
                        progress.updateStep(stepName, progress.STATE_SUCCESS, croppedSubs.length + " subs cropped");
                     } else {
                        croppedSubframes[filterName] = null;  // Will fallback to full-frame
                        progress.updateStep(stepName, progress.STATE_WARNING, "Fallback to full-frame");
                     }
                  } else {
                     croppedSubframes[filterName] = null;
                     progress.updateStep(stepName, progress.STATE_WARNING, "Ref window not found");
                  }
                  
                  if (progress.isCancelled()) {
                     progress.close();
                     return;
                  }
               }
            }
         }
         
         // Step 4: Process each filter group
         console.writeln("[4/4] Processing filter groups...");
         var allFilterResults = [];
         
         for (var filterName in filterGroups) {
            var subs = filterGroups[filterName];
            
            if (isMultiFilter) {
               // Skip ref_master and roi steps - already done
               // Use cropped subframes if available, otherwise use original
               var subsForIntegration = (CONFIG.stackMode === "cropped" && croppedSubframes && croppedSubframes[filterName]) 
                  ? croppedSubframes[filterName] 
                  : subs;
               
               var filterResult = processFilterGroupAnalysis(filterName, subs, refMasters[filterName], 
                                                            allROIs[filterName], progress, isMultiFilter, subsForIntegration);
            } else {
               var filterResult = processFilterGroup(filterName, subs, progress, isMultiFilter);
            }
            
            if (!filterResult) {
               // Cancelled or failed
               progress.close();
               return;
            }
            
            allFilterResults.push(filterResult);
         }
         
         // Complete
         progress.updateStep("complete", progress.STATE_SUCCESS, allFilterResults.length + " filter(s) analyzed");
         progress.setProgress(100);
         progress.setStatus("Analysis complete!");
         
         console.writeln("");
         console.writeln("Analysis complete!");
         console.writeln("Results saved to: " + CONFIG.outputDir);
         
         // Clean up temporary ROI files if not keeping them
         if (CONFIG.stackMode === "cropped" && !CONFIG.keepTempRoiFiles) {
            var tempRootDir = CONFIG.outputDir + "/_snr_roi_temp";
            cleanupTempRoiFiles(tempRootDir);
         }
         
         // Mark complete to stop live timer
         progress.markComplete();
         
         // Small delay to show 100% and final time before closing
         for (var i = 0; i < 10; i++) {
            processEvents();
            msleep(100);
         }
         
         // Close progress monitor
         progress.close();
         
         // Show final results dialog (tabbed if multi-filter)
         showMultiFilterResultsDialog(allFilterResults, CONFIG.outputDir);
         
      } catch (error) {
         // Clean up temporary ROI files on error
         if (CONFIG.stackMode === "cropped" && !CONFIG.keepTempRoiFiles) {
            try {
               var tempRootDir = CONFIG.outputDir + "/_snr_roi_temp";
               cleanupTempRoiFiles(tempRootDir);
            } catch (cleanupError) {
               // Ignore cleanup errors
            }
         }
         
         if (progress && !progress.dialog.isNull) {
            progress.markComplete();
            progress.setStatus("Analysis stopped: " + error.message);
            
            // Keep dialog open briefly to show the error
            for (var i = 0; i < 15; i++) {
               processEvents();
               msleep(100);
            }
            
            progress.close();
         }
         console.criticalln("ERROR: " + error.message);
         console.criticalln(error.stack || "");
      }
   };
}

/**
 * Main script entry point
 */
function main() {
   // Script should not run in global mode
   if (Parameters.isGlobalTarget) {
      console.criticalln("SNR Analysis should not run in global context.");
      return;
   }
   
   var engine = new SNRAnalysisEngine();
   engine.execute();
}

// Execute main
main();
