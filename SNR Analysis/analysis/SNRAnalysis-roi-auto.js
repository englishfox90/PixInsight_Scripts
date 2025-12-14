/*
 * SNRAnalysis-roi-auto.js
 * Automatic ROI detection for background and faint signal regions
 */

#include <pjsr/ImageOp.jsh>

/**
 * Attempt to auto-detect BG and FG rectangles on the given view.
 * 
 * Algorithm:
 * 1. Tile the image into non-overlapping regions
 * 2. Measure median, sigma, and max for each tile
 * 3. Estimate global background from low percentile of tile medians
 * 4. Select BG tile: closest to background estimate, low noise, no bright stars
 * 5. Select FG tile: faint signal above background, avoid bright cores
 * 
 * @param {View} view - The view of the full-depth integrated master
 * @param {number} tileSize - Size of tiles (e.g. 64 or 96)
 * @returns {Object|null} either { bgRect: {x0,y0,x1,y1}, fgRect: {x0,y0,x1,y1} } or null if failed
 */
function detectAutoRois(view, tileSize) {
   if (!view || view.isNull) {
      console.warningln("Auto ROI: Invalid view provided");
      return null;
   }
   
   tileSize = tileSize || 96;
   
   console.writeln("");
   console.writeln("=== AUTO ROI DETECTION ===");
   console.writeln("Tile size: " + tileSize + " pixels");
   
   var image = view.image;
   var width = image.width;
   var height = image.height;
   
   if (width < tileSize * 3 || height < tileSize * 3) {
      console.warningln("Auto ROI: Image too small for tile size " + tileSize);
      return null;
   }
   
   // Step 1: Tile the image and collect statistics
   console.writeln("Analyzing tiles...");
   var tiles = [];
   var tileCount = 0;
   
   for (var y = 0; y + tileSize <= height; y += tileSize) {
      for (var x = 0; x + tileSize <= width; x += tileSize) {
         var rect = new Rect(x, y, x + tileSize, y + tileSize);
         
         // Extract tile statistics
         var stats = measureTileStats(image, rect);
         
         tiles.push({
            rect: { x0: x, y0: y, x1: x + tileSize, y1: y + tileSize },
            median: stats.median,
            sigma: stats.sigma,
            max: stats.max,
            x: x,
            y: y
         });
         
         tileCount++;
      }
   }
   
   console.writeln("Analyzed " + tileCount + " tiles");
   
   if (tiles.length < 10) {
      console.warningln("Auto ROI: Too few tiles (" + tiles.length + ") - need at least 10");
      return null;
   }
   
   // Step 2: Estimate global background
   var medians = [];
   var sigmas = [];
   
   for (var i = 0; i < tiles.length; i++) {
      medians.push(tiles[i].median);
      sigmas.push(tiles[i].sigma);
   }
   
   // Sort for percentile calculations
   medians.sort(function(a, b) { return a - b; });
   sigmas.sort(function(a, b) { return a - b; });
   
   // Background estimate: 25th percentile of medians
   var bgMedianEstimate = medians[Math.floor(medians.length * 0.25)];
   
   // Typical noise: median of sigmas
   var bgSigmaEstimate = sigmas[Math.floor(sigmas.length * 0.5)];
   
   console.writeln("Background median estimate: " + bgMedianEstimate.toFixed(6));
   console.writeln("Background sigma estimate: " + bgSigmaEstimate.toFixed(6));
   
   // Step 3: Select BG tile
   console.writeln("Selecting background tile...");
   
   var bgCandidates = [];
   
   for (var i = 0; i < tiles.length; i++) {
      var tile = tiles[i];
      
      // Filter criteria for BG:
      // - Sigma not too high (reject structured/noisy regions)
      // - Max not too bright (no bright stars)
      // - Median close to background estimate
      
      if (tile.sigma > bgSigmaEstimate * 2.5) continue;  // Too noisy
      if (tile.max > 0.5) continue;  // Too bright (assuming normalized data)
      
      var medianDiff = Math.abs(tile.median - bgMedianEstimate);
      
      bgCandidates.push({
         tile: tile,
         score: -medianDiff  // Higher score = closer to background
      });
   }
   
   if (bgCandidates.length === 0) {
      console.warningln("Auto ROI: No suitable background tiles found");
      return null;
   }
   
   // Sort by score (best first)
   bgCandidates.sort(function(a, b) { return b.score - a.score; });
   
   var bgTile = bgCandidates[0].tile;
   console.writeln("Selected BG tile at (" + bgTile.x + ", " + bgTile.y + ")");
   console.writeln("  Median: " + bgTile.median.toFixed(6) + 
                   ", Sigma: " + bgTile.sigma.toFixed(6) + 
                   ", Max: " + bgTile.max.toFixed(6));
   
   // Step 4: Select FG tile
   console.writeln("Selecting foreground tile...");
   
   var fgCandidates = [];
   
   // Calculate initial threshold for "signal above background"
   // Start conservative, we'll relax if needed
   var signalThreshold = bgMedianEstimate + 2.5 * bgSigmaEstimate;
   
   // Find top median to avoid super-bright cores
   var topMedian = medians[medians.length - 1];
   var excludeAbove = medians[Math.floor(medians.length * 0.98)];  // Exclude top 2%
   
   // Try multiple passes with progressively relaxed criteria
   var attempts = [
      { minSigma: 2.5, maxSigma: 4.0, name: "conservative" },
      { minSigma: 2.0, maxSigma: 5.0, name: "moderate" },
      { minSigma: 1.5, maxSigma: 6.0, name: "relaxed" },
      { minSigma: 1.0, maxSigma: 8.0, name: "aggressive" }
   ];
   
   var selectedAttempt = null;
   
   for (var attemptIdx = 0; attemptIdx < attempts.length; attemptIdx++) {
      var attempt = attempts[attemptIdx];
      fgCandidates = [];
      signalThreshold = bgMedianEstimate + attempt.minSigma * bgSigmaEstimate;
      
      for (var i = 0; i < tiles.length; i++) {
         var tile = tiles[i];
         
         // Filter criteria for FG:
         // - Median above signal threshold (has faint signal)
         // - Not in the very brightest regions (avoid cores)
         // - Max not saturated
         // - Not too noisy (stable measurement)
         
         if (tile.median < signalThreshold) continue;  // Too dim
         if (tile.median > excludeAbove) continue;  // Too bright (likely core)
         if (tile.max > 0.98) continue;  // Near saturation
         if (tile.sigma > bgSigmaEstimate * attempt.maxSigma) continue;  // Too noisy
         
         // Score based on signal strength above background
         var signal = (tile.median - bgMedianEstimate) / (bgSigmaEstimate || 1e-6);
         
         // Prefer moderate signal (not too faint, not too bright)
         var score = signal;
         
         // Slight penalty for very high max values (avoid star cores)
         if (tile.max > 0.7) {
            score *= 0.8;
         }
         
         fgCandidates.push({
            tile: tile,
            score: score,
            signal: signal
         });
      }
      
      if (fgCandidates.length > 0) {
         selectedAttempt = attempt.name;
         console.writeln("Found " + fgCandidates.length + " FG candidates using " + attempt.name + " criteria");
         break;
      }
   }
   
   if (fgCandidates.length === 0) {
      console.warningln("Auto ROI: No suitable foreground tiles found even with relaxed criteria");
      console.warningln("  Background median: " + bgMedianEstimate.toFixed(6));
      console.warningln("  Background sigma: " + bgSigmaEstimate.toFixed(6));
      console.warningln("  Image may have very low contrast or be mostly background");
      console.warningln("  Consider using manual mode for this target");
      return null;
   }
   
   // Sort by score (best first)
   fgCandidates.sort(function(a, b) { return b.score - a.score; });
   
   var fgTile = fgCandidates[0].tile;
   console.writeln("Selected FG tile at (" + fgTile.x + ", " + fgTile.y + ")");
   console.writeln("  Median: " + fgTile.median.toFixed(6) + 
                   ", Sigma: " + fgTile.sigma.toFixed(6) + 
                   ", Max: " + fgTile.max.toFixed(6));
   console.writeln("  Signal: " + fgCandidates[0].signal.toFixed(2) + " sigma above background");
   
   // Ensure BG and FG are not the same tile
   if (bgTile.x === fgTile.x && bgTile.y === fgTile.y) {
      console.warningln("Auto ROI: BG and FG selected the same tile - trying next best FG");
      if (fgCandidates.length > 1) {
         fgTile = fgCandidates[1].tile;
         console.writeln("Selected alternate FG tile at (" + fgTile.x + ", " + fgTile.y + ")");
      } else {
         console.warningln("Auto ROI: No alternate FG tile available");
         return null;
      }
   }
   
   console.writeln("Auto ROI detection successful");
   console.writeln("");
   
   return {
      bgRect: bgTile.rect,
      fgRect: fgTile.rect
   };
}

