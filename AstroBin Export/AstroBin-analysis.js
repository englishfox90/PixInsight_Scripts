/*
 * AstroBin CSV Export - Image Analysis Engine
 * FITS/XISF metadata extraction and data aggregation
 */

// Convert Bortle Scale to SQM estimate
function bortleToSQM(bortleClass)
{
   // Based on typical Bortle-SQM relationships
   var sqmValues = {
      1: 21.8,  // Excellent dark site
      2: 21.6,  // Typical dark site  
      3: 21.4,  // Rural sky
      4: 20.8,  // Rural/suburban transition
      5: 19.8,  // Suburban sky
      6: 18.6,  // Bright suburban
      7: 18.0,  // Suburban/urban transition
      8: 17.8,  // City sky
      9: 15.5   // Inner city
   };
   
   var roundedClass = Math.round(bortleClass);
   return sqmValues[roundedClass] || 19.0; // Default fallback
}

function analyzeFiles( files ){
  var rows = [];
  var globalData = {}; // Store global parameters from first image
  var calibrationCounts = { bias: 0, darks: 0, flats: 0, flatDarks: 0 };
  var availableMetadata = {
    hasAmbientTemp: false,
    hasSQM: false,
    hasFWHM: false,
    hasBortle: false
  };
  
  // First pass: scan all files to detect calibration frames and available metadata
  console.writeln("Scanning " + files.length + " files for calibration frames and metadata...");
  
  for ( var i=0; i<files.length; i++ ){
    var p = files[i];
    
    try{
      var ff = openForKeywords( p );
      var imageTypeStr = readKeyword( ff, "IMAGETYP" ) || readKeyword( ff, "IMGTYPE" );
      
      // Count calibration frames
      if (imageTypeStr) {
        var imageType = imageTypeStr.toLowerCase();
        if (imageType.indexOf("bias") >= 0) {
          calibrationCounts.bias++;
        } else if (imageType.indexOf("dark") >= 0) {
          if (imageType.indexOf("flat") >= 0) {
            calibrationCounts.flatDarks++;
          } else {
            calibrationCounts.darks++;
          }
        } else if (imageType.indexOf("flat") >= 0) {
          calibrationCounts.flats++;
        }
      }
      
      // Check for available metadata (from any image)
      if (!availableMetadata.hasAmbientTemp) {
        var ambTempStr = readKeyword( ff, "AMBTEMP" ) || readKeyword( ff, "AMBIENTTEMP" );
        if (ambTempStr) availableMetadata.hasAmbientTemp = true;
      }
      
      if (!availableMetadata.hasSQM) {
        var sqmStr = readKeyword( ff, "SQM" ) || readKeyword( ff, "SKYMAG" );
        var skyBrightnessStr = readKeyword( ff, "SKYBRGHT" ) || readKeyword( ff, "SKY-BRGHT" ) || readKeyword( ff, "SKYLUX" );
        if (sqmStr || skyBrightnessStr) availableMetadata.hasSQM = true;
      }
      
      if (!availableMetadata.hasFWHM) {
        var fwhmStr = readKeyword( ff, "FWHM" ) || readKeyword( ff, "SEEING" );
        if (fwhmStr) availableMetadata.hasFWHM = true;
      }
      
      if (!availableMetadata.hasBortle) {
        var bortleStr = readKeyword( ff, "BORTLE" ) || readKeyword( ff, "LIGHTPOL" );
        if (bortleStr) availableMetadata.hasBortle = true;
      }
      
      ff.close();
    }catch(e){
      // Continue scanning other files
    }
  }
  
  console.writeln("Calibration frames found: " + calibrationCounts.bias + " bias, " + 
                  calibrationCounts.darks + " darks, " + calibrationCounts.flats + " flats, " + 
                  calibrationCounts.flatDarks + " flat darks");
  
  // Second pass: process LIGHT images for data extraction
  for ( var i=0; i<files.length; i++ ){
    var p = files[i];
    
    // Show progress every 10 files
    if (i % 10 === 0 || i === files.length - 1) {
      console.writeln("Processing file " + (i + 1) + " of " + files.length + ": " + File.extractName(p));
    }
    
    try{
      var ff = openForKeywords( p );
      var imageTypeStr = readKeyword( ff, "IMAGETYP" ) || readKeyword( ff, "IMGTYPE" );
      
      // Skip calibration frames - we only want LIGHT images in the results
      if (imageTypeStr && imageTypeStr.toLowerCase().indexOf("light") < 0) {
        ff.close();
        continue;
      }
      
      var dateStr = readKeyword( ff, "DATE-OBS" ) || readKeyword( ff, "DATEOBS" );
      var filter = readKeyword( ff, "FILTER" );
      
      // If no filter found in header, try to extract from filename
      if (!filter || filter === "" || filter === "None") {
        var filename = File.extractName(p);
        console.writeln("No filter in header, trying filename: " + filename);
        
        // Split filename by underscores and look for filter pattern
        var parts = filename.split("_");
        
        // Common filename patterns:
        // Pattern 1: 2025-08-21_01-51-11_Ha_-9.90_600.00s_0072_c
        if (parts.length >= 4) {
          var potentialFilter = parts[2]; // 3rd component (0-indexed)
          if (potentialFilter) {
            if (potentialFilter.toLowerCase().indexOf("ha") >= 0) {
              filter = "Ha";
            } else if (potentialFilter.toLowerCase().indexOf("oiii") >= 0 || potentialFilter.toLowerCase().indexOf("o3") >= 0) {
              filter = "OIII";
            } else if (potentialFilter.toLowerCase().indexOf("sii") >= 0 || potentialFilter.toLowerCase().indexOf("s2") >= 0) {
              filter = "SII";
            } else if (potentialFilter.toLowerCase().indexOf("lum") >= 0) {
              filter = "Luminance";
            } else if (potentialFilter.toLowerCase() === "r" || potentialFilter.toLowerCase() === "red") {
              filter = "Red";
            } else if (potentialFilter.toLowerCase() === "g" || potentialFilter.toLowerCase() === "green") {
              filter = "Green";
            } else if (potentialFilter.toLowerCase() === "b" || potentialFilter.toLowerCase() === "blue") {
              filter = "Blue";
            } else {
              // Use the component as-is if it looks like a filter
              filter = potentialFilter;
            }
            console.writeln("Extracted filter from filename: " + filter);
          }
        }
      }
      
      var expStr = readKeyword( ff, "EXPTIME" ) || readKeyword( ff, "EXPOSURE" );
      var binStr = readKeyword( ff, "XBINNING" ) || readKeyword( ff, "XBinning" );
      var gainStr = readKeyword( ff, "GAIN" );
      var chipTempStr = readKeyword( ff, "CCD-TEMP" ) || readKeyword( ff, "SET-TEMP" );
      var fnumStr = readKeyword( ff, "FOCRATIO" ) || readKeyword( ff, "FOC RATIO" );
      
      // Extract ambient temperature for this specific image
      var ambTempStr = readKeyword( ff, "AMBTEMP" ) || readKeyword( ff, "AMBIENTTEMP" );
      
      // Extract global parameters from first LIGHT image
      if (Object.keys(globalData).length === 0) {
        var ambTempStr = readKeyword( ff, "AMBTEMP" ) || readKeyword( ff, "AMBIENTTEMP" );
        var focalLenStr = readKeyword( ff, "FOCALLEN" );
        var telescopeStr = readKeyword( ff, "TELESCOP" );
        var instrumentStr = readKeyword( ff, "INSTRUME" );
        var siteLatStr = readKeyword( ff, "SITELAT" );
        var siteLongStr = readKeyword( ff, "SITELONG" );
        var siteElevStr = readKeyword( ff, "SITEELEV" );
        
        // Try to extract seeing/quality information
        var sqmStr = readKeyword( ff, "SQM" ) || readKeyword( ff, "SKYMAG" );
        var skyBrightnessStr = readKeyword( ff, "SKYBRGHT" ) || readKeyword( ff, "SKY-BRGHT" ) || readKeyword( ff, "SKYLUX" );
        var fwhmStr = readKeyword( ff, "FWHM" ) || readKeyword( ff, "SEEING" );
        var bortleStr = readKeyword( ff, "BORTLE" ) || readKeyword( ff, "LIGHTPOL" );
        var skyTempStr = readKeyword( ff, "SKYTEMP" ) || readKeyword( ff, "SKY-TEMP" );
        var humidityStr = readKeyword( ff, "HUMIDITY" );
        var pressureStr = readKeyword( ff, "PRESSURE" );
        var dewPointStr = readKeyword( ff, "DEWPOINT" );
        var windSpeedStr = readKeyword( ff, "WINDSPD" );
        var windDirStr = readKeyword( ff, "WINDDIR" );
        
        // Store for later use - use FITS data when available
        if (ambTempStr) globalData.ambientTemp = parseFloat(ambTempStr);
        if (focalLenStr) globalData.focalLength = parseFloat(focalLenStr);
        if (telescopeStr) globalData.telescope = telescopeStr;
        if (instrumentStr) globalData.instrument = instrumentStr;
        if (siteLatStr) globalData.siteLatitude = parseFloat(siteLatStr);
        if (siteLongStr) globalData.siteLongitude = parseFloat(siteLongStr);
        if (siteElevStr) globalData.siteElevation = parseFloat(siteElevStr);
        
        // Handle SQM calculation - priority: direct SQM > lux conversion > Bortle estimation
        if (sqmStr) {
           globalData.meanSqm = parseFloat(sqmStr);
        } else if (skyBrightnessStr) {
           // Convert from lux to mag/arcsec²
           // Formula: SQM = -2.5 * log10(lux) + 25.2 
           // This converts linear lux scale to logarithmic magnitude scale
           // Note: 25.2 is an approximation - exact calibration varies by instrument
           var luxValue = parseFloat(skyBrightnessStr);
           if (luxValue > 0) {
              globalData.meanSqm = -2.5 * Math.log10(luxValue) + 25.2;
              console.writeln("Converted sky brightness " + luxValue + " lux to SQM: " + globalData.meanSqm.toFixed(2) + " mag/arcsec²");
           }
        } else if (bortleStr) {
           // Estimate SQM from Bortle scale as fallback
           var bortleValue = parseFloat(bortleStr);
           if (bortleValue >= 1 && bortleValue <= 9) {
              globalData.meanSqm = bortleToSQM(bortleValue);
              globalData.bortle = bortleValue;
              console.writeln("Estimated SQM " + globalData.meanSqm.toFixed(2) + " mag/arcsec² from Bortle Class " + bortleValue);
           }
        }
        
        if (fwhmStr) globalData.meanFwhm = parseFloat(fwhmStr);
        if (bortleStr && !globalData.bortle) globalData.bortle = parseFloat(bortleStr);
        if (skyTempStr) globalData.skyTemp = parseFloat(skyTempStr);
        if (humidityStr) globalData.humidity = parseFloat(humidityStr);
        if (pressureStr) globalData.pressure = parseFloat(pressureStr);
        if (dewPointStr) globalData.dewPoint = parseFloat(dewPointStr);
        if (windSpeedStr) globalData.windSpeed = parseFloat(windSpeedStr);
        if (windDirStr) globalData.windDirection = parseFloat(windDirStr);
        
        // Store calibration counts
        globalData.calibrationCounts = calibrationCounts;
        globalData.availableMetadata = availableMetadata;
      }
      
      ff.close();

      var d = parseDateObs( dateStr );
      var nightKey = "";
      if ( d !== undefined ){
        var nightD = applyNightOffset( d, NIGHT_OFFSET_HOURS );
        nightKey = toLocalDateString( nightD );
      }
      var duration = 0; if ( expStr ) { duration = parseFloat(expStr); }
      var binning = binStr ? parseInt(binStr) : "";
      var gain = gainStr ? parseFloat(gainStr).toFixed(2) : "";
      if (gain && gain.endsWith(".00")) gain = gain.substring(0, gain.length - 3);
      var sensorCooling = chipTempStr ? parseFloat(chipTempStr).toFixed(1) : "";
      var fNumber = fnumStr ? parseFloat(fnumStr).toFixed(2) : "";
      if (fNumber && fNumber.endsWith(".00")) fNumber = fNumber.substring(0, fNumber.length - 3);

      rows.push({
        path:p,
        night:nightKey,
        filter:filter || "(No Filter)",  // Store original FITS filter name
        filterId:"",  // Will be set by user selection or auto-suggestion in GUI
        duration:duration,
        binning:binning,
        gain:gain,
        sensorCooling:sensorCooling,
        fNumber:fNumber,
        ambientTemp: ambTempStr ? parseFloat(ambTempStr) : null  // Store per-image ambient temp
      });
    }catch(e){
      console.warningln( "[WARN] Skipping file due to error: " + p + "\n  " + e );
    }
  }
  
  // Return both rows and global data
  return { rows: rows, globalData: globalData };
}

