/*
 * SNRAnalysis-snr.js
 * ROI-based SNR measurement
 */

/**
 * Read existing BG/FG previews without prompting
 * Used by auto ROI mode after previews are created
 * 
 * @param {string} refImageId - Reference master image ID
 * @returns {Object} Object with bg and fg rectangle objects, or null if not found
 */
function readExistingROIs(refImageId) {
   var window = ImageWindow.windowById(refImageId);
   if (!window || window.isNull) {
      return null;
   }
   
   var bgPreview = null;
   var fgPreview = null;
   
   for (var i = 0; i < window.previews.length; i++) {
      var preview = window.previews[i];
      if (preview.id.toUpperCase() === "BG") {
         bgPreview = preview;
      } else if (preview.id.toUpperCase() === "FG") {
         fgPreview = preview;
      }
   }
   
   if (bgPreview && fgPreview) {
      var bgRect = window.previewRect(bgPreview);
      var fgRect = window.previewRect(fgPreview);
      
      return {
         bg: {
            x0: bgRect.x0,
            y0: bgRect.y0,
            x1: bgRect.x1,
            y1: bgRect.y1
         },
         fg: {
            x0: fgRect.x0,
            y0: fgRect.y0,
            x1: fgRect.x1,
            y1: fgRect.y1
         }
      };
   }
   
   return null;
}

/**
 * Prompt user to define BG and FG ROI previews
 * 
 * @param {string} refImageId - Reference master image ID
 * @param {boolean} autoModeFailed - Optional flag indicating auto ROI detection failed
 * @returns {Object} Object with bg and fg rectangle objects, or null if cancelled
 */
function promptForROIs(refImageId, autoModeFailed, filterName) {
   var window = ImageWindow.windowById(refImageId);
   if (!window || window.isNull) {
      throw new Error("Reference image window not found");
   }
   
   // Bring window to front
   window.bringToFront();
   window.zoomToFit();
   
   // Check if previews already exist
   var bgPreview = null;
   var fgPreview = null;
   
   for (var i = 0; i < window.previews.length; i++) {
      var preview = window.previews[i];
      if (preview.id.toUpperCase() === "BG") {
         bgPreview = preview;
      } else if (preview.id.toUpperCase() === "FG") {
         fgPreview = preview;
      }
   }
   
   // If both exist, just confirm
   if (bgPreview && fgPreview) {
      // Get bounds from preview window
      var bgRect = window.previewRect(bgPreview);
      var fgRect = window.previewRect(fgPreview);
      
      var filterLabel = filterName ? (" (" + filterName + ")") : "";
      var confirmMsg = new MessageBox(
         "Found existing ROI previews" + filterLabel + ":\n\n" +
         "   BG: " + formatRect({x0: bgRect.x0, y0: bgRect.y0, 
                                 x1: bgRect.x1, y1: bgRect.y1}) + "\n" +
         "   FG: " + formatRect({x0: fgRect.x0, y0: fgRect.y0, 
                                 x1: fgRect.x1, y1: fgRect.y1}) + "\n\n" +
         "Use these previews for analysis?",
         "Confirm ROI Previews" + filterLabel,
         StdIcon_Question,
         StdButton_Yes,
         StdButton_No
      );
      
      if (confirmMsg.execute() === StdButton_Yes) {
         return {
            bg: {
               x0: bgRect.x0,
               y0: bgRect.y0,
               x1: bgRect.x1,
               y1: bgRect.y1
            },
            fg: {
               x0: fgRect.x0,
               y0: fgRect.y0,
               x1: fgRect.x1,
               y1: fgRect.y1
            }
         };
      }
      // If No, fall through to create new ones
   }
   
   // Previews don't exist or user wants to recreate - show instructions
   var msgText = "";
   
   if (autoModeFailed) {
      msgText = "Auto ROI Detection Failed\n\n" +
                "Unable to automatically detect suitable foreground regions.\n" +
                "The image may have very low contrast or insufficient signal.\n\n" +
                "Please manually create TWO previews on the reference master:\n\n";
   } else {
      msgText = "Please create TWO previews on the reference master image:\n\n";
   }
   
   msgText += "1. Name: 'BG' - Background region (dark sky area)\n" +
              "2. Name: 'FG' - Foreground region (faint signal area)\n\n" +
              "To create a preview:\n" +
              "   • Draw a rectangular selection on the image\n" +
              "   • Press Ctrl+N (or Preview → New Preview)\n" +
              "   • Enter 'BG' or 'FG' as the preview name\n" +
              "   • Repeat for the second preview\n\n" +
              "The reference master window will remain open.\n" +
              "After creating both previews, run this script again.\n\n" +
              "Click OK to exit and create previews, or Cancel to abort.";
   
   var msg = new MessageBox(
      msgText,
      "Create ROI Previews",
      StdIcon_Information,
      StdButton_Ok,
      StdButton_Cancel
   );
   
   if (msg.execute() !== StdButton_Ok) {
      throw new Error("Analysis cancelled - ROI previews not created.");
   }
   
   // Exit gracefully - user needs to create previews and rerun
   throw new Error("Please create 'BG' and 'FG' previews on the reference master, then run the script again.");
}

