/*
 * PixInsight PJSR: AstroBin Acquisitions CSV Builder v3
 * Enhanced version with dynamic filter CSV loading
 *
 * This version loads filter mappings from the astrobin_filters.csv file
 * and provides a comprehensive GUI for data review and export.
 *
 * Modular structure for easier maintenance and debugging.
 */

#feature-id    AstroBinExport : PFRAstro > AstroBin Export

#feature-info   Scans a folder of image files, extracts metadata, and generates an export file \
                formatted for AstroBin's acquisition import. This automates and accelerates \
                the process of creating image entries on AstroBin.

#feature-icon  @script_icons_dir/AstroBin.svg

// === SCRIPT ISOLATION WRAPPER ===
// Wraps entire script in IIFE (Immediately Invoked Function Expression) to prevent global scope pollution
(function() {
"use strict";  // Enables strict mode to catch accidental global variable assignments

// Include necessary PJSR libraries for UI functionality
#include <pjsr/Sizer.jsh>
#include <pjsr/FrameStyle.jsh>
#include <pjsr/TextAlign.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/Color.jsh>
#include <pjsr/FontFamily.jsh>
// Needed for DataType_* constants used by Settings.read/write
#include <pjsr/DataType.jsh>

// Include our modular components
#include "AstroBin-core.js"
#include "AstroBin-filter-database.js"
#include "AstroBin-analysis.js"
#include "AstroBin-gui.js"
#include "AstroBin-gui-methods.js"


// Main script entry point
function main(){
   try {
      // Script should not run in global mode for safety
      if (Parameters.isGlobalTarget) {
         Console.criticalln("AstroBin Export should not run in global context.");
         return;
      }

      Console.show();
      Console.writeln("AstroBin Acquisitions CSV Builder v3");
      Console.writeln("=======================================");
      Console.writeln("Script starting at: " + new Date().toISOString());

      Console.writeln("Using JavaScript filter database...");
      Console.writeln("Filter database loaded: " + ASTROBIN_FILTERS.length + " filters available");

      // Initialize dialog without CSV dependency

      // Show the dialog
      Console.writeln("Creating dialog...");
      var dialog = new AstroBinDialog();
      Console.writeln("Executing dialog...");
      dialog.execute();
      Console.writeln("Script completed successfully.");

   } catch (e) {
      Console.criticalln("*** FATAL ERROR in main(): " + e);
      Console.criticalln("Stack trace: " + (e.stack || "No stack trace available"));
      throw e; // Re-throw so PixInsight shows the error
   }
}

// Execute main function
main();

})(); // End IIFE - Script isolation wrapper
