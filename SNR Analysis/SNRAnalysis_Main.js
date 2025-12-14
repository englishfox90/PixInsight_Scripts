/*
 * PixInsight PJSR: SNR vs Integration Time Analysis Tool
 * 
 * Analyzes how SNR improves with integration depth by creating partial integrations
 * from calibrated  and registeredsubframes and measuring SNR in user-defined regions.
 * 
 * Version: 1.6.4
 * Author: PixInsight Community
 */

#feature-id    SNRAnalysis : PFRAstro > SNR Analysis

#feature-info  Analyzes how SNR improves with integration depth. Creates partial integrations \
               from calibrated  and registeredsubframes at various depths, measures SNR in background and \
               foreground ROIs, generates graphs, and provides insights about diminishing \
               returns and optimal integration times.

#feature-icon  @script_icons_dir/SNRAnalysis.svg

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
#include <pjsr/UndoFlag.jsh>
#include <pjsr/MorphOp.jsh>

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
#include "analysis/SNRAnalysis-roi-rangemask.js"
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
function processFilterGroupAnalysis(filterName, subframes, refImageId, rois, progress, isMultiFilter) {
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
   var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subframes.length, CONFIG.customDepths, CONFIG.includeFullDepth);
   
   // Calculate total exposure for each depth
   calculateJobExposures(depthJobs, subframes);
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, depthJobs.length + " depths planned");
   console.writeln("Planned " + depthJobs.length + " integration depths:");
   for (var i = 0; i < depthJobs.length; i++) {
      console.writeln("  " + depthJobs[i].label + ": " + depthJobs[i].depth + " subs (" + 
                    formatTime(depthJobs[i].totalExposure) + ")");
   }
   progress.updateElapsed();
   
   // NOTE: bgRef should already be in rois.bgRef (computed during ROI setup phase)
   // It will be passed to measureSNR for signal scale normalization
   
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
      var starResult = runStarRemoval(CONFIG.starRemovalMethod, CONFIG, job, imageWindow, filterSuffix);
      
      if (starResult) {
         // Use starless image for SNR measurement
         closeImageWindow(imageId);
         imageId = starResult.id;
         imageWindow = starResult.window;
         job.starRemovalTime = job.starRemovalTimeSec;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stars removed (" + 
                           formatTime(job.starRemovalTimeSec) + ")");
      } else {
         // Continue with original starry image
         job.starRemovalTimeSec = 0;
         job.starRemovalTime = 0;
      }
      progress.updateElapsed();
      
      // Measure SNR on linear starless stack before any stretch
      // Pass rois.bgRef if available for signal scale normalization
      var bgRefForMeasure = (rois && rois.bgRef) ? rois.bgRef : null;
      var snrMetrics = measureSNR(imageId, rois.bg, rois.fg, bgRefForMeasure);
      job.bgMean = snrMetrics.bgMean;
      job.bgMedian = snrMetrics.bgMedian;
      job.bgSigma = snrMetrics.bgSigma;
      job.bgSigmaMAD = snrMetrics.bgSigmaMAD;
      job.fgMean = snrMetrics.fgMean;
      job.fgMedian = snrMetrics.fgMedian;
      job.fgSigma = snrMetrics.fgSigma;
      job.fgSigmaMAD = snrMetrics.fgSigmaMAD;
      job.snr = snrMetrics.snr;
      job.snrBG = snrMetrics.snrBG;
      job.snrFG = snrMetrics.snrFG;
      // Store validation fields (Part A)
      job.scaleFactor = snrMetrics.scaleFactor;
      job.bgMedianRaw = snrMetrics.bgMedianRaw;
      job.bgMedianScaled = snrMetrics.bgMedianScaled;
      // Store global noise metrics
      job.globalMedian = snrMetrics.globalMedian;
      job.globalNoise = snrMetrics.globalNoise;
      
      // Compute Gain per Hour metrics (diminishing returns analysis)
      if (i > 0) {
         var prevJob = depthJobs[i - 1];
         var deltaSNR = job.snr - prevJob.snr;
         var deltaSNRpct = (prevJob.snr > 0) ? ((deltaSNR / prevJob.snr) * 100.0) : 0;
         var deltaTime = job.totalExposure - prevJob.totalExposure;  // in seconds
         var deltaHours = deltaTime / 3600.0;
         var gainPerHour = (deltaHours > 0) ? (deltaSNRpct / deltaHours) : 0;
         
         job.deltaSNRpct = deltaSNRpct;
         job.deltaHours = deltaHours;
         job.gainPerHour = gainPerHour;
      } else {
         job.deltaSNRpct = null;
         job.deltaHours = null;
         job.gainPerHour = null;
      }

      // STF stretch (optional) after measuring SNR
      if (CONFIG.applyStretch) {
         var stretchStart = new Date();
         applySTFStretch(imageId);
         job.stretchTime = (new Date() - stretchStart) / 1000;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stretched");
      } else {
         job.stretchTime = 0;
      }
      
      results.push(job);
      
      // Keep image open if user wants to review, otherwise close
      if (!CONFIG.keepIntermediateImages) {
         closeImageWindow(imageId);
      }
      
      progress.updateStep(stepName, progress.STATE_SUCCESS, "SNR: " + job.snr.toFixed(2));
      progress.updateElapsed();
      
      console.writeln("SNR: " + job.snr.toFixed(2) + " (bgμ: " + job.bgMean.toFixed(6) + 
              ", fgμ: " + job.fgMean.toFixed(6) + ", σ_bg: " + job.bgSigma.toFixed(6) + ")");
   }
   
   var totalTime = (new Date() - startTime) / 1000;
   
   if (progress.isCancelled()) {
      console.writeln("Analysis cancelled by user.");
      return null;
   }
   
   // Compute reference signal from deepest integration (decision metric)
   console.writeln("");
   console.writeln("Computing decision SNR with fixed signal reference...");
   
   // Sort by depth to find deepest
   results.sort(function(a, b) { return a.depth - b.depth; });
   var deepestResult = results[results.length - 1];
   var signalRef = deepestResult.fgMedian - deepestResult.bgMedian;
   var refLabel = deepestResult.label;
   
   console.writeln("Reference signal (deepest stack " + refLabel + "):");
   console.writeln("  signalRef = fgMedian - bgMedian = " + signalRef.toFixed(8));
   console.writeln("");
   
   // Compute snrStop for all depths using fixed signal
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      r.signalMeasured = r.fgMedian - r.bgMedian;
      r.signalRef = signalRef;
      r.snrMeasured = r.snr;  // Store original measured SNR
      r.snrStop = signalRef / r.bgSigmaMAD;  // Decision metric
      r.snr = r.snrStop;  // Override for downstream code
   }
   
   // Initialize metrics for first depth (no previous to compare)
   results[0].deltaSNRpct = null;
   results[0].deltaHours = null;
   results[0].gainPerHour = null;
   results[0].t10Hours = null;

   // Recompute gain/hr metrics using snrStop
   for (var i = 1; i < results.length; i++) {
      var r = results[i];
      var prevResult = results[i - 1];
      var deltaSNR = r.snrStop - prevResult.snrStop;
      var deltaSNRpct = (prevResult.snrStop > 0) ? ((deltaSNR / prevResult.snrStop) * 100.0) : 0;
      var deltaTime = r.totalExposure - prevResult.totalExposure;
      var deltaHours = deltaTime / 3600.0;
      var gainPerHour = (deltaHours > 0) ? (deltaSNRpct / deltaHours) : 0;
      
      r.deltaSNRpct = deltaSNRpct;
      r.deltaHours = deltaHours;
      r.gainPerHour = gainPerHour;
      
      // Compute hours for +10% SNR at current rate (T10)
      r.t10Hours = (deltaSNRpct > 0) ? (deltaHours * (10.0 / deltaSNRpct)) : Infinity;
   }
   
   // Step: Output results
   stepName = isMultiFilter ? ("output_" + filterName) : "output";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   progress.setStatus("Generating outputs" + filterLabel + "...");
   progress.updateElapsed();
   console.writeln("");
   console.writeln("Generating outputs" + filterLabel + "...");
   
   // Console summary
   printResultsSummary(results, signalRef, refLabel);
   
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
   
   // Graphs (SNR and Gain/hr)
   var graphPath = null;
   var gainGraphPath = null;
   if (CONFIG.generateGraph) {
      stepName = isMultiFilter ? ("graph_" + filterName) : "graph";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Generating graphs" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Generating graphs" + filterLabel + "...");
      
      // SNR graph
      graphPath = generateGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (graphPath) {
         console.writeln("SNR graph written: " + graphPath);
      } else {
         console.warningln("SNR graph generation failed");
      }
      
      // Gain/hr graph
      gainGraphPath = generateGainGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (gainGraphPath) {
         console.writeln("Gain/hr graph written: " + gainGraphPath);
      } else {
         console.warningln("Gain/hr graph generation failed");
      }
      
      if (graphPath || gainGraphPath) {
         progress.updateStep(stepName, progress.STATE_SUCCESS, "Graphs saved");
      } else {
         progress.updateStep(stepName, progress.STATE_WARNING, "Graph generation failed");
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
      filterSuffix: filterSuffix,
      refImageId: refImageId,  // Track reference master for preservation
      results: results,
      rois: rois,
      insights: insights,
      totalTime: totalTime,
      graphPath: graphPath,
      gainGraphPath: gainGraphPath
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
      var refPath = CONFIG.integrationsDir + "/ref_master_full" + filterSuffix + ".xisf";
      if (File.exists(refPath)) {
         console.writeln("Found existing reference master on disk, loading...");
         var windows = ImageWindow.open(refPath);
         if (windows && windows.length > 0) {
            refWindow = windows[0];
            refWindow.mainView.id = refImageId;
            refImageId = refWindow.mainView.id;
            refWindow.show();
            refWindow.zoomToFit();
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
      refWindow = ImageWindow.windowById(refImageId);
      if (refWindow && !refWindow.isNull) {
         refWindow.show();
         refWindow.zoomToFit();
      }
      progress.updateStep(stepName, progress.STATE_SUCCESS, "New master created");
   } else {
      console.writeln("Using existing reference master: " + refImageId);
      refWindow.show();
      refWindow.zoomToFit();
      progress.updateStep(stepName, progress.STATE_SUCCESS, "Using existing master");
   }
   progress.updateElapsed();
   
   // Step: Define ROI previews (manual, auto, or rangeMask mode)
   progress.setStatus("Defining ROI regions" + filterLabel + "...");
   stepName = isMultiFilter ? ("roi_" + filterName) : "roi";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   
   var rois = null;
   
   if (CONFIG.roiMode === "rangeMask") {
      // Range Mask mode: statistics-driven auto ROI on starless reference
      console.writeln("Range Mask ROI detection (auto, per-filter)" + filterLabel + "...");
      var refWindow = ImageWindow.windowById(refImageId);
      if (!refWindow || refWindow.isNull) {
         progress.updateStep(stepName, progress.STATE_ERROR, "Window not found");
         throw new Error("Reference window not found: " + refImageId);
      }
      
      // CRITICAL: Ensure star removal happens BEFORE range mask analysis
      console.writeln("Preparing starless reference for ROI detection...");
      var refForROI = refImageId;
      var starlessRefId = refImageId + "_starless_for_roi";
      
      // Check if starless version already exists
      var starlessWindow = ImageWindow.windowById(starlessRefId);
      
      if (!starlessWindow || starlessWindow.isNull) {
         // Create starless version for ROI detection
         var starlessResult = runStarRemoval(
            CONFIG.starRemovalMethod, 
            CONFIG, 
            { label: "Reference", depth: subframes.length }, 
            refWindow, 
            filterSuffix + "_roi"
         );
         
         if (starlessResult) {
            starlessRefId = starlessResult.id;
            starlessWindow = starlessResult.window;
            console.writeln("Star removal completed for ROI reference");
         } else {
            console.warningln("Star removal failed - using starry reference for ROI detection");
            starlessRefId = refImageId;
            starlessWindow = refWindow;
         }
      } else {
         console.writeln("Using existing starless reference: " + starlessRefId);
      }
      
      // Compute range mask ROIs
      var rangeMaskResult = computeRangeMaskROIs(
         starlessWindow.mainView.image,
         CONFIG.autoRoiTileSize,
         CONFIG.saveDebugOverlay,
         CONFIG.outputDir,
         filterName
      );
      
      if (rangeMaskResult) {
         console.writeln("Range Mask ROI detection successful");
         rois = {
            bg: rangeMaskResult.bgRect,
            fg: rangeMaskResult.fgRect,
            meta: rangeMaskResult.meta
         };
         
         // Optionally create previews on the reference for visualization
         if (CONFIG.keepIntermediateImages) {
            createRangeMaskPreviews(refWindow, rangeMaskResult);
         }
      } else {
         console.warningln("Range Mask ROI detection failed - falling back to auto tile mode");
      }
   } else if (CONFIG.roiMode === "auto") {
      // Auto-detect ROIs (original tile-based method)
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
   
   // If auto/rangeMask mode failed or manual mode selected, use manual ROI
   if (!rois) {
      console.writeln("Waiting for user to define ROI previews" + filterLabel + "...");
      var autoFailed = (CONFIG.roiMode === "auto" || CONFIG.roiMode === "rangeMask");
      rois = promptForROIs(refImageId, autoFailed, filterName);
   }
   
   if (progress.isCancelled() || !rois) {
      console.writeln("ROI definition cancelled. Cleaning up...");
      closeImageWindow(refImageId);
      return null;
   }
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, "ROIs defined");
   console.writeln("Background ROI: " + formatRect(rois.bg));
   console.writeln("Foreground ROI: " + formatRect(rois.fg));
   console.writeln("Note: Reference master '" + refImageId + "' with ROI previews will remain open for reference");
   progress.updateElapsed();
   
   // Step: Generate integration depth list
   progress.setStatus("Planning integration depths" + filterLabel + "...");
   stepName = isMultiFilter ? ("plan_" + filterName) : "plan";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   console.writeln("Planning integration depths" + filterLabel + "...");
   var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subframes.length, CONFIG.customDepths, CONFIG.includeFullDepth);
   
   // Calculate total exposure for each depth
   calculateJobExposures(depthJobs, subframes);
   
   progress.updateStep(stepName, progress.STATE_SUCCESS, depthJobs.length + " depths planned");
   console.writeln("Planned " + depthJobs.length + " integration depths:");
   for (var i = 0; i < depthJobs.length; i++) {
      console.writeln("  " + depthJobs[i].label + ": " + depthJobs[i].depth + " subs (" + 
                    formatTime(depthJobs[i].totalExposure) + ")");
   }
   progress.updateElapsed();
   
   // Compute reference background for signal scale locking (if enabled)
   var bgRef = null;
   if (CONFIG.lockSignalScale) {
      console.writeln("");
      console.writeln("Computing reference background for signal normalization...");
      // Use the reference master (deepest integration) - Part C
      bgRef = computeBgRef(refImageId, rois.bg);
      if (bgRef) {
         rois.bgRef = bgRef;  // Store in rois for JSON output
         rois.bgRefSourceLabel = "Reference Master (full depth)";  // Part C - track source
         console.writeln("Signal scale locking enabled with BG_ref = " + bgRef.toFixed(8) + 
                        " from " + rois.bgRefSourceLabel);
      } else {
         console.warningln("Failed to compute BG_ref, signal scale normalization disabled for this filter");
      }
   }
   
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
      var starResult = runStarRemoval(CONFIG.starRemovalMethod, CONFIG, job, imageWindow, filterSuffix);
      
      if (starResult) {
         // Use starless image for SNR measurement
         closeImageWindow(imageId);
         imageId = starResult.id;
         imageWindow = starResult.window;
         job.starRemovalTime = job.starRemovalTimeSec;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stars removed (" + 
                           formatTime(job.starRemovalTimeSec) + ")");
      } else {
         // Continue with original starry image
         job.starRemovalTimeSec = 0;
         job.starRemovalTime = 0;
      }
      progress.updateElapsed();
      
      // Measure SNR on linear starless stack before any stretch
      // Pass bgRef for signal scale normalization if enabled
      var snrMetrics = measureSNR(imageId, rois.bg, rois.fg, bgRef);
      job.bgMean = snrMetrics.bgMean;
      job.bgMedian = snrMetrics.bgMedian;
      job.bgSigma = snrMetrics.bgSigma;
      job.bgSigmaMAD = snrMetrics.bgSigmaMAD;
      job.fgMean = snrMetrics.fgMean;
      job.fgMedian = snrMetrics.fgMedian;
      job.fgSigma = snrMetrics.fgSigma;
      job.fgSigmaMAD = snrMetrics.fgSigmaMAD;
      job.snr = snrMetrics.snr;
      job.snrBG = snrMetrics.snrBG;
      job.snrFG = snrMetrics.snrFG;
      // Store validation fields (Part A)
      job.scaleFactor = snrMetrics.scaleFactor;
      job.bgMedianRaw = snrMetrics.bgMedianRaw;
      job.bgMedianScaled = snrMetrics.bgMedianScaled;
      // Store global noise metrics
      job.globalMedian = snrMetrics.globalMedian;
      job.globalNoise = snrMetrics.globalNoise;
      
      // Compute Gain per Hour metrics (diminishing returns analysis)
      if (i > 0) {
         var prevJob = depthJobs[i - 1];
         var deltaSNR = job.snr - prevJob.snr;
         var deltaSNRpct = (prevJob.snr > 0) ? ((deltaSNR / prevJob.snr) * 100.0) : 0;
         var deltaTime = job.totalExposure - prevJob.totalExposure;  // in seconds
         var deltaHours = deltaTime / 3600.0;
         var gainPerHour = (deltaHours > 0) ? (deltaSNRpct / deltaHours) : 0;
         
         job.deltaSNRpct = deltaSNRpct;
         job.deltaHours = deltaHours;
         job.gainPerHour = gainPerHour;
      } else {
         job.deltaSNRpct = null;
         job.deltaHours = null;
         job.gainPerHour = null;
      }

      // STF stretch (optional) after measuring SNR
      if (CONFIG.applyStretch) {
         var stretchStart = new Date();
         applySTFStretch(imageId);
         job.stretchTime = (new Date() - stretchStart) / 1000;
         progress.updateStep(stepName, progress.STATE_RUNNING, "Stretched");
      } else {
         job.stretchTime = 0;
      }
      
      results.push(job);
      
      // Keep image open if user wants to review, otherwise close
      if (!CONFIG.keepIntermediateImages) {
         closeImageWindow(imageId);
      }
      
      progress.updateStep(stepName, progress.STATE_SUCCESS, "SNR: " + job.snr.toFixed(2));
      progress.updateElapsed();
      
      console.writeln("SNR: " + job.snr.toFixed(2) + " (bgμ: " + job.bgMean.toFixed(6) + 
              ", fgμ: " + job.fgMean.toFixed(6) + ", σ_bg: " + job.bgSigma.toFixed(6) + ")");
   }
   
   var totalTime = (new Date() - startTime) / 1000;
   
   if (progress.isCancelled()) {
      console.writeln("Analysis cancelled by user.");
      return null;
   }
   
   // Compute reference signal from deepest integration (decision metric)
   console.writeln("");
   console.writeln("Computing decision SNR with fixed signal reference...");
   
   // Sort by depth to find deepest
   results.sort(function(a, b) { return a.depth - b.depth; });
   var deepestResult = results[results.length - 1];
   var signalRef = deepestResult.fgMedian - deepestResult.bgMedian;
   var refLabel = deepestResult.label;
   
   console.writeln("Reference signal (deepest stack " + refLabel + "):");
   console.writeln("  signalRef = fgMedian - bgMedian = " + signalRef.toFixed(8));
   console.writeln("");
   
   // Compute snrStop for all depths using fixed signal
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      r.signalMeasured = r.fgMedian - r.bgMedian;
      r.signalRef = signalRef;
      r.snrMeasured = r.snr;  // Store original measured SNR
      r.snrStop = signalRef / r.bgSigmaMAD;  // Decision metric
      r.snr = r.snrStop;  // Override for downstream code
   }
   
   // Initialize metrics for first depth (no previous to compare)
   results[0].deltaSNRpct = null;
   results[0].deltaHours = null;
   results[0].gainPerHour = null;
   results[0].t10Hours = null;

   // Recompute gain/hr metrics using snrStop
   for (var i = 1; i < results.length; i++) {
      var r = results[i];
      var prevResult = results[i - 1];
      var deltaSNR = r.snrStop - prevResult.snrStop;
      var deltaSNRpct = (prevResult.snrStop > 0) ? ((deltaSNR / prevResult.snrStop) * 100.0) : 0;
      var deltaTime = r.totalExposure - prevResult.totalExposure;
      var deltaHours = deltaTime / 3600.0;
      var gainPerHour = (deltaHours > 0) ? (deltaSNRpct / deltaHours) : 0;
      
      r.deltaSNRpct = deltaSNRpct;
      r.deltaHours = deltaHours;
      r.gainPerHour = gainPerHour;
      
      // Compute hours for +10% SNR at current rate (T10)
      r.t10Hours = (deltaSNRpct > 0) ? (deltaHours * (10.0 / deltaSNRpct)) : Infinity;
   }
   
   // Step: Output results
   stepName = isMultiFilter ? ("output_" + filterName) : "output";
   progress.updateStep(stepName, progress.STATE_RUNNING);
   progress.setStatus("Generating outputs" + filterLabel + "...");
   progress.updateElapsed();
   console.writeln("");
   console.writeln("Generating outputs" + filterLabel + "...");
   
   // Console summary
   printResultsSummary(results, signalRef, refLabel);
   
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
   
   // Graphs (SNR and Gain/hr)
   var graphPath = null;
   var gainGraphPath = null;
   if (CONFIG.generateGraph) {
      stepName = isMultiFilter ? ("graph_" + filterName) : "graph";
      progress.updateStep(stepName, progress.STATE_RUNNING);
      progress.setStatus("Generating graphs" + filterLabel + "...");
      progress.updateElapsed();
      console.writeln("Generating graphs" + filterLabel + "...");
      
      // SNR graph
      graphPath = generateGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (graphPath) {
         console.writeln("SNR graph written: " + graphPath);
      } else {
         console.warningln("SNR graph generation failed");
      }
      
      // Gain/hr graph
      gainGraphPath = generateGainGraph(results, CONFIG.outputDir, filterSuffix, filterName);
      if (gainGraphPath) {
         console.writeln("Gain/hr graph written: " + gainGraphPath);
      } else {
         console.warningln("Gain/hr graph generation failed");
      }
      
      if (graphPath || gainGraphPath) {
         progress.updateStep(stepName, progress.STATE_SUCCESS, "Graphs saved");
      } else {
         progress.updateStep(stepName, progress.STATE_WARNING, "Graph generation failed");
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
      filterSuffix: filterSuffix,
      results: results,
      rois: rois,
      insights: insights,
      totalTime: totalTime,
      graphPath: graphPath,
      gainGraphPath: gainGraphPath
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
         
         // Setup organized output directory structure
         setupOutputDirectories(CONFIG.outputDir);
         
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
         
         var summaryParts = [];
         var totalSubs = 0;
         for (var fg in filterGroups) {
            var count = filterGroups[fg].length;
            totalSubs += count;
            summaryParts.push(fg + ": " + count);
         }
         var summaryText = summaryParts.join(" | ");
         progress.updateStep("scan", progress.STATE_SUCCESS, summaryText + " (Total: " + totalSubs + ")");
         progress.updateElapsed();
         
         // Add steps for each filter
         for (var filterName in filterGroups) {
            var subs = filterGroups[filterName];
            console.writeln("Total exposure for " + filterName + ": " + formatTime(getTotalExposure(subs)));
            
            if (isMultiFilter) {
               progress.addStep("ref_master_" + filterName, "Reference master (" + filterName + ")");
               progress.addStep("roi_" + filterName, "ROI definition (" + filterName + ")");
               progress.addStep("plan_" + filterName, "Planning (" + filterName + ")");
               
               var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subs.length, CONFIG.customDepths, CONFIG.includeFullDepth);
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
               
               var depthJobs = planIntegrationDepths(CONFIG.depthStrategy, subs.length, CONFIG.customDepths, CONFIG.includeFullDepth);
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
               if (progress.isCancelled()) {
                  progress.close();
                  console.writeln("Analysis cancelled by user.");
                  return;
               }
               
               var subs = filterGroups[filterName];
               var filterSuffix = "_" + filterName.replace(/[^a-zA-Z0-9]/g, "_");
               var stepName = "ref_master_" + filterName;
               
               progress.setStatus("Creating reference master (" + filterName + ")...");
               progress.updateStep(stepName, progress.STATE_RUNNING);
               console.writeln("Creating reference master for " + filterName + "...");
               
               var refImageId = "ref_master_full" + filterSuffix;
               var refWindow = ImageWindow.windowById(refImageId);
               
               if (!refWindow || refWindow.isNull) {
                  var refPath = CONFIG.integrationsDir + "/ref_master_full" + filterSuffix + ".xisf";
                  if (File.exists(refPath)) {
                     console.writeln("Loading existing reference master from disk...");
                     var windows = ImageWindow.open(refPath);
                     if (windows && windows.length > 0) {
                        refWindow = windows[0];
                        refWindow.mainView.id = refImageId;
                        refImageId = refWindow.mainView.id;
                        refWindow.show();
                        refWindow.zoomToFit();
                     }
                  }
               }
               
               if (!refWindow || refWindow.isNull) {
                  refImageId = performFullIntegration(subs, CONFIG.outputDir, filterSuffix);
                  if (!refImageId) {
                     progress.updateStep(stepName, progress.STATE_ERROR, "Integration failed");
                     throw new Error("Full integration failed for " + filterName);
                  }
                  refWindow = ImageWindow.windowById(refImageId);
                  if (refWindow && !refWindow.isNull) {
                     refWindow.show();
                     refWindow.zoomToFit();
                  }
                  progress.updateStep(stepName, progress.STATE_SUCCESS, "New master created");
               } else {
                  console.writeln("Using existing reference master: " + refImageId);
                  refWindow.show();
                  refWindow.zoomToFit();
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
               if (progress.isCancelled()) {
                  progress.close();
                  console.writeln("Analysis cancelled by user.");
                  return;
               }
               
               var refId = refMasters[filterName];
               var stepName = "roi_" + filterName;
               
               progress.setStatus("Defining ROI regions (" + filterName + ")...");
               progress.updateStep(stepName, progress.STATE_RUNNING);
               
               try {
                  var rois = null;
                  
                  if (CONFIG.roiMode === "rangeMask") {
                     // Range Mask mode: statistics-driven auto ROI on starless reference
                     console.writeln("Range Mask ROI detection (auto, per-filter) for " + filterName + "...");
                     var refWindow = ImageWindow.windowById(refId);
                     if (refWindow && !refWindow.isNull) {
                        // CRITICAL: Ensure star removal happens BEFORE range mask analysis
                        console.writeln("Preparing starless reference for ROI detection (" + filterName + ")...");
                        var starlessRefId = refId + "_starless_for_roi";
                        
                        // Check if starless version already exists
                        var starlessWindow = ImageWindow.windowById(starlessRefId);
                        
                        if (!starlessWindow || starlessWindow.isNull) {
                           // Create starless version for ROI detection
                           var filterSuffix = "_" + filterName.replace(/[^a-zA-Z0-9]/g, "_");
                           var subs = filterGroups[filterName];
                           var starlessResult = runStarRemoval(
                              CONFIG.starRemovalMethod, 
                              CONFIG, 
                              { label: "Reference", depth: subs.length }, 
                              refWindow, 
                              filterSuffix + "_roi"
                           );
                           
                           if (starlessResult) {
                              starlessRefId = starlessResult.id;
                              starlessWindow = starlessResult.window;
                              console.writeln("Star removal completed for ROI reference (" + filterName + ")");
                           } else {
                              console.warningln("Star removal failed - using starry reference for ROI detection (" + filterName + ")");
                              starlessRefId = refId;
                              starlessWindow = refWindow;
                           }
                        } else {
                           console.writeln("Using existing starless reference: " + starlessRefId);
                        }
                        
                        // Compute range mask ROIs
                        var rangeMaskResult = computeRangeMaskROIs(
                           starlessWindow.mainView.image,
                           CONFIG.autoRoiTileSize,
                           CONFIG.saveDebugOverlay,
                           CONFIG.outputDir,
                           filterName
                        );
                        
                        if (rangeMaskResult) {
                           console.writeln(filterName + " - Range Mask ROI detection successful");
                           rois = {
                              bg: rangeMaskResult.bgRect,
                              fg: rangeMaskResult.fgRect,
                              meta: rangeMaskResult.meta
                           };
                           
                           // Create previews on the reference for visualization
                           createRangeMaskPreviews(refWindow, rangeMaskResult);
                        } else {
                           console.warningln(filterName + " - Range Mask ROI detection failed - falling back to manual mode");
                        }
                     }
                  } else if (CONFIG.roiMode === "auto") {
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
                  
                  // If auto/rangeMask mode failed or manual mode selected, use manual ROI
                  if (!rois) {
                     var autoFailed = (CONFIG.roiMode === "auto" || CONFIG.roiMode === "rangeMask");
                     rois = promptForROIs(refId, autoFailed, filterName);
                  }
                  
                  // Compute reference background for signal scale locking (if enabled)
                  if (rois && CONFIG.lockSignalScale) {
                     console.writeln("Computing reference background for signal normalization (" + filterName + ")...");
                     var bgRef = computeBgRef(refId, rois.bg);
                     if (bgRef) {
                        rois.bgRef = bgRef;
                        rois.bgRefSourceLabel = "Reference Master (full depth)";  // Part C
                        console.writeln(filterName + " - Signal scale locking enabled with BG_ref = " + bgRef.toFixed(8) +
                                      " from " + rois.bgRefSourceLabel);
                     } else {
                        console.warningln(filterName + " - Failed to compute BG_ref, signal scale normalization disabled");
                     }
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
         }
         
         // Step 4: Process each filter group
         console.writeln("[4/4] Processing filter groups...");
         var allFilterResults = [];
         
         for (var filterName in filterGroups) {
            if (progress.isCancelled()) {
               progress.close();
               console.writeln("Analysis cancelled by user.");
               return;
            }
            
            var subs = filterGroups[filterName];
            
            if (isMultiFilter) {
               var filterResult = processFilterGroupAnalysis(filterName, subs, refMasters[filterName], 
                                                            allROIs[filterName], progress, isMultiFilter);
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
         console.writeln("");
         console.writeln("=== REFERENCE MASTERS ===");
         for (var i = 0; i < allFilterResults.length; i++) {
            if (allFilterResults[i].refImageId) {
               console.writeln("  " + allFilterResults[i].filterName + ": " + 
                              allFilterResults[i].refImageId + " (with ROI previews - left open)");
            }
         }
         console.writeln("");
         
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
