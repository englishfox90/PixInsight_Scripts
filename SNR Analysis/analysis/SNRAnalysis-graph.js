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
      return null;
   }
   
   // Graph dimensions
   var width = 1000;
   var height = 600;
   var marginLeft = 150;  // Increased for Y-axis label
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
   
   // Y-axis label (horizontal, on left side)
   var yLabel = "SNR";
   g.drawText(10, (marginTop + height - marginBottom) / 2, yLabel);
   
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
   
   // Save bitmap to file using PixInsight's FileFormat API
   var graphPath = null;
   
   // Try PNG first
   var pngPath = CONFIG.graphsDir + "/snr_graph" + filterSuffix + ".png";
   var pngFormat = new FileFormat("PNG", false, false);
   
   if (pngFormat.canWrite) {
      try {
         var writer = new FileFormatInstance(pngFormat);
         if (writer.create(pngPath)) {
            var img = new Image(Math.floor(bmp.width), Math.floor(bmp.height));
            img.blend(bmp);
            
            if (writer.writeImage(img)) {
               writer.close();
               console.writeln("Graph saved as PNG: " + pngPath);
               graphPath = pngPath;
            } else {
               writer.close();
            }
         }
      } catch (e) {
         console.warningln("PNG save failed: " + e.message);
      }
   }
   
   // Try JPEG if PNG failed
   if (!graphPath) {
      var jpgPath = CONFIG.graphsDir + "/snr_graph" + filterSuffix + ".jpg";
      var jpgFormat = new FileFormat("JPEG", false, false);
      
      if (jpgFormat.canWrite) {
         try {
            var writer = new FileFormatInstance(jpgFormat);
            if (writer.create(jpgPath)) {
               var img = new Image(Math.floor(bmp.width), Math.floor(bmp.height));
               img.blend(bmp);
               
               if (writer.writeImage(img)) {
                  writer.close();
                  console.writeln("Graph saved as JPEG: " + jpgPath);
                  graphPath = jpgPath;
               } else {
                  writer.close();
               }
            }
         } catch (e) {
            console.warningln("JPEG save failed: " + e.message);
         }
      }
   }
   
   // Try BMP as last resort
   if (!graphPath) {
      var bmpPath = CONFIG.graphsDir + "/snr_graph" + filterSuffix + ".bmp";
      try {
         if (bmp.save(bmpPath)) {
            console.writeln("Graph saved as BMP: " + bmpPath);
            graphPath = bmpPath;
         }
      } catch (e) {
         console.warningln("BMP save failed: " + e.message);
      }
   }
   
   if (!graphPath) {
      console.warningln("Could not save graph - all formats failed. Check PixInsight file format support.");
   }
   
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

/**
 * Generate Gain/hr vs integration time graph
 * @param {Array} results - Array of depth results
 * @param {string} outputDir - Output directory
 * @param {string} filterSuffix - Optional suffix for filter name (e.g., "_Ha")
 * @param {string} filterName - Optional filter name for graph title
 * @returns {string} Path to saved graph file
 */
