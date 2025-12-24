/*
 * SNRAnalysis-roi-rangemask.js
 * Range mask-based automatic ROI detection (per-filter group)
 */

// Image constructor parameters: width, height, numberOfChannels, bitsPerSample, isFloat
// For grayscale masks: 1 channel, 32 bits, float
// For RGB debug: 3 channels, 32 bits, float

/**
 * Create previews on window from range mask rectangles
 * 
 * @param {ImageWindow} window - Window to create previews on
 * @param {Object} rangeMaskResult - Result from computeRangeMaskROIs
 * @returns {boolean} True if previews created successfully
 */
function createRangeMaskPreviews(window, rangeMaskResult) {
   if (!window || window.isNull) {
      Console.warningln("Range Mask: Invalid window for preview creation");
      return false;
   }
   
   if (!rangeMaskResult || !rangeMaskResult.bgRect || !rangeMaskResult.fgRect) {
      Console.warningln("Range Mask: Invalid result provided");
      return false;
   }
   
   try {
      Console.writeln("Creating Range Mask ROI previews...");
      
      // Remove existing BG/FG previews if they exist
      for (var i = window.previews.length - 1; i >= 0; i--) {
         var preview = window.previews[i];
         if (preview.id.toUpperCase() === "BG" || preview.id.toUpperCase() === "FG") {
            Console.writeln("Removing existing preview: " + preview.id);
            window.deletePreview(preview);
         }
      }
      
      // Create BG preview
      var bgRect = rangeMaskResult.bgRect;
      var bgPreview = window.createPreview(bgRect.x0, bgRect.y0, bgRect.x1, bgRect.y1);
      bgPreview.id = "BG";
      Console.writeln("Created BG preview: " + formatRect(bgRect));
      
      // Create FG preview
      var fgRect = rangeMaskResult.fgRect;
      var fgPreview = window.createPreview(fgRect.x0, fgRect.y0, fgRect.x1, fgRect.y1);
      fgPreview.id = "FG";
      Console.writeln("Created FG preview: " + formatRect(fgRect));
      
      return true;
      
   } catch (error) {
      Console.warningln("Range Mask: Failed to create previews: " + error.message);
      return false;
   }
}

/**
 * Compute FG/BG ROIs using range mask analysis on a starless reference image.
 * This is a deterministic, statistics-driven approach requiring no user intervention.
 * 
 * Algorithm:
 * 1. Compute robust background statistics (median, MAD, sigma)
 * 2. Search over threshold multipliers (k) to find optimal FG mask
 * 3. Score each candidate by signal contrast: (fg_med - bg_med) / bg_sigma
 * 4. Apply mask cleanup (blur, morphology) to reduce noise
 * 5. Select BG tile: lowest sigma within safe background zone
 * 6. Select FG tile: highest median within eroded foreground mask
 * 
 * @param {Image} image - Starless linear reference image
 * @param {number} tileSize - Size of ROI tiles (from UI Auto Tile Size)
 * @param {boolean} saveDebug - Whether to save debug overlay
 * @param {string} outputDir - Output directory for debug files
 * @param {string} filterName - Filter name for debug file naming
 * @returns {Object|null} {fgRect, bgRect, meta} or null if failed
 */
