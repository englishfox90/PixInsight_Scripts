/*
 * AstroBin CSV Export - Filter Management
 * Filter CSV reading and resolution logic
 */

// Built-in filter aliases for common naming patterns
var BUILTIN_FILTER_ALIASES = [
  { pat:/^ha$|h-?alpha|^h\s*a$/i, aliases:["Ha","H-alpha","3nm Narrowband H-alpha","7nm Narrowband H-alpha"] },
  { pat:/^oiii?$|o-?iii|^o3$/i,   aliases:["OIII","O3","3nm Narrowband Oxygen III","7nm Narrowband Oxygen III"] },
  { pat:/^sii?$|s-?ii|^s2$/i,     aliases:["SII","S2","3nm Narrowband Sulfur II","7nm Narrowband Sulfur II"] },
  { pat:/^l$|luminance/i,         aliases:["L","Luminance","UV/IR Cut","Clear"] },
  { pat:/^r$|red/i,               aliases:["R","Red"] },
  { pat:/^g$|green/i,             aliases:["G","Green"] },
  { pat:/^b$|blue/i,              aliases:["B","Blue"] },
  { pat:/duo|tri|nbz|lp(ro)?/i,   aliases:["Dual/Triband","Duo-Band","L-eXtreme","L-eNhance"] }
];

// Enhanced CSV reader with proper quote handling
function readFiltersCsv( path ){
  var map = {};
  if ( !path || path.length === 0 ) {
    Console.warningln("Filter CSV path is empty");
    return map;
  }
  
  Console.writeln("Checking filter CSV at: " + path);
  Console.writeln("File exists check result: " + File.exists( path ));
  
  if ( !File.exists( path ) ) {
    Console.warningln("Filter CSV file not found: " + path);
    return map;
  }
  
  // Use the original path
  var workingPath = path;
  Console.writeln("Using working path: " + workingPath);
  
  try {
    // Use PixInsight's built-in File.readLines method
    Console.writeln("Reading CSV lines...");
    var lines = File.readLines( workingPath, ReadTextOptions_RemoveEmptyLines | ReadTextOptions_TrimLines );
    Console.writeln("Read " + lines.length + " lines from CSV");
    
    if ( lines.length < 2 ) {
      Console.warningln("CSV file has insufficient data (less than 2 lines)");
      return map;
    }
    
    var header = lines[0];
    var cols = header.split(',');
    
    // Clean column headers
    for (var i = 0; i < cols.length; i++) {
      cols[i] = cols[i].trim().replace(/"/g, '');
    }
    
    var idxId = -1, idxName = -1;
    for ( var j = 0; j < cols.length; j++ ){
      var c = cols[j].toLowerCase();
      if ( c === "id" && idxId < 0 ) idxId = j;
      if ( c === "name" && idxName < 0 ) idxName = j;
    }
    
    if ( idxId < 0 || idxName < 0 ){
      // Default to expected structure: id, brand, name
      idxId = 0; 
      idxName = 2;
    }
    
    Console.writeln("Using column indices - ID: " + idxId + ", Name: " + idxName);
    
    // Process data lines
    for ( var lineIdx = 1; lineIdx < lines.length; lineIdx++ ) {
      var line = lines[lineIdx];
      if ( line.trim().length === 0 ) continue;
      
      var parts = line.split(',');
      
      // Clean parts
      for (var k = 0; k < parts.length; k++) {
        parts[k] = parts[k].trim().replace(/"/g, '');
      }
      
      if ( parts.length <= Math.max(idxId, idxName) ) continue;
      
      var id = parts[idxId];
      var name = parts[idxName];
      if ( id && name ) {
        // Clean the name and create mapping
        var cleanName = name.toLowerCase().trim();
        map[cleanName] = id;
        
        // Also create common abbreviations
        if (cleanName.indexOf("narrowband") >= 0) {
          var simpleName = cleanName.replace("narrowband", "").trim();
          if (simpleName !== cleanName) {
            map[simpleName] = id;
          }
        }
        
        // Handle common filter variations
        if (cleanName.indexOf("nm") >= 0) {
          var nmRemoved = cleanName.replace("nm", "").trim();
          if (nmRemoved !== cleanName) {
            map[nmRemoved] = id;
          }
        }
      }
    }
    
    Console.writeln("Created " + Object.keys(map).length + " filter mappings");
    
  } catch(e) {
    Console.warningln("Error reading filters CSV: " + e);
  }
  
  return map;
}

// Enhanced filter resolution with CSV lookup
function resolveFilterId( filterHeader, mapping ){
  if ( !filterHeader ) return "";
  var key = filterHeader.toLowerCase().trim();
  
  // First try direct mapping from CSV
  if ( mapping[key] ) return mapping[key];
  
  // Try built-in aliases
  for ( var i=0; i<BUILTIN_FILTER_ALIASES.length; i++ ){
    if ( BUILTIN_FILTER_ALIASES[i].pat.test( filterHeader ) ){
      var aliases = BUILTIN_FILTER_ALIASES[i].aliases;
      for ( var j=0; j<aliases.length; j++ ){
        var aliasKey = aliases[j].toLowerCase();
        if ( mapping[aliasKey] ) return mapping[aliasKey];
      }
    }
  }
  
  return "";
}