function generateGainGraph(results, outputDir, filterSuffix, filterName) {
   filterSuffix = filterSuffix || "";
   filterName = filterName || "";
   
   // Need at least 2 points with gain data
   var gainPoints = [];
   for (var i = 1; i < results.length; i++) {
      if (results[i].gainPerHour !== null && results[i].gainPerHour !== undefined) {
         gainPoints.push({
            time: results[i].totalExposure,
            gain: results[i].gainPerHour,
            label: results[i].label
         });
      }
   }
   
   if (gainPoints.length < 1) {
      console.warningln("Need at least 1 point with gain/hr data to generate graph");
      return null;
   }
   
   // Graph dimensions
   var width = 1000;
   var height = 600;
   var marginLeft = 170;  // Increased for Y-axis label
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
   var minTime = results[1].totalExposure;
   var maxTime = results[results.length - 1].totalExposure;
   var minGain = gainPoints[0].gain;
   var maxGain = gainPoints[0].gain;
   
   for (var i = 1; i < gainPoints.length; i++) {
      if (gainPoints[i].gain < minGain) minGain = gainPoints[i].gain;
      if (gainPoints[i].gain > maxGain) maxGain = gainPoints[i].gain;
   }
   
   // Add padding to ranges
   var gainRange = maxGain - minGain;
   if (gainRange < 1) gainRange = 1;  // Minimum range
   minGain = Math.max(0, minGain - gainRange * 0.1);
   maxGain = maxGain + gainRange * 0.1;
   
   // Add 2% threshold line
   if (minGain > 2.0) minGain = 0;
   if (maxGain < 2.0) maxGain = 2.5;
   
   // Draw axes
   g.pen = new Pen(0xFF000000, 2);
   g.drawLine(marginLeft, marginTop, marginLeft, height - marginBottom);  // Y axis
   g.drawLine(marginLeft, height - marginBottom, width - marginRight, height - marginBottom);  // X axis
   
   // Draw grid lines and Y labels (Gain/hr)
   g.pen = new Pen(0xFFE0E0E0, 1);
   g.font = new Font("helvetica", 10);
   
   var nYTicks = 8;
   for (var i = 0; i <= nYTicks; i++) {
      var gainValue = minGain + (maxGain - minGain) * i / nYTicks;
      var y = height - marginBottom - (gainValue - minGain) / (maxGain - minGain) * plotHeight;
      
      // Grid line
      g.drawLine(marginLeft, y, width - marginRight, y);
      
      // Label
      g.pen = new Pen(0xFF000000);
      var label = gainValue.toFixed(1) + "%/h";
      var textWidth = g.font.width(label);
      g.drawText(marginLeft - textWidth - 10, y + 5, label);
      g.pen = new Pen(0xFFE0E0E0, 1);
   }
   
   // Draw X labels (time)
   var nXTicks = 6;
   for (var i = 0; i <= nXTicks; i++) {
      var timeValue = minTime + (maxTime - minTime) * i / nXTicks;
      var x = marginLeft + (timeValue - minTime) / (maxTime - minTime) * plotWidth;
      
      // Grid line
      g.drawLine(x, marginTop, x, height - marginBottom);
      
      // Label
      g.pen = new Pen(0xFF000000);
      var label = formatTimeShort(timeValue);
      var textWidth = g.font.width(label);
      g.drawText(x - textWidth / 2, height - marginBottom + 20, label);
      g.pen = new Pen(0xFFE0E0E0, 1);
   }
   
   // Draw 2% threshold line (red dashed - using manual dashing)
   var y2pct = height - marginBottom - (2.0 - minGain) / (maxGain - minGain) * plotHeight;
   g.pen = new Pen(0xFFFF0000, 2);
   
   // Draw dashed line manually (10px dash, 5px gap)
   var dashLen = 10;
   var gapLen = 5;
   var xStart = marginLeft;
   var xEnd = width - marginRight;
   var x = xStart;
   while (x < xEnd) {
      var x1 = x;
      var x2 = Math.min(x + dashLen, xEnd);
      g.drawLine(x1, y2pct, x2, y2pct);
      x += dashLen + gapLen;
   }
   
   // Label for threshold
   g.pen = new Pen(0xFFFF0000);
   g.font = new Font("helvetica", 10);
   g.drawText(marginLeft + 10, y2pct - 5, "2.0%/h threshold");
   
   // Plot data points and lines
   g.pen = new Pen(0xFF0066CC, 3);
   for (var i = 1; i < gainPoints.length; i++) {
      var x1 = marginLeft + (gainPoints[i-1].time - minTime) / (maxTime - minTime) * plotWidth;
      var y1 = height - marginBottom - (gainPoints[i-1].gain - minGain) / (maxGain - minGain) * plotHeight;
      var x2 = marginLeft + (gainPoints[i].time - minTime) / (maxTime - minTime) * plotWidth;
      var y2 = height - marginBottom - (gainPoints[i].gain - minGain) / (maxGain - minGain) * plotHeight;
      
      g.drawLine(x1, y1, x2, y2);
   }
   
   // Draw data points
   g.pen = new Pen(0xFF0066CC, 2);
   g.brush = new Brush(0xFF0066CC);
   for (var i = 0; i < gainPoints.length; i++) {
      var x = marginLeft + (gainPoints[i].time - minTime) / (maxTime - minTime) * plotWidth;
      var y = height - marginBottom - (gainPoints[i].gain - minGain) / (maxGain - minGain) * plotHeight;
      
      g.fillRect(x - 4, y - 4, x + 4, y + 4);
   }
   
   // Title
   g.pen = new Pen(0xFF000000);
   g.font = new Font("helvetica", 16);
   var title = "Gain per Hour vs Integration Time";
   if (filterName) {
      title += " (" + filterName + ")";
   }
   var titleWidth = g.font.width(title);
   g.drawText((width - titleWidth) / 2, 25, title);
   
   // Y axis label (horizontal, on left side)
   g.font = new Font("helvetica", 12);
   var yLabel = "Gain/hr";
   g.drawText(10, (marginTop + height - marginBottom) / 2, yLabel);
   
   // X axis label
   g.font = new Font("helvetica", 12);
   var xLabel = "Total Integration Time";
   var xLabelWidth = g.font.width(xLabel);
   g.drawText((width - xLabelWidth) / 2, height - 15, xLabel);
   
   g.end();
   
   // Save graph - try PNG first (matching SNR graph save logic)
   var graphPath = null;
   var pngPath = CONFIG.graphsDir + "/gain_graph" + filterSuffix + ".png";
   var pngFormat = new FileFormat("PNG", false, false);
   
   if (pngFormat.canWrite) {
      try {
         var writer = new FileFormatInstance(pngFormat);
         if (writer.create(pngPath)) {
            var img = new Image(Math.floor(bmp.width), Math.floor(bmp.height));
            img.blend(bmp);
            
            if (writer.writeImage(img)) {
               writer.close();
               console.writeln("Gain graph saved as PNG: " + pngPath);
               graphPath = pngPath;
            } else {
               writer.close();
            }
         }
      } catch (e) {
         console.warningln("PNG save failed: " + e.message);
      }
   }
   
   if (!graphPath) {
      console.warningln("Could not save gain graph");
   }
   
   return graphPath;
}