function computeRangeMaskROIs(image, tileSize, saveDebug, outputDir, filterName) {
   if (!image) {
      Console.warningln("Range Mask ROI: Invalid image provided");
      return null;
   }
   
   try {
      tileSize = tileSize || 96;
      
      Console.writeln("");
      Console.writeln("=== RANGE MASK ROI DETECTION ===");
      Console.writeln("Filter: " + (filterName || "All"));
      Console.writeln("Tile size: " + tileSize + " pixels");
      Console.writeln("Image size: " + image.width + "x" + image.height);
   
   var width = image.width;
   var height = image.height;
   var minDim = Math.min(width, height);
   
   if (width < tileSize * 3 || height < tileSize * 3) {
      Console.warningln("Range Mask ROI: Image too small for tile size " + tileSize);
      return null;
   }
   
   // Step 1: Compute robust background statistics
   Console.writeln("Computing robust image statistics...");
   
   var globalMedian = image.median();
   var globalMAD = image.MAD();
   var globalSigma = 1.4826 * globalMAD;
   
   Console.writeln("  Global median: " + globalMedian.toFixed(6));
   Console.writeln("  Global MAD: " + globalMAD.toFixed(6));
   Console.writeln("  Robust sigma: " + globalSigma.toFixed(6));
   
   if (globalSigma < 1e-8) {
      Console.warningln("Range Mask ROI: Image has near-zero variation (flat)");
      return null;
   }
   
   // Step 2: Define safe zone (exclude borders)
   var borderMargin = Math.round(minDim * 0.03);
   borderMargin = Math.max(20, Math.min(200, borderMargin));
   Console.writeln("Border margin: " + borderMargin + " pixels");
   
   // Step 3: Search for optimal threshold
   Console.writeln("Searching for optimal foreground threshold...");
   
   var kCandidates = [2.0, 2.5, 3.0, 3.5, 4.0, 4.5, 5.0, 6.0];
   var bestCandidate = null;
   var bestScore = -1e9;
   
   for (var ki = 0; ki < kCandidates.length; ki++) {
      var k = kCandidates[ki];
      var threshold = globalMedian + k * globalSigma;
      
      // Create provisional FG mask
      var fgMask = createThresholdMask(image, threshold);
      
      // Apply cleanup (smooth + morphological close)
      fgMask = cleanupMask(fgMask);
      
      // Compute mask statistics
      var maskStats = analyzeMask(image, fgMask, borderMargin);
      
      if (!maskStats) continue;
      
      var fgArea = maskStats.fgArea;
      var bgArea = maskStats.bgArea;
      var fgMedian = maskStats.fgMedian;
      var bgMedian = maskStats.bgMedian;
      var bgSigma = maskStats.bgSigma;
      
      // Apply constraints
      var minArea = 0.01;
      var maxArea = 0.40;
      
      if (fgArea < minArea || fgArea > maxArea) {
         Console.writeln("  k=" + k.toFixed(1) + ": FG area " + (fgArea*100).toFixed(1) + "% out of range [" + (minArea*100) + "%, " + (maxArea*100) + "%]");
         continue;
      }
      
      if (bgArea < 0.1) {
         Console.writeln("  k=" + k.toFixed(1) + ": BG area too small (" + (bgArea*100).toFixed(1) + "%)");
         continue;
      }
      
      if (bgSigma < 1e-8) {
         Console.writeln("  k=" + k.toFixed(1) + ": BG sigma too low");
         continue;
      }
      
      // Compute score: signal contrast
      var score = (fgMedian - bgMedian) / bgSigma;
      
      Console.writeln("  k=" + k.toFixed(1) + ": threshold=" + threshold.toFixed(6) + 
                     ", FG area=" + (fgArea*100).toFixed(1) + "%" +
                     ", score=" + score.toFixed(2));
      
      if (score > bestScore) {
         bestScore = score;
         bestCandidate = {
            k: k,
            threshold: threshold,
            fgMask: fgMask,
            fgArea: fgArea,
            bgArea: bgArea,
            fgMedian: fgMedian,
            bgMedian: bgMedian,
            bgSigma: bgSigma,
            score: score
         };
      }
   }
   
   // Fallback with relaxed constraints if no candidate found
   if (!bestCandidate) {
      Console.writeln("No candidates with standard constraints, trying relaxed...");
      
      for (var ki = 0; ki < kCandidates.length; ki++) {
         var k = kCandidates[ki];
         var threshold = globalMedian + k * globalSigma;
         
         var fgMask = createThresholdMask(image, threshold);
         fgMask = cleanupMask(fgMask);
         var maskStats = analyzeMask(image, fgMask, borderMargin);
         
         if (!maskStats) continue;
         
         var fgArea = maskStats.fgArea;
         var bgSigma = maskStats.bgSigma;
         
         // Relaxed constraints
         if (fgArea < 0.005 || fgArea > 0.60 || bgSigma < 1e-8) continue;
         
         var score = (maskStats.fgMedian - maskStats.bgMedian) / bgSigma;
         
         if (score > bestScore) {
            bestScore = score;
            bestCandidate = {
               k: k,
               threshold: threshold,
               fgMask: fgMask,
               fgArea: fgArea,
               bgArea: maskStats.bgArea,
               fgMedian: maskStats.fgMedian,
               bgMedian: maskStats.bgMedian,
               bgSigma: bgSigma,
               score: score
            };
         }
      }
   }
   
   if (!bestCandidate) {
      Console.warningln("Range Mask ROI: No valid threshold found");
      Console.warningln("  Image may have very low contrast or unusual structure");
      Console.warningln("  Consider using Manual ROIs or Auto-detect BG/FG mode");
      return null;
   }
   
   Console.writeln("Selected threshold: k=" + bestCandidate.k.toFixed(1) + 
                  ", T=" + bestCandidate.threshold.toFixed(6));
   Console.writeln("  FG area: " + (bestCandidate.fgArea*100).toFixed(1) + "%");
   Console.writeln("  FG median: " + bestCandidate.fgMedian.toFixed(6));
   Console.writeln("  BG median: " + bestCandidate.bgMedian.toFixed(6));
   Console.writeln("  BG sigma: " + bestCandidate.bgSigma.toFixed(6));
   Console.writeln("  Signal contrast: " + bestCandidate.score.toFixed(2) + " sigma");
   
   // Step 4: Select BG tile
   Console.writeln("Selecting background tile...");
   
   var bufferPx = Math.max(32, Math.round(minDim * 0.02));
   var bgMask = createBGCandidateMask(bestCandidate.fgMask, borderMargin, bufferPx);
   
   var bgTile = selectBGTile(image, bgMask, tileSize);
   
   if (!bgTile) {
      Console.warningln("Range Mask ROI: No valid BG tile found");
      return null;
   }
   
   Console.writeln("Selected BG tile at (" + bgTile.x + ", " + bgTile.y + ")");
   Console.writeln("  Sigma: " + bgTile.sigma.toFixed(6));
   
   // Step 5: Select FG tile
   Console.writeln("Selecting foreground tile...");
   
   var erodePx = Math.max(2, Math.round(tileSize * 0.05));
   var fgInnerMask = erodeMask(bestCandidate.fgMask, erodePx);
   
   // Require FG to be at least 25% of image diagonal away from BG
   var minSeparation = Math.sqrt(width * width + height * height) * 0.25;
   
   var fgTile = selectFGTile(image, fgInnerMask, bestCandidate.fgMask, tileSize, bestCandidate.bgMedian, bgTile, minSeparation);
   
   if (!fgTile) {
      Console.warningln("Range Mask ROI: No valid FG tile found");
      return null;
   }
   
   Console.writeln("Selected FG tile at (" + fgTile.x + ", " + fgTile.y + ")");
   Console.writeln("  Median: " + fgTile.median.toFixed(6));
   
   // Calculate actual separation
   var actualSeparation = Math.sqrt(
      Math.pow(fgTile.x + tileSize/2 - bgTile.x - tileSize/2, 2) +
      Math.pow(fgTile.y + tileSize/2 - bgTile.y - tileSize/2, 2)
   );
   Console.writeln("  BG-FG separation: " + Math.round(actualSeparation) + " pixels (" + 
                  (actualSeparation / Math.sqrt(width*width + height*height) * 100).toFixed(1) + "% of diagonal)");
   
   // Ensure BG and FG are not the same tile
   if (bgTile.x === fgTile.x && bgTile.y === fgTile.y) {
      Console.warningln("Range Mask ROI: BG and FG selected the same tile");
      return null;
   }
   
   var result = {
      bgRect: { x0: bgTile.x, y0: bgTile.y, x1: bgTile.x + tileSize, y1: bgTile.y + tileSize },
      fgRect: { x0: fgTile.x, y0: fgTile.y, x1: fgTile.x + tileSize, y1: fgTile.y + tileSize },
      meta: {
         k: bestCandidate.k,
         threshold: bestCandidate.threshold,
         fgArea: bestCandidate.fgArea,
         bgSigma: bestCandidate.bgSigma,
         signalContrast: bestCandidate.score,
         tileSize: tileSize,
         filterName: filterName || "All"
      }
   };
   
   // Optional: Save debug overlay
   if (saveDebug && outputDir) {
      saveDebugOverlay(image, bestCandidate.fgMask, result, outputDir, filterName);
   }
   
   Console.writeln("Range Mask ROI detection successful");
   Console.writeln("");
   
   return result;
   
   } catch (error) {
      Console.criticalln("Range Mask ROI detection failed with error:");
      Console.criticalln("  " + error.message);
      if (error.stack) {
         Console.criticalln("  Stack: " + error.stack);
      }
      return null;
   }
}

