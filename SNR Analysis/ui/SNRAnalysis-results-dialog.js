/*
 * SNRAnalysis-results-dialog.js
 * Results presentation dialogs for single and multi-filter analysis
 */

/**
 * Show single-filter results dialog
 * @param {Array} results - Array of integration depth result objects
 * @param {number} totalTimeSec - Total analysis runtime in seconds
 * @param {string} outputDir - Output directory path
 * @param {string} graphPath - Optional path to graph image file
 */
function showResultsDialog(results, totalTimeSec, outputDir, graphPath) {
   var dialog = new Dialog();
   dialog.windowTitle = "SNR Analysis Complete";
   dialog.scaledMinWidth = 800;
   dialog.scaledMinHeight = 900;
   
   // Results summary
   var summaryText = new TextBox(dialog);
   summaryText.readOnly = true;
   summaryText.styleSheet = "font-family: monospace; font-size: 10pt;";
   summaryText.setScaledMinSize(750, 415);
   
   var text = "=== SNR ANALYSIS RESULTS ===\n\n";
   text += "Analyzed " + results.length + " integration depths\n";
   text += "Total runtime: " + formatTime(totalTimeSec) + "\n\n";
   
   text += "Label        N Subs    Total Exp        SNR      \u0394 SNR\n";
   text += "--------------------------------------------------------\n";
   
   for (var i = 0; i < results.length; i++) {
      var r = results[i];
      var deltaSNR = "";
      
      if (i > 0) {
         var delta = ((r.snr - results[i-1].snr) / results[i-1].snr) * 100;
         deltaSNR = (delta >= 0 ? "+" : "") + delta.toFixed(1) + "%";
      }
      
      var line = padRight(r.label, 12) + " " + 
                 padLeft(r.depth.toString(), 6) + "    " +
                 padLeft(formatTime(r.totalExposure), 12) + "  " +
                 padLeft(r.snr.toFixed(2), 6) + "    " +
                 padLeft(deltaSNR, 8) + "\n";
      text += line;
   }
   
   text += "\n=== INSIGHTS ===\n\n";
   
   // Find diminishing returns points
   var thresh10 = -1, thresh5 = -1;
   for (var i = 1; i < results.length; i++) {
      var improvement = ((results[i].snr - results[i-1].snr) / results[i-1].snr) * 100;
      if (improvement < 10 && thresh10 === -1) thresh10 = i;
      if (improvement < 5 && thresh5 === -1) thresh5 = i;
   }
   
   if (thresh10 > 0) {
      text += "\u2022 SNR improvements drop below 10% after " + results[thresh10].label;
      text += " (" + formatTime(results[thresh10].totalExposure) + ")\n";
   }
   
   if (thresh5 > 0) {
      text += "\u2022 SNR improvements drop below 5% after " + results[thresh5].label;
      text += " (" + formatTime(results[thresh5].totalExposure) + ")\n";
   }
   
   text += "\n=== OUTPUT FILES ===\n\n";
   text += "Location: " + outputDir + "\n\n";
   text += "\u2022 snr_results.csv - Full data for spreadsheet analysis\n";
   text += "\u2022 snr_results.json - Structured data with insights\n";
   text += "\u2022 snr_graph.png/jpg - Visual plot of SNR vs time\n";
   text += "\u2022 int_NX.xisf - Integration files for each depth\n";
   
   summaryText.text = text;
   
   // Create preview TabBox to hold Graph and Stack preview
   var previewTabBox = new TabBox(dialog);
   
   // Tab 1: Graph Preview (existing functionality preserved)
   var graphTab = new Control(dialog);
   graphTab.sizer = new VerticalSizer;
   graphTab.sizer.margin = 4;
   graphTab.sizer.spacing = 4;
   
   // Graph preview using ScrollBox (existing code preserved)
   var graphPreview = null;
   
   // Use provided graphPath if available, otherwise try default locations
   if (!graphPath) {
      graphPath = outputDir + "/snr_graph.png";
      if (!File.exists(graphPath)) {
         graphPath = outputDir + "/snr_graph.jpg";
      }
      if (!File.exists(graphPath)) {
         graphPath = outputDir + "/snr_graph.bmp";
      }
   }
   
   console.writeln("Single-filter dialog checking graph: " + graphPath);
   console.writeln("  File.exists: " + File.exists(graphPath));
   
   if (graphPath && File.exists(graphPath)) {
      try {
         var bmp = new Bitmap(graphPath);
         
         graphPreview = new ScrollBox(graphTab);
         graphPreview.autoScroll = true;
         graphPreview.setScaledMinSize(780, 420);
         graphPreview.setScaledMaxSize(780, 420);
         
         // Store bitmap reference for paint handler
         graphPreview.graphBitmap = bmp;
         
         graphPreview.viewport.onPaint = function(x0, y0, x1, y1) {
            var g = new Graphics(this);
            var bmp = this.parent.graphBitmap;
            
            if (bmp && bmp.width > 0 && bmp.height > 0) {
               // Fill background (white for single-filter)
               g.fillRect(x0, y0, x1, y1, new Brush(0xFFFFFFFF));
               
               // Calculate scale to fit viewport
               var maxWidth = 760;
               var maxHeight = 400;
               var scale = Math.min(maxWidth / bmp.width, maxHeight / bmp.height, 1.0);
               var scaledWidth = Math.floor(bmp.width * scale);
               var scaledHeight = Math.floor(bmp.height * scale);
               
               // Center the scaled bitmap in the viewport
               var xOffset = Math.max(0, (this.width - scaledWidth) / 2);
               var yOffset = Math.max(0, (this.height - scaledHeight) / 2);
               
               // Draw scaled bitmap
               g.drawScaledBitmap(xOffset, yOffset, xOffset + scaledWidth, yOffset + scaledHeight, bmp);
            } else {
               g.fillRect(x0, y0, x1, y1, new Brush(0xFFFFFFFF));
               g.pen = new Pen(0xFF000000);
               g.drawText(10, 30, "No graph available");
            }
            
            g.end();
         };
         
         console.writeln("Graph preview loaded: " + graphPath + " (" + bmp.width + "x" + bmp.height + ")");
      } catch (e) {
         console.warningln("Graph preview failed: " + e.message);
         graphPreview = null;
      }
   }
   
   if (graphPreview) {
      graphTab.sizer.add(graphPreview);
   } else {
      var noGraphLabel = new Label(graphTab);
      noGraphLabel.text = "Graph not available";
      noGraphLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;
      graphTab.sizer.add(noGraphLabel);
   }
   
   previewTabBox.addPage(graphTab, "Graph");
   
   // Tab 2: Stack Preview
   var stackTab = createStackPreviewPanel(
      dialog,
      createStackPreviewEntries(results, outputDir, "", CONFIG.generateStarless),
      CONFIG.stackMode === "cropped",
      ""
   );
   
   previewTabBox.addPage(stackTab, "Stack Preview");
   
   // Default to Graph tab
   previewTabBox.currentPageIndex = 0;
   
   // Buttons
   var buttonSizer = new HorizontalSizer;
   buttonSizer.spacing = 6;
   buttonSizer.addStretch();
   
   var okButton = new PushButton(dialog);
   okButton.text = "OK";
   okButton.icon = dialog.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      dialog.ok();
   };
   buttonSizer.add(okButton);
   
   // Layout
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 8;
   dialog.sizer.spacing = 6;
   dialog.sizer.add(summaryText);
   dialog.sizer.add(previewTabBox);
   dialog.sizer.add(buttonSizer);
   
   dialog.execute();
}

