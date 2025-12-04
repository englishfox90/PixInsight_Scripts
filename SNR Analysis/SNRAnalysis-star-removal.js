/*
 * SNRAnalysis-star-removal.js
 * Production-grade star removal module with version-safe StarXTerminator/StarNet2 integration
 * Part of SNR vs Integration Time Analysis Tool
 */

/**
 * Check if a star removal method is available
 * @param {string} method - "StarNet2" or "StarXTerminator"
 * @returns {boolean} True if process is installed
 */
function isStarRemovalAvailable(method) {
   try {
      if (method === "StarNet2") {
         // Try to instantiate - if it fails, it's not installed
         var sn = new StarNet();
         return true;
      } else if (method === "StarXTerminator") {
         var sxt = new StarXTerminator();
         return true;
      }
   } catch (e) {
      // Process not found
      return false;
   }
   return false;
}

/**
 * Generic star removal wrapper - main entry point
 * 
 * @param {string} method - "StarNet2" or "StarXTerminator"
 * @param {Object} config - Global CONFIG object
 * @param {Object} job - Job object (label, depth, etc.) - receives timing info
 * @param {ImageWindow} imageWindow - Integrated stack window
 * @returns {Object|null} {id, window, path, elapsedSec} or null on failure
 */
function runStarRemoval(method, config, job, imageWindow) {
   if (!config.generateStarless) {
      return null;
   }
   
   if (!imageWindow || imageWindow.isNull) {
      console.warningln("Invalid image window for star removal");
      return null;
   }
   
   console.writeln("Removing stars using " + method + "...");
   
   if (method === "StarXTerminator") {
      return removeStarsWithStarX(config, job, imageWindow);
   } else if (method === "StarNet2") {
      return removeStarsWithStarNet(config, job, imageWindow);
   } else {
      console.warningln("Unknown star removal method: " + method);
      return null;
   }
}

/**
 * Remove stars using StarXTerminator (version-safe)
 * 
 * @param {Object} config - Global CONFIG object
 * @param {Object} job - Job object
 * @param {ImageWindow} imageWindow - Source window
 * @returns {Object|null} {id, window, path, elapsedSec} or null
 */
function removeStarsWithStarX(config, job, imageWindow) {
   // Check availability by trying to instantiate
   var P;
   try {
      P = new StarXTerminator();
   } catch (e) {
      console.warningln("StarXTerminator not installed. Install from Process > All Processes.");
      console.warningln("Continuing without star removal for " + job.label);
      return null;
   }
   
   // Detect version by checking available properties
   var hasNewStyle = (P.hasOwnProperty("createStarlessImage") || 
                      P.createStarlessImage !== undefined);
   var hasOldStyle = (P.hasOwnProperty("stars") || P.stars !== undefined);
   
   var finalId = "int_" + job.label + "_starless";
   
   // Configure parameters (version-safe)
   if (hasNewStyle) {
      // Newer StarXTerminator versions
      if (P.hasOwnProperty("createStarlessImage")) P.createStarlessImage = true;
      if (P.hasOwnProperty("newStarlessImageId")) P.newStarlessImageId = finalId;
      if (P.hasOwnProperty("linear")) P.linear = !!config.starRemovalLinear;
      if (P.hasOwnProperty("ai_file")) P.ai_file = "";  // Default model
   } else if (hasOldStyle) {
      // Older StarXTerminator versions
      if (P.hasOwnProperty("stars")) P.stars = false;  // Generate starless, not star mask
      if (P.hasOwnProperty("linear")) P.linear = !!config.starRemovalLinear;
      if (P.hasOwnProperty("unscreen_stars")) P.unscreen_stars = false;
      if (P.hasOwnProperty("unscreen_correction")) {
         P.unscreen_correction = config.starRemovalStrength || 0.70;
      }
      if (P.hasOwnProperty("ai_file")) P.ai_file = "";
   } else {
      console.warningln("Unknown StarXTerminator version - attempting with defaults");
   }
   
   // Execute with timing
   var t0 = new Date().getTime();
   var executeSuccess = false;
   
   try {
      executeSuccess = P.executeOn(imageWindow.mainView);
   } catch (e) {
      console.warningln("StarXTerminator execution error (" + job.label + "): " + e.message);
      console.warningln("This may be due to swap file permissions. Check Edit > Preferences > Directories.");
      return null;
   }
   
   var t1 = new Date().getTime();
   var elapsedSec = (t1 - t0) / 1000;
   job.starRemovalTimeSec = elapsedSec;
   
   if (!executeSuccess) {
      console.warningln("StarXTerminator execution failed for " + job.label);
      return null;
   }
   
   // Find output window - StarXTerminator creates window with "_starless" suffix
   // Try multiple variations since filter suffix can cause double underscores
   var baseId = imageWindow.mainView.id;
   var possibleIds = [
      baseId + "_starless",                    // Standard: int_N256__Ha__starless
      baseId.replace(/__/g, "_") + "_starless", // Remove double underscores: int_N256_Ha_starless
      finalId,                                   // Our target: int_N256_starless__Ha_
      "int_" + job.label + "_starless"          // Without filter suffix
   ];
   
   var starlessWindow = null;
   var foundId = null;
   
   for (var i = 0; i < possibleIds.length; i++) {
      starlessWindow = ImageWindow.windowById(possibleIds[i]);
      if (starlessWindow && !starlessWindow.isNull) {
         foundId = possibleIds[i];
         console.writeln("Found StarXTerminator output: " + foundId);
         break;
      }
   }
   
   if (!starlessWindow || starlessWindow.isNull) {
      console.warningln("StarXTerminator output window not found for " + job.label);
      console.warningln("Tried IDs: " + possibleIds.join(", "));
      console.warningln("Available windows:");
      var allWindows = ImageWindow.windows;
      for (var i = 0; i < allWindows.length; i++) {
         console.warningln("  - " + allWindows[i].mainView.id);
      }
      return null;
   }
   
   // Rename to our standard naming if needed
   if (starlessWindow.mainView.id !== finalId) {
      starlessWindow.mainView.id = finalId;
   }
   
   // Save to disk
   var outputPath = config.outputDir + "/" + finalId + ".xisf";
   if (!starlessWindow.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save starless image: " + outputPath);
   }
   
   return {
      id: finalId,
      window: starlessWindow,
      path: outputPath,
      elapsedSec: elapsedSec
   };
}