/**
 * Create a binary mask where pixels > threshold
 */
function createThresholdMask(image, threshold) {
   var mask = new Image(Math.floor(image.width), Math.floor(image.height), 1, 0, 32, 1);
   
   // For each pixel, set to 1.0 if above threshold, else 0.0
   for (var y = 0; y < image.height; y++) {
      for (var x = 0; x < image.width; x++) {
         var value = image.sample(x, y, 0); // Use first channel
         mask.setSample(value > threshold ? 1.0 : 0.0, x, y, 0);
      }
   }
   
   return mask;
}

/**
 * Clean up mask: light blur + morphological close (dilate then erode)
 */
function cleanupMask(mask) {
   try {
      var cleaned = new Image(Math.floor(mask.width), Math.floor(mask.height), 1, 0, 32, 1);
      cleaned.assign(mask);
      
      // Create temporary window for processing
      var tempWindow = new ImageWindow(Math.floor(mask.width), Math.floor(mask.height), 1, 32, true, false, "temp_mask_cleanup");
      tempWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
      tempWindow.mainView.image.assign(cleaned);
      tempWindow.mainView.endProcess();
      
      // Light gaussian blur (sigma=1.0) to smooth noise
      var G = new Convolution;
      G.mode = Convolution.prototype.Parametric;
      G.sigma = 1.0;
      G.shape = 2.0;
      G.executeOn(tempWindow.mainView);
      
      // Get the blurred result
      cleaned.assign(tempWindow.mainView.image);
      
      // Re-binarize after blur
      for (var y = 0; y < cleaned.height; y++) {
         for (var x = 0; x < cleaned.width; x++) {
            var v = cleaned.sample(x, y, 0);
            cleaned.setSample(v > 0.5 ? 1.0 : 0.0, x, y, 0);
         }
      }
      
      // Update window with binarized image
      tempWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
      tempWindow.mainView.image.assign(cleaned);
      tempWindow.mainView.endProcess();
      
      // Morphological close: dilate then erode (radius=2 pixels)
      var M = new MorphologicalTransformation;
      M.operator = MorphOp_Dilation;
      M.interlacingDistance = 1;
      M.lowThreshold = 0.5;
      M.highThreshold = 1.0;
      M.numberOfIterations = 2;
      M.amount = 1.0;
      M.selectionPoint = 0.5;
      M.structureSize = 3;
      // Use default structure (circular)
      
      M.executeOn(tempWindow.mainView);
      
      // Erode
      M.operator = MorphOp_Erosion;
      M.executeOn(tempWindow.mainView);
      
      // Get final result
      cleaned.assign(tempWindow.mainView.image);
      
      // Close temp window
      tempWindow.forceClose();
      
      return cleaned;
      
   } catch (error) {
      Console.warningln("Mask cleanup failed: " + error.message);
      Console.warningln("Using uncleaned mask");
      if (typeof tempWindow !== 'undefined' && !tempWindow.isNull) {
         tempWindow.forceClose();
      }
      return mask; // Return original mask if cleanup fails
   }
}

