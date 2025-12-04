/*
 * SNRAnalysis-graph.js
 * Graph generation for SNR vs integration time
 */

#include <pjsr/ColorSpace.jsh>
#include <pjsr/SampleType.jsh>

/**
 * Generate SNR vs integration time graph
 * @param {Array} results - Array of depth results
 * @param {string} outputDir - Output directory
 * @param {string} filterSuffix - Optional suffix for filter name (e.g., "_Ha")
 * @param {string} filterName - Optional filter name for graph title
 * @returns {string} Path to saved graph file
 */
function generateGraph(results, outputDir, filterSuffix, filterName) {
   filterSuffix = filterSuffix || "";
   filterName = filterName || "";
   
   if (results.length < 2) {
      console.warningln("Need at least 2 data points to generate graph");
      return "";
   }
   
   // Graph dimensions
   var width = 1000;
   var height = 600;
   var marginLeft = 80;
   var marginRight = 40;
   var marginTop = 40;
   var marginBottom = 60;
   
   var plotWidth = width - marginLeft - marginRight;
   var plotHeight = height - marginTop - marginBottom;
   
   // Create bitmap for drawing
   var bmp = new Bitmap(width, height);
   bmp.fill(0xFFFFFFFF);  // White
   
   var g = new VectorGraphics(bmp);
   g.antialiasing = true;
   
   // Calculate data ranges
   var minTime = results[0].totalExposure;
   var maxTime = results[results.length - 1].totalExposure;
   var minSNR = results[0].snr;
   var maxSNR = results[0].snr;
   
   for (var i = 1; i < results.length; i++) {
      if (results[i].snr < minSNR) minSNR = results[i].snr;
      if (results[i].snr > maxSNR) maxSNR = results[i].snr;
   }
   
   // Add padding to ranges
   var timeRange = maxTime - minTime;
   var snrRange = maxSNR - minSNR;
   minTime = Math.max(0, minTime - timeRange * 0.05);
   maxTime = maxTime + timeRange * 0.05;
   minSNR = Math.max(0, minSNR - snrRange * 0.1);
   maxSNR = maxSNR + snrRange * 0.1;
   
   // Draw axes
   g.pen = new Pen(0xFF000000, 2);  // Black, 2px
   g.drawLine(marginLeft, height - marginBottom, width - marginRight, height - marginBottom);  // X-axis
   g.drawLine(marginLeft, marginTop, marginLeft, height - marginBottom);  // Y-axis
   
   // Draw grid and labels
   g.pen = new Pen(0xFFCCCCCC, 1);  // Light gray
   g.font = new Font("Helvetica", 10);
   g.textAntialiasing = true;
   
   // X-axis ticks and grid
   var numXTicks = 8;
   for (var i = 0; i <= numXTicks; i++) {
      var time = minTime + (maxTime - minTime) * i / numXTicks;
      var x = marginLeft + plotWidth * (time - minTime) / (maxTime - minTime);
      
      // Grid line
      g.drawLine(x, marginTop, x, height - marginBottom);
      
      // Tick mark
      g.pen = new Pen(0xFF000000, 2);
      g.drawLine(x, height - marginBottom, x, height - marginBottom + 5);
      
      // Label
      var label = formatTimeShort(time);
      var textWidth = g.font.width(label);
      g.drawText(x - textWidth / 2, height - marginBottom + 20, label);
      
      g.pen = new Pen(0xFFCCCCCC, 1);
   }
   
   // Y-axis ticks and grid
   var numYTicks = 6;
   for (var i = 0; i <= numYTicks; i++) {
      var snr = minSNR + (maxSNR - minSNR) * i / numYTicks;
      var y = height - marginBottom - plotHeight * (snr - minSNR) / (maxSNR - minSNR);
      
      // Grid line
      g.drawLine(marginLeft, y, width - marginRight, y);
      
      // Tick mark
      g.pen = new Pen(0xFF000000, 2);
      g.drawLine(marginLeft - 5, y, marginLeft, y);
      
      // Label
      var label = snr.toFixed(1);
      var textWidth = g.font.width(label);
      g.drawText(marginLeft - textWidth - 10, y + 4, label);
      
      g.pen = new Pen(0xFFCCCCCC, 1);
   }
   
   // Axis labels
   g.font = new Font("Helvetica", 12);
   g.pen = new Pen(0xFF000000);
   
   var xLabel = "Integration Time";
   g.drawText(width / 2 - g.font.width(xLabel) / 2, height - 15, xLabel);
   
   var yLabel = "SNR";
   g.drawText(15, marginTop + plotHeight / 2, yLabel);
   
   // Title
   g.font = new Font("Helvetica", 14);
   var title = "SNR vs Integration Depth Analysis";
   if (filterName && filterName.length > 0) {
      title += " - " + filterName;
   }
   g.drawText(width / 2 - g.font.width(title) / 2, 20, title);
   
   // Plot data points and lines
   g.pen = new Pen(0xFF0000FF, 3);  // Blue, 3px
   
   for (var i = 0; i < results.length; i++) {
      var time = results[i].totalExposure;
      var snr = results[i].snr;
      
      var x = marginLeft + plotWidth * (time - minTime) / (maxTime - minTime);
      var y = height - marginBottom - plotHeight * (snr - minSNR) / (maxSNR - minSNR);
      
      // Draw point
      g.fillCircle(x, y, 4);
      
      // Draw line to next point
      if (i < results.length - 1) {
         var nextTime = results[i + 1].totalExposure;
         var nextSNR = results[i + 1].snr;
         var nextX = marginLeft + plotWidth * (nextTime - minTime) / (maxTime - minTime);
         var nextY = height - marginBottom - plotHeight * (nextSNR - minSNR) / (maxSNR - minSNR);
         
         g.drawLine(x, y, nextX, nextY);
      }
   }
   
   g.end();
   
   // Try to save as PNG first, fallback to JPEG
   var graphSaved = false;
   var graphPath = "";
   
   // Try PNG
   var pngPath = outputDir + "/snr_graph" + filterSuffix + ".png";
   try {
      if (bmp.save(pngPath)) {
         console.writeln("Graph saved: " + pngPath);
         graphSaved = true;
         graphPath = pngPath;
      }
   } catch (e) {
      // PNG failed, try JPEG
   }
   
   // Try JPEG if PNG failed
   if (!graphSaved) {
      var jpgPath = outputDir + "/snr_graph" + filterSuffix + ".jpg";
      try {
         if (bmp.save(jpgPath)) {
            console.writeln("Graph saved: " + jpgPath);
            graphSaved = true;
            graphPath = jpgPath;
         }
      } catch (e) {
         console.warningln("Failed to save graph: " + e.message);
      }
   }
   
   if (!graphSaved) {
      console.warningln("Could not save graph image - no suitable format available");
   }
   
   console.writeln("Graph generation complete");
   return graphPath;
}

/**
 * Format time for graph labels (shorter format)
 */
function formatTimeShort(seconds) {
   var h = Math.floor(seconds / 3600);
   var m = Math.floor((seconds % 3600) / 60);
   
   if (h > 0 && m > 0) {
      return h + "h" + m + "m";
   } else if (h > 0) {
      return h + "h";
   } else if (m > 0) {
      return m + "m";
   } else {
      return Math.floor(seconds) + "s";
   }
}