/**
 * Compute reference background level from an image
 * Used as the normalization target for signal scale locking
 * 
 * @param {string} imageId - Image window ID
 * @param {Object} bgRect - Background rectangle
 * @returns {number} Background median value (robust estimator)
 */
function computeBgRef(imageId, bgRect) {
   var window = ImageWindow.windowById(imageId);
   if (!window || window.isNull) {
      Console.warningln("computeBgRef: Image window not found: " + imageId);
      return null;
   }
   
   var image = window.mainView.image;
   var bgStats = measureROI(image, bgRect);
   
   Console.writeln("Reference background computed: BG_ref = " + bgStats.median.toFixed(8));
   return bgStats.median;
}

/**
 * Scale an image for measurement to match reference background
 * This locks the signal scale across integration depths
 * 
 * @param {ImageWindow} window - Image window to scale
 * @param {number} bgRef - Reference background level (median)
 * @param {Object} bgRect - Background rectangle
 * @returns {Object} Object with scaledWindow, scaleFactor, and bgMeasured
 */
function scaleForMeasurement(window, bgRef, bgRect) {
   if (!window || window.isNull) {
      Console.warningln("scaleForMeasurement: Invalid window");
      return null;
   }
   
   if (!bgRef || bgRef <= 0) {
      Console.warningln("scaleForMeasurement: Invalid BG_ref (" + bgRef + "), skipping normalization");
      return null;
   }
   
   // Measure current background
   var image = window.mainView.image;
   var bgStats = measureROI(image, bgRect);
   var bgMeasured = bgStats.median;
   
   if (!bgMeasured || bgMeasured <= 0) {
      Console.warningln("scaleForMeasurement: Invalid BG measurement (" + bgMeasured + "), skipping normalization");
      return null;
   }
   
   // Compute scale factor
   var scaleFactor = bgRef / bgMeasured;
   
   // Safety clamp to avoid pathological cases
   var originalScale = scaleFactor;
   scaleFactor = Math.max(0.25, Math.min(4.0, scaleFactor));
   
   if (scaleFactor !== originalScale) {
      Console.warningln("Scale factor clamped: " + originalScale.toFixed(4) + " → " + scaleFactor.toFixed(4));
   }
   
   // Create scaled copy for measurement (do not modify original)
   var scaledWindow = new ImageWindow(
      image.width,
      image.height,
      image.numberOfChannels,
      image.bitsPerSample,
      image.isReal,
      image.isColor,
      window.mainView.id + "_scaled_temp"
   );
   
   scaledWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
   scaledWindow.mainView.image.assign(image);
   
   // Apply multiplicative scaling to all channels
   scaledWindow.mainView.image.apply(scaleFactor);
   
   scaledWindow.mainView.endProcess();
   
   // Don't show the temp window
   scaledWindow.hide();
   
   return {
      scaledWindow: scaledWindow,
      scaleFactor: scaleFactor,
      bgMeasured: bgMeasured
   };
}

/**
 * Measure SNR using background and foreground ROIs
 * 
 * @param {string} imageId - Image window ID
 * @param {Object} bgRect - Background rectangle
 * @param {Object} fgRect - Foreground rectangle
 * @param {number} bgRef - Optional reference background for normalization (if lockSignalScale enabled)
 * @returns {Object} SNR metrics with validation fields
 */