/**
 * Analyze mask to compute FG and BG statistics
 */
function analyzeMask(image, mask, borderMargin) {
   var width = image.width;
   var height = image.height;
   var totalPixels = width * height;
   
   var fgPixels = [];
   var bgPixels = [];
   
   var fgCount = 0;
   var bgCount = 0;
   
   for (var y = borderMargin; y < height - borderMargin; y++) {
      for (var x = borderMargin; x < width - borderMargin; x++) {
         var isFG = mask.sample(x, y, 0) > 0.5;
         var value = image.sample(x, y, 0);
         
         if (isFG) {
            fgPixels.push(value);
            fgCount++;
         } else {
            bgPixels.push(value);
            bgCount++;
         }
      }
   }
   
   if (fgCount < 10 || bgCount < 10) {
      return null;
   }
   
   // Sort for median calculation
   fgPixels.sort(function(a,b){return a-b;});
   bgPixels.sort(function(a,b){return a-b;});
   
   var fgMedian = fgPixels[Math.floor(fgPixels.length / 2)];
   var bgMedian = bgPixels[Math.floor(bgPixels.length / 2)];
   
   // Compute BG MAD
   var bgDeviations = [];
   for (var i = 0; i < bgPixels.length; i++) {
      bgDeviations.push(Math.abs(bgPixels[i] - bgMedian));
   }
   bgDeviations.sort(function(a,b){return a-b;});
   var bgMAD = bgDeviations[Math.floor(bgDeviations.length / 2)];
   var bgSigma = 1.4826 * bgMAD;
   
   var safeZonePixels = (width - 2*borderMargin) * (height - 2*borderMargin);
   
   return {
      fgArea: fgCount / safeZonePixels,
      bgArea: bgCount / safeZonePixels,
      fgMedian: fgMedian,
      bgMedian: bgMedian,
      bgSigma: bgSigma
   };
}