/**
 * Measure statistics for a single tile
 * 
 * @param {Image} image - Source image
 * @param {Rect} rect - Rectangle defining the tile
 * @returns {Object} Statistics: { median, sigma, max }
 */
function measureTileStats(image, rect) {
   // Create temporary image for the tile
   var tileImage = new Image(
      Math.floor(rect.width),
      Math.floor(rect.height),
      image.numberOfChannels,
      image.colorSpace,
      image.bitsPerSample,
      image.sampleType
   );
   
   // Copy the tile region
   tileImage.assign(image, rect);
   
   // Measure statistics
   var median = tileImage.median();
   var sigma = tileImage.stdDev();
   
   // Find maximum value
   var max = 0.0;
   for (var c = 0; c < tileImage.numberOfChannels; c++) {
      for (var y = 0; y < tileImage.height; y++) {
         for (var x = 0; x < tileImage.width; x++) {
            var val = tileImage.sample(x, y, c);
            if (val > max) max = val;
         }
      }
   }
   
   return {
      median: median,
      sigma: sigma,
      max: max
   };
}

/**
 * Create previews on the given window from auto-detected rectangles
 * 
 * @param {ImageWindow} window - Window to create previews on
 * @param {Object} rects - Object with bgRect and fgRect properties
 * @returns {boolean} True if previews created successfully
 */