/**
 * Remove stars using StarNet2 (version-safe)
 * 
 * @param {Object} config - Global CONFIG object
 * @param {Object} job - Job object
 * @param {ImageWindow} imageWindow - Source window
 * @returns {Object|null} {id, window, path, elapsedSec} or null
 */
function removeStarsWithStarNet(config, job, imageWindow) {
   // Try to instantiate StarNet
   var P;
   try {
      P = new StarNet();
   } catch (e) {
      console.warningln("StarNet2 not installed. Install from Process > All Processes.");
      console.warningln("Continuing without star removal for " + job.label);
      return null;
   }
   
   var finalId = "int_" + job.label + "_starless";
   
   // Configure parameters (version-safe)
   if (P.hasOwnProperty("stride")) {
      // Typical values: Stride_128, Stride_256
      if (StarNet.prototype.Stride_128 !== undefined) {
         P.stride = StarNet.prototype.Stride_128;
      } else if (P.stride !== undefined) {
         P.stride = 128;  // Fallback numeric value
      }
   }
   
   if (P.hasOwnProperty("mask")) {
      P.mask = false;  // Generate starless image, not star mask
   }
   
   // Some versions may have linear flag
   if (P.hasOwnProperty("linear")) {
      P.linear = !!config.starRemovalLinear;
   }
   
   // Execute with timing
   var t0 = new Date().getTime();
   var executeSuccess = false;
   
   try {
      executeSuccess = P.executeOn(imageWindow.mainView);
   } catch (e) {
      console.warningln("StarNet execution error (" + job.label + "): " + e.message);
      return null;
   }
   
   var t1 = new Date().getTime();
   var elapsedSec = (t1 - t0) / 1000;
   job.starRemovalTimeSec = elapsedSec;
   
   if (!executeSuccess) {
      console.warningln("StarNet execution failed for " + job.label);
      return null;
   }
   
   // Find output window (StarNet typically creates <id>_starless)
   var starlessId = imageWindow.mainView.id + "_starless";
   var starlessWindow = ImageWindow.windowById(starlessId);
   
   if (!starlessWindow || starlessWindow.isNull) {
      console.warningln("StarNet output window not found for " + job.label);
      console.warningln("Expected ID: " + starlessId);
      return null;
   }
   
   // Rename to our standard naming
   starlessWindow.mainView.id = finalId;
   
   // Save to disk
   var outputPath = config.outputDir + "/" + finalId + ".xisf";
   if (!starlessWindow.saveAs(outputPath, false, false, false, false)) {
      console.warningln("Failed to save starless image: " + outputPath);
   }
   
   return {
      id: finalId,
      window: starlessWindow,
      path: outputPath,
      elapsedSec: elapsedSec
   };
}

/**
 * Legacy compatibility wrapper
 * @deprecated Use runStarRemoval() instead
 */
function removeStars(imageId, label, method, outputDir) {
   console.warningln("DEPRECATED: removeStars() called. Use runStarRemoval() instead.");
   
   var window = ImageWindow.windowById(imageId);
   if (!window || window.isNull) {
      console.warningln("Image window not found: " + imageId);
      return null;
   }
   
   var fakeConfig = {
      generateStarless: true,
      starRemovalLinear: true,
      outputDir: outputDir
   };
   
   var fakeJob = { label: label };
   
   var result = runStarRemoval(method, fakeConfig, fakeJob, window);
   return result ? result.id : null;
}