/**
 * Show multi-filter results dialog with tabs for each filter
 * @param {Array} allFilterResults - Array of {filterName, results, rois, insights, totalTime, graphPath}
 * @param {string} outputDir - Output directory
 */
function showMultiFilterResultsDialog(allFilterResults, outputDir) {
   // If single filter, use original dialog
   if (allFilterResults.length === 1) {
      var fr = allFilterResults[0];
      showResultsDialog(fr.results, fr.totalTime, outputDir, fr.graphPath);
      return;
   }
   
   // Multi-filter tabbed dialog
   var dialog = new Dialog();
   dialog.windowTitle = "SNR Analysis Complete - Multiple Filters";
   
   var tabBox = new TabBox(dialog);
   
   // Create a tab for each filter
   for (var i = 0; i < allFilterResults.length; i++) {
      var fr = allFilterResults[i];
      var tabPage = new Control(dialog);
      tabPage.sizer = new VerticalSizer;
      tabPage.sizer.margin = 8;
      tabPage.sizer.spacing = 6;
      
      // Summary text
      var summaryText = new TextBox(tabPage);
      summaryText.readOnly = true;
      summaryText.styleSheet = "QTextEdit { font-family: 'Courier New', monospace; font-size: 10pt; }";
      summaryText.setScaledMinSize(750, 340);
      
      var summaryContent = "";
      summaryContent += "SNR Analysis Results - " + fr.filterName + "\n";
      summaryContent += "=".repeat(80) + "\n\n";
      
      summaryContent += "Output Directory: " + outputDir + "\n";
      summaryContent += "Total Runtime: " + formatTime(fr.totalTime) + "\n";
      summaryContent += "Depths Analyzed: " + fr.results.length + "\n\n";
      
      summaryContent += padRight("Label", 12) + padRight("N Subs", 10) + padRight("Total Exp", 15) + 
                       padRight("SNR", 10) + padRight("Int Time", 12) + "Star/Stretch\n";
      summaryContent += "-".repeat(80) + "\n";
      
      for (var j = 0; j < fr.results.length; j++) {
         var r = fr.results[j];
         var totalExpStr = formatTime(r.totalExposure);
         var intTimeStr = r.integrationTime.toFixed(1) + "s";
         var starStretchStr = r.starRemovalTime.toFixed(1) + "s / " + r.stretchTime.toFixed(1) + "s";
         
         summaryContent += padRight(r.label, 12) + 
                          padRight(r.depth.toString(), 10) + 
                          padRight(totalExpStr, 15) + 
                          padRight(r.snr.toFixed(2), 10) + 
                          padRight(intTimeStr, 12) + 
                          starStretchStr + "\n";
      }
      
      // Add insights if available
      if (fr.insights) {
         summaryContent += "\n" + "=".repeat(80) + "\n";
         summaryContent += "INSIGHTS\n";
         summaryContent += "=".repeat(80) + "\n\n";
         
         if (fr.insights.scalingExponent !== undefined) {
            summaryContent += "Scaling Exponent: " + fr.insights.scalingExponent.toFixed(3) + 
                            " (ideal √N = 0.500)\n";
         }
         
         if (fr.insights.diminishingReturns10pct) {
            summaryContent += "Diminishing Returns (< 10% gain): " + fr.insights.diminishingReturns10pct + "\n";
         }
         
         if (fr.insights.diminishingReturns5pct) {
            summaryContent += "Diminishing Returns (< 5% gain): " + fr.insights.diminishingReturns5pct + "\n";
         }
         
         if (fr.insights.recommendedRange) {
            summaryContent += "Recommended Range: " + 
                            formatTime(fr.insights.recommendedRange.minExposure) + " - " +
                            formatTime(fr.insights.recommendedRange.maxExposure) + "\n";
         }
         
         // Future projections if available
         if (fr.insights.needsMoreData && fr.insights.projectedGains) {
            summaryContent += "\nADDITIONAL INTEGRATION RECOMMENDED:\n";
            var proj = fr.insights.projectedGains;
            
            summaryContent += "Current: " + proj.currentDepth + " subs, SNR = " + proj.currentSNR.toFixed(2) + "\n";
            summaryContent += "Doubling integration (" + formatTime(proj.projection2x.totalTime) + " total):\n";
            summaryContent += "  → Projected SNR: " + proj.projection2x.snr.toFixed(2) + 
                            " (+" + proj.projection2x.gain.toFixed(1) + "% gain)\n";
            summaryContent += "  → Additional time needed: " + formatTime(proj.projection2x.additionalTime) + "\n";
            
            summaryContent += "Tripling integration (" + formatTime(proj.projection3x.totalTime) + " total):\n";
            summaryContent += "  → Projected SNR: " + proj.projection3x.snr.toFixed(2) + 
                            " (+" + proj.projection3x.gain.toFixed(1) + "% gain)\n";
            summaryContent += "  → Additional time needed: " + formatTime(proj.projection3x.additionalTime) + "\n";
         } else if (!fr.insights.needsMoreData) {
            summaryContent += "\nINTEGRATION STATUS:\n";
            summaryContent += "Diminishing returns reached - additional integration may not be cost-effective\n";
         }
         
         if (fr.insights.anomalies && fr.insights.anomalies.length > 0) {
            summaryContent += "\nAnomalies Detected:\n";
            for (var k = 0; k < fr.insights.anomalies.length; k++) {
               summaryContent += "  - " + fr.insights.anomalies[k] + "\n";
            }
         }
      }
      
      summaryText.text = summaryContent;
      tabPage.sizer.add(summaryText);
      
      // Create preview TabBox for Graph and Stack preview
      var previewTabBox = new TabBox(tabPage);
      
      // Tab 1: Graph Preview (existing functionality)
      var graphTab = new Control(tabPage);
      graphTab.sizer = new VerticalSizer;
      graphTab.sizer.margin = 4;
      graphTab.sizer.spacing = 4;
      
      // Graph preview
      console.writeln("Filter " + fr.filterName + " - graphPath: " + (fr.graphPath ? fr.graphPath : "NULL"));
      if (fr.graphPath) {
         console.writeln("  File.exists(" + fr.graphPath + "): " + File.exists(fr.graphPath));
      }
      
      if (fr.graphPath && File.exists(fr.graphPath)) {
         try {
            var scrollBox = new ScrollBox(graphTab);
            scrollBox.setScaledMinSize(780, 420);
            scrollBox.autoScroll = true;
            scrollBox.tracking = true;
            scrollBox.cursor = new Cursor(StdCursor_Arrow);
            
            // Load bitmap
            var bmp = new Bitmap(fr.graphPath);
            
            console.writeln("Graph preview (" + fr.filterName + "): " + bmp.width + "x" + bmp.height);
            
            // Store bitmap reference for paint handler
            scrollBox.graphBitmap = bmp;
            
            scrollBox.viewport.onPaint = function(x0, y0, x1, y1) {
               var g = new Graphics(this);
               var bmp = this.parent.graphBitmap;
               
               if (bmp && bmp.width > 0 && bmp.height > 0) {
                  // Fill background
                  g.fillRect(x0, y0, x1, y1, new Brush(0xFF222222));
                  
                  // Calculate scale to fit viewport
                  var maxWidth = 760;
                  var maxHeight = 400;
                  var scale = Math.min(maxWidth / bmp.width, maxHeight / bmp.height, 1.0);
                  var scaledWidth = Math.floor(bmp.width * scale);
                  var scaledHeight = Math.floor(bmp.height * scale);
                  
                  // Center the image
                  var xOffset = Math.max(0, (this.width - scaledWidth) / 2);
                  var yOffset = Math.max(0, (this.height - scaledHeight) / 2);
                  
                  // Draw scaled bitmap
                  g.drawScaledBitmap(xOffset, yOffset, xOffset + scaledWidth, yOffset + scaledHeight, bmp);
               } else {
                  // No bitmap - show placeholder
                  g.fillRect(x0, y0, x1, y1, new Brush(0xFF222222));
                  g.pen = new Pen(0xFFFFFFFF);
                  g.drawText(10, 30, "No graph available");
               }
               
               g.end();
            };
            
            graphTab.sizer.add(scrollBox);
            console.writeln("Graph preview added to tab for " + fr.filterName);
         } catch (e) {
            console.warningln("Failed to load graph for " + fr.filterName + ": " + e.message);
            var noGraphLabel = new Label(graphTab);
            noGraphLabel.text = "Graph load failed: " + e.message;
            noGraphLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;
            graphTab.sizer.add(noGraphLabel);
         }
      } else {
         console.writeln("Skipping graph preview for " + fr.filterName + " - no valid path");
         var noGraphLabel = new Label(graphTab);
         noGraphLabel.text = "Graph not available";
         noGraphLabel.textAlignment = TextAlign_Center | TextAlign_VertCenter;
         graphTab.sizer.add(noGraphLabel);
      }
      
      previewTabBox.addPage(graphTab, "Graph");
      
      // Tab 2: Stack Preview
      var filterSuffix = "_" + fr.filterName.replace(/[^a-zA-Z0-9]/g, "_");
      var stackTab = createStackPreviewPanel(
         tabPage,
         createStackPreviewEntries(fr.results, outputDir, filterSuffix, CONFIG.generateStarless),
         CONFIG.stackMode === "cropped",
         fr.filterName
      );
      
      previewTabBox.addPage(stackTab, "Stack Preview");
      
      // Default to Graph tab
      previewTabBox.currentPageIndex = 0;
      
      tabPage.sizer.add(previewTabBox);
      
      tabBox.addPage(tabPage, fr.filterName);
   }
   
   // OK button
   var okButton = new PushButton(dialog);
   okButton.text = "OK";
   okButton.icon = dialog.scaledResource(":/icons/ok.png");
   okButton.onClick = function() {
      dialog.ok();
   };
   
   var buttonsSizer = new HorizontalSizer;
   buttonsSizer.addStretch();
   buttonsSizer.add(okButton);
   
   // Main layout
   dialog.sizer = new VerticalSizer;
   dialog.sizer.margin = 8;
   dialog.sizer.spacing = 6;
   dialog.sizer.add(tabBox, 100);
   dialog.sizer.add(buttonsSizer);
   
   dialog.adjustToContents();
   dialog.setScaledMinHeight(900);
   dialog.execute();
}

/**
 * Helper: Pad string on the right to specified length
 */
function padRight(str, len) {
   str = str.toString();
   while (str.length < len) str += " ";
   return str;
}

/**
 * Helper: Pad string on the left to specified length
 */
function padLeft(str, len) {
   str = str.toString();
   while (str.length < len) str = " " + str;
   return str;
}