/**
 * Create BG candidate mask: safe zone minus FG buffer
 */
function createBGCandidateMask(fgMask, borderMargin, bufferPx) {
   var width = fgMask.width;
   var height = fgMask.height;
   
   // Dilate FG mask
   var fgBuffered = new Image(Math.floor(width), Math.floor(height), 1, 0, 32, 1);
   fgBuffered.assign(fgMask);
   
   // Create temporary window for morphological processing
   var tempWindow = new ImageWindow(Math.floor(width), Math.floor(height), 1, 32, true, false, "temp_morph_dilation");
   tempWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
   tempWindow.mainView.image.assign(fgBuffered);
   tempWindow.mainView.endProcess();
   
   var M = new MorphologicalTransformation;
   M.operator = MorphOp_Dilation;
   M.interlacingDistance = 1;
   M.lowThreshold = 0.5;
   M.highThreshold = 1.0;
   M.numberOfIterations = Math.max(1, Math.min(10, Math.floor(bufferPx / 2)));
   M.amount = 1.0;
   M.selectionPoint = 0.5;
   M.structureSize = 3;
   // Use default structure (circular)
   M.executeOn(tempWindow.mainView);
   
   // Get result back from window
   fgBuffered.assign(tempWindow.mainView.image);
   tempWindow.forceClose();
   
   // Create BG mask: inside border margin, outside FG buffer
   var bgMask = new Image(Math.floor(width), Math.floor(height), 1, 0, 32, 1);
   
   for (var y = 0; y < height; y++) {
      for (var x = 0; x < width; x++) {
         var insideBorder = (x >= borderMargin && x < width - borderMargin &&
                            y >= borderMargin && y < height - borderMargin);
         var outsideFG = (fgBuffered.sample(x, y, 0) < 0.5);
         
         bgMask.setSample((insideBorder && outsideFG) ? 1.0 : 0.0, x, y, 0);
      }
   }
   
   return bgMask;
}

/**
 * Select best BG tile: lowest sigma
 */
function selectBGTile(image, bgMask, tileSize) {
   var width = image.width;
   var height = image.height;
   
   var bestTile = null;
   var bestSigma = 1e9;
   
   for (var y = 0; y + tileSize <= height; y += tileSize) {
      for (var x = 0; x + tileSize <= width; x += tileSize) {
         // Check if tile is fully within BG mask
         var allBG = true;
         for (var ty = y; ty < y + tileSize && allBG; ty++) {
            for (var tx = x; tx < x + tileSize && allBG; tx++) {
               if (bgMask.sample(tx, ty, 0) < 0.5) {
                  allBG = false;
               }
            }
         }
         
         if (!allBG) continue;
         
         // Compute tile sigma
         var tilePixels = [];
         for (var ty = y; ty < y + tileSize; ty++) {
            for (var tx = x; tx < x + tileSize; tx++) {
               tilePixels.push(image.sample(tx, ty, 0));
            }
         }
         
         tilePixels.sort(function(a,b){return a-b;});
         var median = tilePixels[Math.floor(tilePixels.length / 2)];
         
         var deviations = [];
         for (var i = 0; i < tilePixels.length; i++) {
            deviations.push(Math.abs(tilePixels[i] - median));
         }
         deviations.sort(function(a,b){return a-b;});
         var mad = deviations[Math.floor(deviations.length / 2)];
         var sigma = 1.4826 * mad;
         
         if (sigma < bestSigma) {
            bestSigma = sigma;
            bestTile = { x: x, y: y, sigma: sigma };
         }
      }
   }
   
   return bestTile;
}

/**
 * Erode mask by erodePx pixels
 */