function groupKey( r ){
  // For sensor cooling, round to nearest 5-degree interval for grouping tolerance
  var tempGroup = "";
  if (r.sensorCooling && r.sensorCooling !== "") {
    var temp = parseFloat(r.sensorCooling);
    if (!isNaN(temp)) {
      // Round to nearest 5-degree interval (e.g., -15, -10, -5, 0, 5, etc.)
      tempGroup = (Math.round(temp / 5) * 5).toString();
    } else {
      tempGroup = r.sensorCooling;
    }
  }
  
  return [r.night, r.filter, r.duration, r.binning, r.gain, tempGroup, r.fNumber].join("\u0001");
}

function aggregate( rows, globalData ){
  var map = {};
  for ( var i=0; i<rows.length; i++ ){
    var r = rows[i];
    var key = groupKey( r );
    if ( !map[key] ){
      map[key] = {
        date: r.night || "",
        filter: r.filter || "(No Filter)",  // Add original filter name
        filterId: r.filterId || "",
        number: 0,
        duration: r.duration || "",
        binning: r.binning || "",
        gain: r.gain || "",
        sensorCooling: r.sensorCooling || "",
        sensorCoolingForCSV: r.sensorCooling || "",  // Store original temp for CSV export
        fNumber: r.fNumber || "",
        // Use detected calibration counts if available, otherwise fall back to CONFIG
        darks: globalData && globalData.calibrationCounts ? globalData.calibrationCounts.darks : CONFIG.darks,
        flats: globalData && globalData.calibrationCounts ? globalData.calibrationCounts.flats : CONFIG.flats,
        flatDarks: globalData && globalData.calibrationCounts ? globalData.calibrationCounts.flatDarks : CONFIG.flatDarks,
        bias: globalData && globalData.calibrationCounts ? globalData.calibrationCounts.bias : CONFIG.bias,
        // Use FITS metadata when available, otherwise fall back to CONFIG
        bortle: globalData && globalData.bortle ? globalData.bortle : CONFIG.bortle,
        meanSqm: globalData && globalData.meanSqm ? globalData.meanSqm : CONFIG.meanSqm,
        meanFwhm: globalData && globalData.meanFwhm ? globalData.meanFwhm : CONFIG.meanFwhm,
        // Track temperature range for display - both sensor and ambient
        minTemp: parseFloat(r.sensorCooling) || 0,
        maxTemp: parseFloat(r.sensorCooling) || 0,
        tempSum: parseFloat(r.sensorCooling) || 0,
        tempCount: 0,
        // Track ambient temperature for session averaging
        ambientTempSum: 0,
        ambientTempCount: 0,
        ambientTemp: ""  // Will be calculated as average
      };
    }
    
    // Update temperature range tracking for sensor cooling
    if (r.sensorCooling && r.sensorCooling !== "") {
      var temp = parseFloat(r.sensorCooling);
      if (!isNaN(temp)) {
        map[key].minTemp = Math.min(map[key].minTemp, temp);
        map[key].maxTemp = Math.max(map[key].maxTemp, temp);
        map[key].tempSum += temp;
        map[key].tempCount++;
      }
    }
    
    // Update ambient temperature tracking
    if (r.ambientTemp !== null && r.ambientTemp !== undefined && !isNaN(r.ambientTemp)) {
      map[key].ambientTempSum += r.ambientTemp;
      map[key].ambientTempCount++;
    }
    
    map[key].number++;
  }
  
  // Post-process to format sensor cooling display
  var out = [];
  for ( var k in map ) {
    if ( map.hasOwnProperty(k) ) {
      var item = map[k];
      
      // Format sensor cooling display for GUI (shows range)
      if (item.tempCount > 0) {
        if (item.minTemp === item.maxTemp) {
          item.sensorCooling = item.minTemp.toFixed(1);
          item.sensorCoolingForCSV = item.minTemp.toFixed(1);
        } else {
          item.sensorCooling = item.minTemp.toFixed(1) + " to " + item.maxTemp.toFixed(1);
          // For CSV, use average temperature
          var avgTemp = item.tempSum / item.tempCount;
          item.sensorCoolingForCSV = avgTemp.toFixed(1);
        }
      }
      
      // Calculate session ambient temperature - use FITS average if available, otherwise CONFIG
      if (item.ambientTempCount > 0) {
        var avgAmbientTemp = item.ambientTempSum / item.ambientTempCount;
        item.temperature = avgAmbientTemp.toFixed(1);
      } else {
        // Fall back to global CONFIG value
        item.temperature = CONFIG.ambientTemp || "";
      }
      
      // Clean up temporary properties
      delete item.minTemp;
      delete item.maxTemp;
      delete item.tempSum;
      delete item.tempCount;
      delete item.ambientTempSum;
      delete item.ambientTempCount;
      
      out.push(item);
    }
  }
  
  out.sort( function(a,b){
    if ( a.date < b.date ) return -1; if ( a.date > b.date ) return 1;
    if ( a.filter < b.filter ) return -1; if ( a.filter > b.filter ) return 1;
    if ( a.duration < b.duration ) return -1; if ( a.duration > b.duration ) return 1;
    return 0;
  });
  return out;
}