function measureSNR(imageId, bgRect, fgRect, bgRef) {
   var window = ImageWindow.windowById(imageId);
   if (!window || window.isNull) {
      throw new Error("Image window not found: " + imageId);
   }
   
   var imageToMeasure = window.mainView.image;
   var scaledWindow = null;
   var scaleFactor = 1.0;
   var bgMedianRaw = null;
   var bgMedianScaled = null;
   
   // PART A & B: Validation and scaling implementation
   if (bgRef && bgRef > 0) {
      // Measure raw background BEFORE scaling
      var bgStatsRaw = measureROI(imageToMeasure, bgRect);
      bgMedianRaw = bgStatsRaw.median;
      
      if (bgMedianRaw && bgMedianRaw > 0) {
         // Compute scale factor
         scaleFactor = bgRef / bgMedianRaw;
         
         // Safety clamp to avoid pathological cases (0.25x to 4x range)
         var originalScale = scaleFactor;
         scaleFactor = Math.max(0.25, Math.min(4.0, scaleFactor));
         
         if (Math.abs(scaleFactor - originalScale) > 0.001) {
            Console.warningln("[LockScale][WARN] Scale factor clamped: " + 
                            originalScale.toFixed(4) + " → " + scaleFactor.toFixed(4));
         }
         
         // Create scaled copy for measurement
         scaledWindow = new ImageWindow(
            imageToMeasure.width,
            imageToMeasure.height,
            imageToMeasure.numberOfChannels,
            imageToMeasure.bitsPerSample,
            imageToMeasure.isReal,
            imageToMeasure.isColor,
            window.mainView.id + "_scaled_meas"
         );
         
         scaledWindow.mainView.beginProcess(UndoFlag_NoSwapFile);
         scaledWindow.mainView.image.assign(imageToMeasure);
         scaledWindow.mainView.endProcess();
         scaledWindow.hide();
         
         // Use PixelMath to multiply all pixels by scaleFactor
         var P = new PixelMath;
         P.expression = format("%.16f * $T", scaleFactor);
         P.expression1 = "";
         P.expression2 = "";
         P.expression3 = "";
         P.useSingleExpression = true;
         P.symbols = "";
         P.clearImageCacheAndExit = false;
         P.cacheGeneratedImages = false;
         P.generateOutput = true;
         P.singleThreaded = false;
         P.optimization = true;
         P.use64BitWorkingImage = false;
         P.rescale = false;
         P.rescaleLower = 0;
         P.rescaleUpper = 1;
         P.truncate = true;
         P.truncateLower = 0;
         P.truncateUpper = 1;
         P.createNewImage = false;
         P.showNewImage = false;
         P.newImageId = "";
         P.newImageWidth = 0;
         P.newImageHeight = 0;
         P.newImageAlpha = false;
         P.newImageColorSpace = PixelMath.prototype.SameAsTarget;
         P.newImageSampleFormat = PixelMath.prototype.SameAsTarget;
         
         P.executeOn(scaledWindow.mainView);
         
         // Use scaled image for ALL measurements
         imageToMeasure = scaledWindow.mainView.image;
         
         // Measure background on scaled image (for validation)
         var bgStatsScaled = measureROI(imageToMeasure, bgRect);
         bgMedianScaled = bgStatsScaled.median;
         
         // VALIDATION: Check if scaling worked
         var driftPct = ((bgMedianScaled - bgRef) / bgRef) * 100.0;
         
         Console.writeln("[LockScale] bgRef=" + bgRef.toFixed(8) + 
                        " bgRaw=" + bgMedianRaw.toFixed(8) + 
                        " scale=" + scaleFactor.toFixed(6) + 
                        " bgScaled=" + bgMedianScaled.toFixed(8) + 
                        " driftPct=" + driftPct.toFixed(3) + "%");
         
         if (Math.abs(driftPct) > 1.0) {
            Console.warningln("[LockScale][WARN] bgScaled differs from bgRef by " + 
                            driftPct.toFixed(2) + "% - verify ROI consistency");
         }
      } else {
         Console.warningln("[LockScale][WARN] Invalid bgMedianRaw (" + bgMedianRaw + 
                          "), disabling scaling for this depth");
         bgRef = null;  // Disable scaling for this measurement
      }
   }
   
   // Extract ROI statistics from the (potentially scaled) image
   var bgStats = measureROI(imageToMeasure, bgRect);
   var fgStats = measureROI(imageToMeasure, fgRect);
   
   // Measure global image noise (independent of ROI selection)
   var globalNoise = measureGlobalNoise(imageToMeasure, 0.01);  // 1% sampling
   
   // Clean up scaled window if created
   if (scaledWindow) {
      scaledWindow.forceClose();
   }
   
   // Compute SNR = (signal - background) / noise using background noise
   // var snr = (fgStats.median - bgStats.median) / fgStats.sigma;
   var signal = fgStats.median - bgStats.median;
   var snrBG = signal / bgStats.sigmaMAD;
   var snrFG = signal / fgStats.sigmaMAD;
   var snr = snrBG; 
   
   return {
      bgMean: bgStats.mean,
      bgMedian: bgStats.median,
      bgSigma: bgStats.sigma,
      bgSigmaMAD: bgStats.sigmaMAD,
      fgMean: fgStats.mean,
      
      // Global noise metrics
      globalMedian: globalNoise.median,
      globalNoise: globalNoise.sigmaMAD,
      globalNoiseSampleCount: globalNoise.sampleCount,
      fgMedian: fgStats.median,
      fgSigma: fgStats.sigma,
      fgSigmaMAD: fgStats.sigmaMAD,

      signal: signal,
      snrBG: snrBG,
      snrFG: snrFG,
      snr: snr,
      // Validation fields (Part A)
      scaleFactor: scaleFactor,
      bgMedianRaw: bgMedianRaw,
      bgMedianScaled: bgMedianScaled
   };
}

