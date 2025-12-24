/*
 * SNRAnalysis-stretch.js
 * STF-based histogram transformation for consistent stretching
 */

/**
 * Apply STF-based stretch to an image
 * 
 * @param {string} imageId - Image window ID
 */
function applySTFStretch(imageId) {
   Console.writeln("Applying STF-based stretch...");
   
   var window = ImageWindow.windowById(imageId);
   if (!window || window.isNull) {
      Console.warningln("Image window not found: " + imageId);
      return;
   }
   
   try {
      // Compute Auto STF
      var stf = computeAutoSTF(window.mainView);
      
      if (!stf) {
         Console.warningln("Failed to compute STF");
         return;
      }
      
      // Convert STF to HistogramTransformation
      var HT = new HistogramTransformation();
      
      // Apply STF parameters to HT
      for (var c = 0; c < stf.length; c++) {
         HT.H[c] = [
            [stf[c].m, stf[c].c0, stf[c].c1, 0, 1],  // Shadows, midtones, highlights
            [0, 0.5, 1, 0, 1]                          // Shadows, midtones, highlights (output)
         ];
      }
      
      // Execute transformation
      HT.executeOn(window.mainView, false);
      
      Console.writeln("Stretch applied successfully");
      
   } catch (error) {
      Console.warningln("Stretch failed: " + error.message);
   }
}

/**
 * Compute Auto STF for a view
 * Returns array of STF parameters per channel
 */
function computeAutoSTF(view) {
   var image = view.image;
   var numberOfChannels = image.isColor ? 3 : 1;
   
   var stf = [];
   
   for (var c = 0; c < numberOfChannels; c++) {
      image.selectedChannel = c;
      
      var median = image.median();
      var mad = image.MAD();
      
      // Compute shadow and highlight clipping points
      var c0 = Math.range(median - 2.8 * mad, 0.0, 1.0);
      var m = Math.mtf(0.25, median - c0);  // Target median at 0.25
      
      stf.push({
         c0: c0,      // Shadow clipping point
         m: m,        // Midtones balance
         c1: 1.0,     // Highlight clipping point
         r0: 0.0,     // Output shadow
         r1: 1.0      // Output highlight
      });
   }
   
   // Reset channel selection
   image.resetSelections();
   
   return stf;
}