function erodeMask(mask, erodePx) {
   var eroded = new Image(Math.floor(mask.width), Math.floor(mask.height), 1, 0, 32, 1);
   eroded.assign(mask);
   
   // Create temporary window for morphological processing
   var tempWindow = new ImageWindow(Math.floor(mask.width), Math.floor(mask.height), 1, 32, true, false, "temp_morph_erosion");
   tempWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
   tempWindow.mainView.image.assign(eroded);
   tempWindow.mainView.endProcess();
   
   var M = new MorphologicalTransformation;
   M.operator = MorphOp_Erosion;
   M.interlacingDistance = 1;
   M.lowThreshold = 0.5;
   M.highThreshold = 1.0;
   M.numberOfIterations = Math.max(1, Math.min(10, Math.floor(erodePx / 2)));
   M.amount = 1.0;
   M.selectionPoint = 0.5;
   M.structureSize = 3;
   // Use default structure (circular)
   M.executeOn(tempWindow.mainView);
   
   // Get result back from window
   eroded.assign(tempWindow.mainView.image);
   tempWindow.forceClose();
   
   return eroded;
}

/**
 * Select best FG tile: highest median within eroded FG
 * Fallback: highest signal above background if no tiles in eroded FG
 */
function selectFGTile(image, fgInnerMask, fgFullMask, tileSize, bgMedian, bgTile, minSeparation) {
   var width = image.width;
   var height = image.height;
   
   var bestTile = null;
   var bestMedian = -1e9;
   
   // Helper to calculate distance between tile centers
   function tileDistance(x1, y1, x2, y2) {
      var cx1 = x1 + tileSize / 2;
      var cy1 = y1 + tileSize / 2;
      var cx2 = x2 + tileSize / 2;
      var cy2 = y2 + tileSize / 2;
      return Math.sqrt((cx2 - cx1) * (cx2 - cx1) + (cy2 - cy1) * (cy2 - cy1));
   }
   
   // Try eroded FG first
   for (var y = 0; y + tileSize <= height; y += tileSize) {
      for (var x = 0; x + tileSize <= width; x += tileSize) {
         // Skip if too close to BG tile
         if (bgTile && minSeparation && tileDistance(x, y, bgTile.x, bgTile.y) < minSeparation) {
            continue;
         }
         // Check if tile is fully within eroded FG
         var allFG = true;
         for (var ty = y; ty < y + tileSize && allFG; ty++) {
            for (var tx = x; tx < x + tileSize && allFG; tx++) {
               if (fgInnerMask.sample(tx, ty, 0) < 0.5) {
                  allFG = false;
               }
            }
         }
         
         if (!allFG) continue;
         
         // Compute tile median
         var tilePixels = [];
         for (var ty = y; ty < y + tileSize; ty++) {
            for (var tx = x; tx < x + tileSize; tx++) {
               tilePixels.push(image.sample(tx, ty, 0));
            }
         }
         
         tilePixels.sort(function(a,b){return a-b;});
         var median = tilePixels[Math.floor(tilePixels.length / 2)];
         
         if (median > bestMedian) {
            bestMedian = median;
            bestTile = { x: x, y: y, median: median };
         }
      }
   }
   
   // Fallback: tiles with >80% overlap with full FG
   if (!bestTile) {
      Console.writeln("  No tiles fully in eroded FG, trying fallback (>80% overlap)...");
      
      for (var y = 0; y + tileSize <= height; y += tileSize) {
         for (var x = 0; x + tileSize <= width; x += tileSize) {
            // Skip if too close to BG tile
            if (bgTile && minSeparation && tileDistance(x, y, bgTile.x, bgTile.y) < minSeparation) {
               continue;
            }
            
            // Count FG pixels in tile
            var fgCount = 0;
            var totalCount = tileSize * tileSize;
            
            for (var ty = y; ty < y + tileSize; ty++) {
               for (var tx = x; tx < x + tileSize; tx++) {
                  if (fgFullMask.sample(tx, ty, 0) > 0.5) {
                     fgCount++;
                  }
               }
            }
            
            if (fgCount < 0.8 * totalCount) continue;
            
            // Compute tile median
            var tilePixels = [];
            for (var ty = y; ty < y + tileSize; ty++) {
               for (var tx = x; tx < x + tileSize; tx++) {
                  tilePixels.push(image.sample(tx, ty, 0));
               }
            }
            
            tilePixels.sort(function(a,b){return a-b;});
            var median = tilePixels[Math.floor(tilePixels.length / 2)];
            
            var signal = median - bgMedian;
            
            if (signal > bestMedian - bgMedian) {
               bestMedian = median;
               bestTile = { x: x, y: y, median: median };
            }
         }
      }
   }
   
   return bestTile;
}