/**
 * Measure global image noise using robust MAD estimator
 * Samples the entire image to get overall noise characteristics
 * 
 * @param {Image} image - The image to measure
 * @param {number} sampleFraction - Fraction of pixels to sample (0.01 = 1%)
 * @returns {Object} Global noise statistics
 */
function measureGlobalNoise(image, sampleFraction) {
   sampleFraction = sampleFraction || 0.01;  // Default to 1% sampling for speed
   
   var w = image.width;
   var h = image.height;
   var totalPixels = w * h;
   var sampleCount = Math.floor(totalPixels * sampleFraction);
   sampleCount = Math.max(10000, Math.min(sampleCount, 100000));  // Clamp between 10k-100k samples
   
   var samples = [];
   var step = Math.floor(totalPixels / sampleCount);
   
   // Collect evenly-spaced samples across the image
   for (var i = 0; i < totalPixels; i += step) {
      var x = i % w;
      var y = Math.floor(i / w);
      if (y < h) {
         samples.push(image.sample(x, y));
      }
   }
   
   if (samples.length < 10) {
      return { median: 0, sigmaMAD: 0, sampleCount: 0 };
   }
   
   // Compute median
   samples.sort(function(a, b) { return a - b; });
   var mid = Math.floor(samples.length / 2);
   var median = (samples.length % 2 !== 0) ? 
                samples[mid] : 
                0.5 * (samples[mid - 1] + samples[mid]);
   
   // Compute absolute deviations
   var deviations = new Array(samples.length);
   for (var i = 0; i < samples.length; i++) {
      deviations[i] = Math.abs(samples[i] - median);
   }
   
   deviations.sort(function(a, b) { return a - b; });
   var mad = (deviations.length % 2 !== 0) ?
             deviations[mid] :
             0.5 * (deviations[mid - 1] + deviations[mid]);
   
   // Convert MAD to sigma estimate
   var sigmaMAD = 1.4826 * mad;
   
   return {
      median: median,
      sigmaMAD: sigmaMAD,
      sampleCount: samples.length
   };
}

/**
 * Measure robust sigma using MAD estimator
 */
function robustSigmaMAD(image) {
  var samples = [];
  var w = image.width;
  var h = image.height;

  // Collect samples (single channel assumed – OK for mono)
  for (var y = 0; y < h; y++) {
    for (var x = 0; x < w; x++) {
      samples.push(image.sample(x, y));
    }
  }

  if (samples.length < 10)
    return 0;

  // Median
  samples.sort(function(a, b) { return a - b; });
  var mid = Math.floor(samples.length / 2);
  var median = (samples.length % 2 !== 0)
    ? samples[mid]
    : 0.5 * (samples[mid - 1] + samples[mid]);

  // Absolute deviations
  var deviations = new Array(samples.length);
  for (var i = 0; i < samples.length; i++) {
    deviations[i] = Math.abs(samples[i] - median);
  }

  deviations.sort(function(a, b) { return a - b; });
  var mad = (deviations.length % 2 !== 0)
    ? deviations[mid]
    : 0.5 * (deviations[mid - 1] + deviations[mid]);

  // Convert MAD → sigma
  return 1.4826 * mad;
}


/**
 * Measure statistics for a rectangular ROI
 */
function measureROI(image, rect) {
   // Create a temporary image with the ROI
   var roiImage = new Image(
      Math.floor(rect.x1 - rect.x0),
      Math.floor(rect.y1 - rect.y0),
      image.numberOfChannels,
      image.colorSpace,
      image.bitsPerSample,
      image.sampleType
   );
   
   // Copy ROI
   roiImage.assign(image, new Rect(rect.x0, rect.y0, rect.x1, rect.y1));
   
   // Measure statistics
   var mean = roiImage.mean();
   var median = roiImage.median();
   var sigma = roiImage.stdDev();
   var sigmaMAD = robustSigmaMAD(roiImage);
   
   return {
      mean: mean,
      median: median,
      sigma: sigma, 
      sigmaMAD: sigmaMAD
   };
}