function createAutoRoiPreviews(window, rects) {
   if (!window || window.isNull) {
      console.warningln("Auto ROI: Invalid window for preview creation");
      return false;
   }
   
   if (!rects || !rects.bgRect || !rects.fgRect) {
      console.warningln("Auto ROI: Invalid rectangles provided");
      return false;
   }
   
   try {
      console.writeln("Creating auto-detected ROI previews...");
      
      // Remove existing BG/FG previews if they exist
      for (var i = window.previews.length - 1; i >= 0; i--) {
         var preview = window.previews[i];
         if (preview.id.toUpperCase() === "BG" || preview.id.toUpperCase() === "FG") {
            console.writeln("Removing existing preview: " + preview.id);
            window.deletePreview(preview);
         }
      }
      
      // Create BG preview
      var bgRect = rects.bgRect;
      var bgPreview = window.createPreview(bgRect.x0, bgRect.y0, bgRect.x1, bgRect.y1);
      bgPreview.id = "BG";
      console.writeln("Created BG preview: " + formatRect(bgRect));
      
      // Create FG preview
      var fgRect = rects.fgRect;
      var fgPreview = window.createPreview(fgRect.x0, fgRect.y0, fgRect.x1, fgRect.y1);
      fgPreview.id = "FG";
      console.writeln("Created FG preview: " + formatRect(fgRect));
      
      return true;
      
   } catch (error) {
      console.warningln("Auto ROI: Failed to create previews: " + error.message);
      return false;
   }
}