/**
 * Save debug overlay image showing FG mask outline, FG ROI, and BG ROI
 */
function saveDebugOverlay(image, fgMask, result, outputDir, filterName) {
   try {
      Console.writeln("Saving debug overlay...");
      
      // Create RGB visualization
      var debugImage = new Image(Math.floor(image.width), Math.floor(image.height), 3, 1, 32, 1);
      
      // Base: grayscale stretched image
      var stretched = new Image(Math.floor(image.width), Math.floor(image.height), 1, 0, 32, 1);
      stretched.assign(image);
      stretched.rescale();
      
      // Copy to all channels
      for (var c = 0; c < 3; c++) {
         for (var y = 0; y < image.height; y++) {
            for (var x = 0; x < image.width; x++) {
               debugImage.setSample(stretched.sample(x, y, 0), x, y, c);
            }
         }
      }
      
      // Overlay FG mask outline (green, 50% transparent)
      for (var y = 1; y < image.height - 1; y++) {
         for (var x = 1; x < image.width - 1; x++) {
            var isFG = fgMask.sample(x, y, 0) > 0.5;
            var isEdge = false;
            
            if (isFG) {
               // Check if any neighbor is not FG (edge detection)
               for (var dy = -1; dy <= 1 && !isEdge; dy++) {
                  for (var dx = -1; dx <= 1 && !isEdge; dx++) {
                     if (dx === 0 && dy === 0) continue;
                     if (fgMask.sample(x+dx, y+dy, 0) < 0.5) {
                        isEdge = true;
                     }
                  }
               }
            }
            
            if (isEdge) {
               // Green edge
               var base = debugImage.sample(x, y, 0);
               debugImage.setSample(base * 0.5, x, y, 0); // R
               debugImage.setSample(base * 0.5 + 0.5, x, y, 1); // G (bright)
               debugImage.setSample(base * 0.5, x, y, 2); // B
            }
         }
      }
      
      // Draw BG ROI rectangle (blue)
      drawRectangle(debugImage, result.bgRect, [0.0, 0.5, 1.0]); // Blue
      
      // Draw FG ROI rectangle (red)
      drawRectangle(debugImage, result.fgRect, [1.0, 0.2, 0.2]); // Red
      
      // Save to file in previews directory
      var debugDir = CONFIG.previewsDir + "/debug";
      if (!File.directoryExists(debugDir)) {
         File.createDirectory(debugDir);
      }
      
      var filterSuffix = filterName ? ("_" + filterName.replace(/[^a-zA-Z0-9]/g, "_")) : "";
      var debugPath = debugDir + "/ROI" + filterSuffix + "_reference.xisf";
      
      var window = new ImageWindow(Math.floor(image.width), Math.floor(image.height), 3, 32, true, true, "debug_roi");
      window.mainView.beginProcess(UndoFlag_NoSwapFile);
      window.mainView.image.assign(debugImage);
      window.mainView.endProcess();
      
      if (window.saveAs(debugPath, false, false, false, false)) {
         Console.writeln("Debug overlay saved: " + debugPath);
      }
      
      window.forceClose();
      
   } catch (error) {
      Console.warningln("Failed to save debug overlay: " + error.message);
   }
}

/**
 * Draw rectangle outline on RGB image
 */
function drawRectangle(image, rect, color) {
   var thickness = 2;
   
   // Top and bottom edges
   for (var x = rect.x0; x < rect.x1; x++) {
      for (var t = 0; t < thickness; t++) {
         if (rect.y0 + t < image.height) {
            for (var c = 0; c < 3; c++) {
               image.setSample(color[c], x, rect.y0 + t, c);
            }
         }
         if (rect.y1 - 1 - t >= 0) {
            for (var c = 0; c < 3; c++) {
               image.setSample(color[c], x, rect.y1 - 1 - t, c);
            }
         }
      }
   }
   
   // Left and right edges
   for (var y = rect.y0; y < rect.y1; y++) {
      for (var t = 0; t < thickness; t++) {
         if (rect.x0 + t < image.width) {
            for (var c = 0; c < 3; c++) {
               image.setSample(color[c], rect.x0 + t, y, c);
            }
         }
         if (rect.x1 - 1 - t >= 0) {
            for (var c = 0; c < 3; c++) {
               image.setSample(color[c], rect.x1 - 1 - t, y, c);
            }
         }
      }
   }
}
