/*
 * AstroBin CSV Export - Core Utilities
 * File operations, date parsing, and other utility functions
 */

// Configuration constants  
var FILE_EXTS = [".xisf", ".fits", ".fit", ".fts"];
// Night offset for handling midnight crossover in imaging sessions
// -6 means images before 6 AM are considered part of the previous night
// This handles sessions that span midnight (e.g., OIII at 11 PM, Ha at 2 AM = same night)
var NIGHT_OFFSET_HOURS = -6;
var GROUP_BY_ROUND_DATE = false;

// Global configuration
var CONFIG = {
  rootDir: "",
  outputPath: "",
  filtersPath: "",
  includeSubdirs: true,
  darks: "15",
  flats: "20",
  flatDarks: "15", 
  bias: "50",
  bortle: "4",
  meanSqm: "",
  meanFwhm: "",
  ambientTemp: "",
  preferredFilterBrand: "Auto"
};

// Core utility functions
function endsWithAny( s, exts ){
  var sl = s.toLowerCase();
  for ( var i = 0; i < exts.length; i++ )
    if ( sl.endsWith( exts[i] ) )
      return true;
  return false;
}

function listFiles( dirPath, includeSubdirs ){
  var list = [];
  
  // Use PixInsight's searchDirectory function
  try {
    // Search for each file extension
    for (var i = 0; i < FILE_EXTS.length; i++) {
      var pattern = dirPath + "/*" + FILE_EXTS[i];
      var files = searchDirectory(pattern, includeSubdirs);
      list = list.concat(files);
    }
  } catch (e) {
    throw new Error("Error searching directory: " + e);
  }
  
  return list;
}

function readKeyword( ff, keyName ){
  var k = ff.keywords;
  var up = keyName.toUpperCase();
  for ( var i = 0; i < k.length; i++ )
    if ( k[i].name.toUpperCase() === up )
      return k[i].strippedValue;
  return undefined;
}

function parseDateObs( s ){
  if ( !s || s.length === 0 ) return undefined;
  // Simple string replacements instead of regex
  var t = s;
  if (t.toLowerCase().endsWith("z")) {
    t = t.substring(0, t.length - 1);
  }
  t = t.replace(" ", "T");
  
  // Check if date only and add time
  if ( t.length === 10 && t.indexOf("T") === -1 ) t += "T00:00:00";
  
  try {
    var d = new Date( t );
    if ( isNaN( d ) ) return undefined;
    return d;
  } catch( __ ){
    return undefined;
  }
}

function toLocalDateString( d ){
  function pad(n){ return (n<10?"0":"") + n; }
  return d.getFullYear() + "-" + pad(d.getMonth()+1) + "-" + pad(d.getDate());
}

function applyNightOffset( d, hours ){ 
  return new Date( d.getTime() + hours*3600*1000 ); 
}

function openForKeywords( path ){
  var ext = File.extractExtension( path ).toLowerCase();
  var fmtId = ( ext === ".xisf" ) ? "XISF" : "FITS";
  var fmt = new FileFormat( fmtId, false, true );
  if ( fmt.isNull ) throw new Error( "No reader for: " + path );
  var f = new FileFormatInstance( fmt );
  if ( f.isNull ) throw new Error( "Cannot open: " + path );
  if ( !f.open( path, "verbosity 0" ) )
    throw new Error( "Open failed: " + path );
  return f;
}
