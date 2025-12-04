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
function promptForROIs(refImageId, autoModeFailed) {
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
      
      var confirmMsg = new MessageBox(
         "Found existing ROI previews:\n\n" +
         "   BG: " + formatRect({x0: bgRect.x0, y0: bgRect.y0, 
                                 x1: bgRect.x1, y1: bgRect.y1}) + "\n" +
         "   FG: " + formatRect({x0: fgRect.x0, y0: fgRect.y0, 
                                 x1: fgRect.x1, y1: fgRect.y1}) + "\n\n" +
         "Use these previews for analysis?",
         "Confirm ROI Previews",
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
 * Measure SNR using background and foreground ROIs
 * 
 * @param {string} imageId - Image window ID
 * @param {Object} bgRect - Background rectangle
 * @param {Object} fgRect - Foreground rectangle
 * @returns {Object} SNR metrics
 */
function measureSNR(imageId, bgRect, fgRect) {
   var window = ImageWindow.windowById(imageId);
   if (!window || window.isNull) {
      throw new Error("Image window not found: " + imageId);
   }
   
   var image = window.mainView.image;
   
   // Extract ROI statistics
   var bgStats = measureROI(image, bgRect);
   var fgStats = measureROI(image, fgRect);
   
   // Compute SNR = (signal - background) / noise
   // signal = fgMedian, background = bgMedian, noise = fgSigma
   var snr = (fgStats.median - bgStats.median) / fgStats.sigma;
   
   return {
      bgMedian: bgStats.median,
      bgSigma: bgStats.sigma,
      fgMedian: fgStats.median,
      fgSigma: fgStats.sigma,
      snr: snr
   };
}

/**
 * Measure statistics for a rectangular ROI
 */
function measureROI(image, rect) {
   // Create a temporary image with the ROI
   var roiImage = new Image(
      rect.x1 - rect.x0,
      rect.y1 - rect.y0,
      image.numberOfChannels,
      image.colorSpace,
      image.bitsPerSample,
      image.sampleType
   );
   
   // Copy ROI
   roiImage.assign(image, new Rect(rect.x0, rect.y0, rect.x1, rect.y1));
   
   // Measure statistics
   var median = roiImage.median();
   var sigma = roiImage.stdDev();
   
   return {
      median: median,
      sigma: sigma
   };
}
