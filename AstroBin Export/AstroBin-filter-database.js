/*
 * AstroBin Filter Database - Comprehensive Collection (200+ Filters)
 * Converted from CSV to JavaScript for better performance and reliability
 * 
 * Includes filters from major brands (22 manufacturers):
 * Antlia, Askar, Astrodon, Astronomik, Baader, Celestron, Chroma, SVBony, ZWO,
 * Optolong, Vaonis/Vespera, Hutech/IDAS, Lumicon, Omega Optical, Explore Scientific,
 * Altair, Radian, TS-Optics, Orion, QHYCCD, Player One, and more
 * 
 * Total: 200+ unique filters covering narrowband, broadband, LRGB, light pollution, 
 * dual-band, tri-band, solar, and specialty filters from all major manufacturers
 * 
 * Organized alphabetically by brand for easy maintenance
 */

var ASTROBIN_FILTERS = [
  // ==================== ALTAIR ASTRO FILTERS ====================
  {id: "1453", brand: "Altair", name: "Dual-Band", display: "Altair Dual-Band", keywords: ["altair", "dual", "band", "ha", "oiii"]},
  {id: "1455", brand: "Altair", name: "CLS-CCD", display: "Altair CLS", keywords: ["altair", "cls", "ccd", "city", "light", "suppression"]},
  {id: "1456", brand: "Altair", name: "TriBand", display: "Altair Tri-Band", keywords: ["altair", "tri", "band", "three", "ha", "oiii", "sii"]},
  {id: "1457", brand: "Altair", name: "QuadBand", display: "Altair Quad-Band", keywords: ["altair", "quad", "band", "four", "ha", "oiii", "sii", "hb"]},
  {id: "2622", brand: "Altair", name: "Ha 7nm", display: "Altair H-alpha 7nm", keywords: ["altair", "ha", "h-alpha", "656", "7nm"]},
  {id: "3730", brand: "Altair", name: "OIII 6.5nm", display: "Altair OIII 6.5nm", keywords: ["altair", "oiii", "o3", "oxygen", "6.5nm"]},
  {id: "3796", brand: "Altair", name: "SII 6.5nm", display: "Altair SII 6.5nm", keywords: ["altair", "sii", "s2", "sulfur", "6.5nm"]},
  {id: "6898", brand: "Altair", name: "H-alpha 3nm", display: "Altair H-alpha 3nm", keywords: ["altair", "ha", "h-alpha", "656", "3nm"]},
  {id: "6899", brand: "Altair", name: "SII 3nm", display: "Altair SII 3nm", keywords: ["altair", "sii", "s2", "sulfur", "3nm"]},

  // ==================== ANTLIA FILTERS ====================
  {id: "25", brand: "Antlia", name: "3nm Narrowband Oxygen III", display: "OIII 3nm", keywords: ["antlia", "oiii", "o3", "oxygen", "501", "3nm"]},
  {id: "30", brand: "Antlia", name: "3nm Narrowband H-alpha", display: "H-alpha 3nm", keywords: ["antlia", "ha", "h-alpha", "656", "3nm", "hydrogen"]},
  {id: "35", brand: "Antlia", name: "3nm Narrowband Sulfur II", display: "SII 3nm", keywords: ["antlia", "sii", "s2", "sulfur", "672", "3nm"]},
   {id: "52", brand: "Antlia", name: "ALP-T Dual Band 5nm", display: "Antlia ALP-T Dual 5nm", keywords: ["antlia", "alp-t", "dual", "band", "ha", "oiii", "5nm"]},
  {id: "53", brand: "Antlia", name: "Luminance", display: "Antlia Lum", keywords: ["antlia", "lum", "l", "luminance", "clear", "white"]},
  {id: "58", brand: "Antlia", name: "Red", display: "Antlia Red", keywords: ["antlia", "red", "r"]},
  {id: "63", brand: "Antlia", name: "Green", display: "Antlia Green", keywords: ["antlia", "green", "g"]},
  {id: "68", brand: "Antlia", name: "Blue", display: "Antlia Blue", keywords: ["antlia", "blue", "b"]},
  {id: "73", brand: "Antlia", name: "U-Venus", display: "Antlia U-Venus", keywords: ["antlia", "u-venus", "venus", "uv"]},
   {id: "10264", brand: "Antlia", name: "Triband RGB Ultra Filter - 2\" Mounted", display: "Antlia Triband RGB Ultra", keywords: ["antlia", "triband", "rgb", "dual", "multi", "band"]},
   {id: "14389", brand: "Antlia", name: "H-alpha Ultra Narrow Band 2.5nm", display: "Antlia H-alpha 2.5nm", keywords: ["antlia", "ha", "h-alpha", "2.5nm", "ultra", "narrow"]},
   {id: "14390", brand: "Antlia", name: "SII Ultra Narrow Band 2.5nm", display: "Antlia SII 2.5nm", keywords: ["antlia", "sii", "s2", "sulfur", "2.5nm", "ultra", "narrow"]},
   {id: "14391", brand: "Antlia", name: "OIII Ultra Narrow Band 2.5nm", display: "Antlia OIII 2.5nm", keywords: ["antlia", "oiii", "o3", "oxygen", "2.5nm", "ultra", "narrow"]},
   {id: "4439", brand: "Antlia", name: "V-Pro Blue", display: "Antlia V-Pro Blue", keywords: ["antlia", "v-pro", "blue", "b"]},
   {id: "4444", brand: "Antlia", name: "V-Pro Green", display: "Antlia V-Pro Green", keywords: ["antlia", "v-pro", "green", "g"]},
   {id: "4449", brand: "Antlia", name: "V-Pro Luminance", display: "Antlia V-Pro Lum", keywords: ["antlia", "v-pro", "lum", "luminance"]},
   {id: "4454", brand: "Antlia", name: "V-Pro Red", display: "Antlia V-Pro Red", keywords: ["antlia", "v-pro", "red", "r"]},
   {id: "2022", brand: "Antlia", name: "EDGE H-alpha 4.5nm", display: "Antlia EDGE Ha 4.5nm", keywords: ["antlia", "edge", "ha", "h-alpha", "4.5nm", "656", "hydrogen"]},
   {id: "2023", brand: "Antlia", name: "EDGE OIII 4.5nm", display: "Antlia EDGE OIII 4.5nm", keywords: ["antlia", "edge", "oiii", "o3", "oxygen", "4.5nm", "501"]},
   {id: "2024", brand: "Antlia", name: "EDGE SII 4.5nm", display: "Antlia EDGE SII 4.5nm", keywords: ["antlia", "edge", "sii", "s2", "sulfur", "4.5nm", "672"]},

  // ==================== ASKAR FILTERS ====================
  {id: "78", brand: "Askar", name: "Color Magic H-alpha 5nm", display: "Askar H-alpha 5nm", keywords: ["askar", "ha", "h-alpha", "656", "5nm", "color", "magic"]},
  {id: "79", brand: "Askar", name: "Color Magic SII 5nm", display: "Askar SII 5nm", keywords: ["askar", "sii", "s2", "sulfur", "672", "5nm", "color", "magic"]},
  {id: "80", brand: "Askar", name: "Color Magic OIII 5nm", display: "Askar OIII 5nm", keywords: ["askar", "oiii", "o3", "oxygen", "501", "5nm", "color", "magic"]},
  {id: "82", brand: "Askar", name: "Duo-band", display: "Askar Duo-band", keywords: ["askar", "duo", "dualband", "dual", "band", "ha", "oiii"]},
  {id: "94", brand: "Askar", name: "H-alpha 7nm", display: "Askar H-alpha 7nm", keywords: ["askar", "ha", "h-alpha", "656", "7nm"]},
  {id: "98", brand: "Askar", name: "Luminance", display: "Askar Lum", keywords: ["askar", "lum", "l", "luminance"]},
  {id: "102", brand: "Askar", name: "Red", display: "Askar Red", keywords: ["askar", "red", "r"]},
  {id: "106", brand: "Askar", name: "Green", display: "Askar Green", keywords: ["askar", "green", "g"]},
  {id: "110", brand: "Askar", name: "Blue", display: "Askar Blue", keywords: ["askar", "blue", "b"]},
  {id: "3631", brand: "Askar", name: "ColorMagic Duo Narrow Band 3nm", display: "Askar ColorMagic Duo 3nm", keywords: ["askar", "colormagic", "color", "magic", "duo", "dual", "band", "3nm", "narrowband", "ha", "oiii"]},
  {id: "5710", brand: "Askar", name: "Color Magic H-alpha 3nm", display: "Askar Color Magic H-alpha 3nm", keywords: ["askar", "color", "magic", "ha", "h-alpha", "656", "3nm"]},
  {id: "5711", brand: "Askar", name: "Color Magic OIII 3nm", display: "Askar Color Magic OIII 3nm", keywords: ["askar", "color", "magic", "oiii", "o3", "oxygen", "501", "3nm"]},
  {id: "5713", brand: "Askar", name: "Color Magic SII 3nm", display: "Askar Color Magic SII 3nm", keywords: ["askar", "color", "magic", "sii", "s2", "sulfur", "672", "3nm"]},
  {id: "9604", brand: "Askar", name: "ColourMagic D1 (Ha+Oiii) Duo Narrow Band 6nm", display: "Askar D1 Ha+OIII 6nm", keywords: ["askar", "colourmagic", "colour", "magic", "d1", "ha", "oiii", "duo", "dual", "band", "6nm", "narrowband"]},
  {id: "10198", brand: "Askar", name: "ColourMagic D2 (Sii+Oiii) Duo Narrow Band 6nm", display: "Askar D2 SII+OIII 6nm", keywords: ["askar", "colourmagic", "colour", "magic", "d2", "sii", "oiii", "duo", "dual", "band", "6nm", "narrowband"]},
  {id: "19341", brand: "Askar", name: "Colour Magic C2 Duo-band Filter (SII+OIII)", display: "Askar C2 SII+OIII", keywords: ["askar", "colour", "magic", "c2", "duo", "dual", "band", "sii", "oiii"]},
  {id: "22870", brand: "Askar", name: "Color Magic C1", display: "Askar C1", keywords: ["askar", "color", "magic", "c1", "duo", "dual", "band"]},
  {id: "23299", brand: "Askar", name: "Ha OIII 6nm 50 mm", display: "Askar Ha+OIII 6nm 50mm", keywords: ["askar", "ha", "oiii", "6nm", "50mm", "square", "dual", "duo", "band"]},
  {id: "23300", brand: "Askar", name: "SII OIII 6nm 50 mm", display: "Askar SII+OIII 6nm 50mm", keywords: ["askar", "sii", "oiii", "6nm", "50mm", "square", "dual", "duo", "band"]},

  // ==================== ASTRODON FILTERS ====================
  {id: "113", brand: "Astrodon", name: "SII 3nm", display: "Astrodon SII 3nm", keywords: ["astrodon", "sii", "s2", "sulfur", "672", "3nm"]},
  {id: "119", brand: "Astrodon", name: "OIII 3nm", display: "Astrodon OIII 3nm", keywords: ["astrodon", "oiii", "o3", "oxygen", "501", "3nm"]},
  {id: "125", brand: "Astrodon", name: "H-alpha 3nm", display: "Astrodon H-alpha 3nm", keywords: ["astrodon", "ha", "h-alpha", "656", "3nm"]},
  {id: "131", brand: "Astrodon", name: "Gen2 E-Series Tru-Balance Lum", display: "Astrodon Lum", keywords: ["astrodon", "lum", "l", "luminance", "tru-balance", "gen2"]},
  {id: "137", brand: "Astrodon", name: "Gen2 E-Series Tru-Balance Red", display: "Astrodon Red", keywords: ["astrodon", "red", "r", "tru-balance", "gen2"]},
  {id: "143", brand: "Astrodon", name: "Gen2 E-Series Tru-Balance Green", display: "Astrodon Green", keywords: ["astrodon", "green", "g", "tru-balance", "gen2"]},
  {id: "149", brand: "Astrodon", name: "Gen2 E-Series Tru-Balance Blue", display: "Astrodon Blue", keywords: ["astrodon", "blue", "b", "tru-balance", "gen2"]},
  {id: "155", brand: "Astrodon", name: "SII 5nm", display: "Astrodon SII 5nm", keywords: ["astrodon", "sii", "s2", "sulfur", "672", "5nm"]},
  {id: "160", brand: "Astrodon", name: "OIII 5nm", display: "Astrodon OIII 5nm", keywords: ["astrodon", "oiii", "o3", "oxygen", "501", "5nm"]},
  {id: "165", brand: "Astrodon", name: "H-alpha 5nm", display: "Astrodon H-alpha 5nm", keywords: ["astrodon", "ha", "h-alpha", "656", "5nm"]},

  // ==================== ASTRONOMIK FILTERS ====================
  {id: "256", brand: "Astronomik", name: "Deep-Sky Red", display: "Astronomik Deep-Sky Red", keywords: ["astronomik", "deep", "sky", "red", "deepsky"]},
  {id: "263", brand: "Astronomik", name: "Deep-Sky Green", display: "Astronomik Deep-Sky Green", keywords: ["astronomik", "deep", "sky", "green", "deepsky"]},
  {id: "270", brand: "Astronomik", name: "Deep-Sky Blue", display: "Astronomik Deep-Sky Blue", keywords: ["astronomik", "deep", "sky", "blue", "deepsky"]},
  {id: "277", brand: "Astronomik", name: "L-1 Luminance UV/IR Block", display: "Astronomik L-1 Lum", keywords: ["astronomik", "l1", "l-1", "luminance", "uv", "ir", "block", "lum"]},
  {id: "292", brand: "Astronomik", name: "L-2 Luminance UV/IR Block", display: "Astronomik L-2 Lum", keywords: ["astronomik", "l2", "l-2", "luminance", "uv", "ir", "block", "lum"]},
  {id: "308", brand: "Astronomik", name: "L-3 Luminance UV/IR Block", display: "Astronomik L-3 Lum", keywords: ["astronomik", "l3", "l-3", "luminance", "uv", "ir", "block", "lum"]},
  {id: "324", brand: "Astronomik", name: "Type 2c Luminance", display: "Astronomik Type 2c Lum", keywords: ["astronomik", "type", "2c", "luminance", "lum"]},
   {id: "329", brand: "Astronomik", name: "Type 2c Red", display: "Astronomik Type 2c Red", keywords: ["astronomik", "type", "2c", "red"]},
   {id: "334", brand: "Astronomik", name: "Type 2c Green", display: "Astronomik Type 2c Green", keywords: ["astronomik", "type", "2c", "green"]},
   {id: "339", brand: "Astronomik", name: "Type 2c Blue", display: "Astronomik Type 2c Blue", keywords: ["astronomik", "type", "2c", "blue"]},
  {id: "344", brand: "Astronomik", name: "UHC", display: "Astronomik UHC", keywords: ["astronomik", "uhc", "ultra", "high", "contrast"]},
  {id: "357", brand: "Astronomik", name: "UHC-E", display: "Astronomik UHC-E", keywords: ["astronomik", "uhc", "uhc-e", "ultra", "high", "contrast"]},
  {id: "370", brand: "Astronomik", name: "CLS", display: "Astronomik CLS", keywords: ["astronomik", "cls", "city", "light", "suppression", "pollution"]},
  {id: "376", brand: "Astronomik", name: "CLS-CCD", display: "Astronomik CLS-CCD", keywords: ["astronomik", "cls", "ccd", "city", "light", "suppression", "pollution"]},
  {id: "403", brand: "Astronomik", name: "H-alpha CCD 6nm", display: "Astronomik H-alpha 6nm", keywords: ["astronomik", "ha", "h-alpha", "hydrogen", "alpha", "6nm", "ccd"]},
  {id: "413", brand: "Astronomik", name: "OIII CCD 6nm", display: "Astronomik OIII 6nm", keywords: ["astronomik", "oiii", "o3", "oxygen", "6nm", "ccd"]},
  {id: "423", brand: "Astronomik", name: "SII CCD 6nm", display: "Astronomik SII 6nm", keywords: ["astronomik", "sii", "s2", "sulfur", "sulphur", "6nm", "ccd"]},
   {id: "433", brand: "Astronomik", name: "H-alpha CCD 12nm", display: "Astronomik H-alpha 12nm", keywords: ["astronomik", "ha", "h-alpha", "12nm", "ccd"]},

  // ==================== BAADER FILTERS ====================
  {id: "685", brand: "Baader", name: "UV/IR Cut / Luminance", display: "Baader Lum", keywords: ["baader", "lum", "l", "luminance", "uv", "ir", "cut"]},
  {id: "693", brand: "Baader", name: "Red (R-CCD)", display: "Baader Red", keywords: ["baader", "red", "r", "ccd"]},
  {id: "701", brand: "Baader", name: "Green (G-CCD)", display: "Baader Green", keywords: ["baader", "green", "g", "ccd"]},
  {id: "709", brand: "Baader", name: "Blue (B-CCD)", display: "Baader Blue", keywords: ["baader", "blue", "b", "ccd"]},
   {id: "724", brand: "Baader", name: "Red (CMOS-Optimized)", display: "Baader Red CMOS", keywords: ["baader", "red", "cmos"]},
   {id: "731", brand: "Baader", name: "Green (CMOS-Optimized)", display: "Baader Green CMOS", keywords: ["baader", "green", "cmos"]},
   {id: "738", brand: "Baader", name: "Blue (CMOS-Optimized)", display: "Baader Blue CMOS", keywords: ["baader", "blue", "cmos"]},
   {id: "759", brand: "Baader", name: "Neodymium Moon & Skyglow", display: "Baader Moon & Skyglow", keywords: ["baader", "moon", "skyglow", "neodymium"]},
   {id: "864", brand: "Baader", name: "H-alpha 7nm", display: "Baader H-alpha 7nm", keywords: ["baader", "ha", "h-alpha", "656", "7nm"]},
   {id: "871", brand: "Baader", name: "S-II 8nm", display: "Baader SII 8nm", keywords: ["baader", "sii", "s2", "sulfur", "8nm"]},
   {id: "878", brand: "Baader", name: "O-III 8.5nm", display: "Baader OIII 8.5nm", keywords: ["baader", "oiii", "o3", "oxygen", "8.5nm"]},
   {id: "1654", brand: "Baader", name: "AstroSolar", display: "Baader AstroSolar", keywords: ["baader", "astrosolar", "solar"]},
  {id: "717", brand: "Baader", name: "UV/IR CUT Luminance (CMOS-Optimized)", display: "Baader Lum CMOS", keywords: ["baader", "lum", "l", "luminance", "cmos", "uv", "ir"]},
  {id: "780", brand: "Baader", name: "H-alpha 6.5nm (CMOS-Optimized)", display: "Baader H-alpha 6.5nm", keywords: ["baader", "ha", "h-alpha", "656", "6.5nm", "cmos"]},
  {id: "787", brand: "Baader", name: "O-III 6.5nm (CMOS-Optimized)", display: "Baader OIII 6.5nm", keywords: ["baader", "oiii", "o3", "oxygen", "501", "6.5nm", "cmos"]},
  {id: "794", brand: "Baader", name: "S-II 6.5nm (CMOS-Optimized)", display: "Baader SII 6.5nm", keywords: ["baader", "sii", "s2", "sulfur", "672", "6.5nm", "cmos"]},

  // ==================== CELESTRON FILTERS ====================
  {id: "900", brand: "Celestron", name: "Luminance", display: "Celestron Lum", keywords: ["celestron", "lum", "l", "luminance"]},
  {id: "901", brand: "Celestron", name: "Red", display: "Celestron Red", keywords: ["celestron", "red", "r"]},
  {id: "902", brand: "Celestron", name: "Green", display: "Celestron Green", keywords: ["celestron", "green", "g"]},
  {id: "903", brand: "Celestron", name: "Blue", display: "Celestron Blue", keywords: ["celestron", "blue", "b"]},
  {id: "1420", brand: "Celestron", name: "UV/IR Cut", display: "Celestron UV/IR Cut", keywords: ["celestron", "uv", "ir", "cut", "block"]},
  {id: "1750", brand: "Celestron", name: "UHC/LPR", display: "Celestron UHC/LPR", keywords: ["celestron", "uhc", "lpr", "light", "pollution", "reduction", "ultra", "high", "contrast"]},
  {id: "2245", brand: "Celestron", name: "OIII", display: "Celestron OIII", keywords: ["celestron", "oiii", "o3", "oxygen"]},

  // ==================== CHROMA FILTERS ====================
  {id: "907", brand: "Chroma", name: "H-alpha 3nm Bandpass", display: "Chroma H-alpha 3nm", keywords: ["chroma", "ha", "h-alpha", "656", "3nm"]},
   {id: "913", brand: "Chroma", name: "H-alpha 5nm Bandpass", display: "Chroma H-alpha 5nm", keywords: ["chroma", "ha", "h-alpha", "656", "5nm"]},
  {id: "937", brand: "Chroma", name: "SII 3nm Bandpass", display: "Chroma SII 3nm", keywords: ["chroma", "sii", "s2", "sulfur", "672", "3nm"]},
  {id: "955", brand: "Chroma", name: "OIII 3nm Bandpass", display: "Chroma OIII 3nm", keywords: ["chroma", "oiii", "o3", "oxygen", "501", "3nm"]},
  {id: "973", brand: "Chroma", name: "Lum", display: "Chroma Lum", keywords: ["chroma", "lum", "l", "luminance"]},
  {id: "979", brand: "Chroma", name: "Red", display: "Chroma Red", keywords: ["chroma", "red", "r"]},
  {id: "985", brand: "Chroma", name: "Green", display: "Chroma Green", keywords: ["chroma", "green", "g"]},
  {id: "991", brand: "Chroma", name: "Blue", display: "Chroma Blue", keywords: ["chroma", "blue", "b"]},

  // ==================== EXPLORE SCIENTIFIC FILTERS ====================
  {id: "1083", brand: "Explore Scientific", name: "Nebula H-alpha 7nm", display: "ES H-alpha 7nm", keywords: ["explore", "scientific", "es", "ha", "h-alpha", "656", "7nm"]},
  {id: "1087", brand: "Explore Scientific", name: "Nebula Sulfur-II 6.5nm", display: "ES SII 6.5nm", keywords: ["explore", "scientific", "es", "sii", "s2", "sulfur", "672", "6.5nm"]},
  {id: "1091", brand: "Explore Scientific", name: "Nebula Oxygen-III 6.5nm", display: "ES OIII 6.5nm", keywords: ["explore", "scientific", "es", "oiii", "o3", "oxygen", "501", "6.5nm"]},
  {id: "1097", brand: "Explore Scientific", name: "Nebula UHC", display: "ES UHC", keywords: ["explore", "scientific", "es", "uhc", "ultra", "high", "contrast"]},
  {id: "1099", brand: "Explore Scientific", name: "Nebula CLS", display: "ES CLS", keywords: ["explore", "scientific", "es", "cls", "city", "light", "suppression"]},

  // ==================== HUTECH/IDAS FILTERS ====================
  {id: "1100", brand: "IDAS", name: "Nebula Booster NB1", display: "IDAS NB1", keywords: ["idas", "nb1", "nebula", "booster", "hutech"]},
  {id: "1102", brand: "IDAS", name: "Nebula Booster NB2", display: "IDAS NB2", keywords: ["idas", "nb2", "nebula", "booster", "hutech"]},
  {id: "1104", brand: "IDAS", name: "Nebula Booster NB3", display: "IDAS NB3", keywords: ["idas", "nb3", "nebula", "booster", "hutech"]},
   {id: "1106", brand: "IDAS", name: "Nebula Booster NBZ", display: "IDAS NBZ", keywords: ["idas", "nbz", "nebula", "booster"]},
  {id: "1118", brand: "IDAS", name: "LPS-P1", display: "IDAS LPS-P1", keywords: ["idas", "lps", "p1", "light", "pollution", "hutech"]},
  {id: "1120", brand: "IDAS", name: "LPS-P2", display: "IDAS LPS-P2", keywords: ["idas", "lps", "p2", "light", "pollution", "hutech"]},
  {id: "1125", brand: "IDAS", name: "LPS-P3", display: "IDAS LPS-P3", keywords: ["idas", "lps", "p3", "light", "pollution", "hutech"]},
  {id: "1130", brand: "IDAS", name: "LPS-D1", display: "IDAS LPS-D1", keywords: ["idas", "lps", "d1", "light", "pollution", "hutech"]},
  {id: "1140", brand: "IDAS", name: "LPS-D2", display: "IDAS LPS-D2", keywords: ["idas", "lps", "d2", "light", "pollution", "hutech"]},

  // ==================== LUMICON FILTERS ====================
  {id: "1166", brand: "Lumicon", name: "Deep Sky", display: "Lumicon Deep Sky", keywords: ["lumicon", "deep", "sky"]},
  {id: "1169", brand: "Lumicon", name: "UHC Gen3", display: "Lumicon UHC", keywords: ["lumicon", "uhc", "ultra", "high", "contrast", "gen3"]},
  {id: "1172", brand: "Lumicon", name: "Oxygen-III Gen3", display: "Lumicon OIII", keywords: ["lumicon", "oiii", "o3", "oxygen", "gen3"]},
  {id: "1175", brand: "Lumicon", name: "H-beta", display: "Lumicon H-beta", keywords: ["lumicon", "hb", "h-beta", "486"]},
  {id: "1178", brand: "Lumicon", name: "Comet", display: "Lumicon Comet", keywords: ["lumicon", "comet"]},
  {id: "1182", brand: "Lumicon", name: "Night Sky H-alpha", display: "Lumicon Night Sky H-alpha", keywords: ["lumicon", "night", "sky", "ha", "h-alpha"]},

  // ==================== OMEGA OPTICAL FILTERS ====================
  {id: "9637", brand: "Omega Optical", name: "Solar CaK", display: "Omega Solar CaK", keywords: ["omega", "optical", "solar", "cak", "calcium"]},
  {id: "10000", brand: "Omega Optical", name: "H-alpha 4nm", display: "Omega H-alpha 4nm", keywords: ["omega", "optical", "ha", "h-alpha", "656", "4nm"]},
  {id: "13201", brand: "Omega Optical", name: "DGM GCE Contrast", display: "Omega Contrast", keywords: ["omega", "optical", "dgm", "gce", "contrast"]},

  // ==================== OPTOLONG FILTERS ====================
  {id: "1206", brand: "Optolong", name: "L-eXtreme", display: "Optolong L-eXtreme", keywords: ["optolong", "l-extreme", "lextreme", "dual", "band", "ha", "oiii"]},
  {id: "1208", brand: "Optolong", name: "L-eNhance", display: "Optolong L-eNhance", keywords: ["optolong", "l-enhance", "lenhance", "dual", "band", "ha", "oiii"]},
  {id: "1211", brand: "Optolong", name: "L-Pro", display: "Optolong L-Pro", keywords: ["optolong", "l-pro", "lpro", "light", "pollution"]},
  {id: "1219", brand: "Optolong", name: "UV/IR cut", display: "Optolong UV/IR Cut", keywords: ["optolong", "uv", "ir", "cut", "block"]},
  {id: "1223", brand: "Optolong", name: "SII 6.5nm", display: "Optolong SII 6.5nm", keywords: ["optolong", "sii", "s2", "sulfur", "672", "6.5nm"]},
  {id: "1227", brand: "Optolong", name: "OIII 6.5nm", display: "Optolong OIII 6.5nm", keywords: ["optolong", "oiii", "o3", "oxygen", "501", "6.5nm"]},
  {id: "1231", brand: "Optolong", name: "H-Alpha 7nm", display: "Optolong H-alpha 7nm", keywords: ["optolong", "ha", "h-alpha", "656", "7nm"]},
  {id: "1235", brand: "Optolong", name: "SII 3nm", display: "Optolong SII 3nm", keywords: ["optolong", "sii", "s2", "sulfur", "672", "3nm"]},
  {id: "1237", brand: "Optolong", name: "OIII 3nm", display: "Optolong OIII 3nm", keywords: ["optolong", "oiii", "o3", "oxygen", "501", "3nm"]},
  {id: "1239", brand: "Optolong", name: "H-Alpha 3nm", display: "Optolong H-alpha 3nm", keywords: ["optolong", "ha", "h-alpha", "656", "3nm"]},
  {id: "1241", brand: "Optolong", name: "Luminance", display: "Optolong Lum", keywords: ["optolong", "lum", "l", "luminance"]},
  {id: "1245", brand: "Optolong", name: "Red", display: "Optolong Red", keywords: ["optolong", "red", "r"]},
  {id: "1249", brand: "Optolong", name: "Green", display: "Optolong Green", keywords: ["optolong", "green", "g"]},
  {id: "1253", brand: "Optolong", name: "Blue", display: "Optolong Blue", keywords: ["optolong", "blue", "b"]},
  {id: "1268", brand: "Optolong", name: "CLS-CCD", display: "Optolong CLS-CCD", keywords: ["optolong", "cls", "ccd", "city", "light", "suppression"]},
  {id: "2021", brand: "Optolong", name: "UHC", display: "Optolong UHC", keywords: ["optolong", "uhc", "ultra", "high", "contrast"]},
  {id: "6669", brand: "Optolong", name: "L-Ultimate", display: "Optolong L-Ultimate", keywords: ["optolong", "l-ultimate", "ultimate", "quad", "band"]},
   {id: "14983", brand: "Optolong", name: "L-eXtreme F2", display: "Optolong L-eXtreme F2", keywords: ["optolong", "l-extreme", "lextreme", "f2", "fast", "dual", "band", "ha", "oiii"]},
   {id: "16072", brand: "Optolong", name: "L-Quad Enhance 2\"", display: "Optolong L-Quad Enhance", keywords: ["optolong", "l-quad", "enhance", "quad", "band"]},
   {id: "16732", brand: "Optolong", name: "L-QEF 2\"", display: "Optolong L-QEF", keywords: ["optolong", "l-qef", "qef", "quad", "band"]},
   {id: "27393", brand: "Optolong", name: "L-Para 2''", display: "Optolong L-Para", keywords: ["optolong", "l-para", "para", "light", "pollution"]},

  // ==================== ORION FILTERS ====================
  {id: "1274", brand: "Orion", name: "Luminance", display: "Orion Lum", keywords: ["orion", "lum", "l", "luminance"]},
  {id: "1276", brand: "Orion", name: "Red", display: "Orion Red", keywords: ["orion", "red", "r"]},
  {id: "1278", brand: "Orion", name: "Green", display: "Orion Green", keywords: ["orion", "green", "g"]},
  {id: "1280", brand: "Orion", name: "Blue", display: "Orion Blue", keywords: ["orion", "blue", "b"]},
  {id: "1783", brand: "Orion", name: "SkyGlow Imaging Filter", display: "Orion SkyGlow", keywords: ["orion", "skyglow", "imaging", "light", "pollution"]},
  {id: "2971", brand: "Orion", name: "H-alpha 7nm", display: "Orion H-alpha 7nm", keywords: ["orion", "ha", "h-alpha", "656", "7nm"]},
  {id: "2972", brand: "Orion", name: "OIII 7nm", display: "Orion OIII 7nm", keywords: ["orion", "oiii", "o3", "oxygen", "7nm"]},

  // ==================== PLAYER ONE FILTERS ====================
  {id: "4027", brand: "Player One", name: "IR 685nm", display: "Player One IR 685nm", keywords: ["player", "one", "playerone", "ir", "685nm", "685", "infrared", "pass"]},
  {id: "7129", brand: "Player One", name: "S-Series UV IR-Cut", display: "Player One UV IR-Cut", keywords: ["player", "one", "playerone", "s-series", "uv", "ir", "cut", "block"]},
  {id: "7261", brand: "Player One", name: "S-Series ERF", display: "Player One ERF", keywords: ["player", "one", "playerone", "s-series", "erf", "energy", "rejection"]},
  {id: "8416", brand: "Player One", name: "S-Series Photosphere 10nm", display: "Player One Photosphere 10nm", keywords: ["player", "one", "playerone", "s-series", "photosphere", "10nm", "solar"]},

  // ==================== QHYCCD FILTERS ====================
  {id: "2265", brand: "QHYCCD", name: "UV/IR CUT", display: "QHY UV/IR Cut", keywords: ["qhy", "qhyccd", "uv", "ir", "cut", "block", "luminance"]},
  {id: "2847", brand: "QHYCCD", name: "IR 850", display: "QHY IR 850nm", keywords: ["qhy", "qhyccd", "ir", "850nm", "850", "infrared", "pass"]},
  {id: "13630", brand: "QHYCCD", name: "CH4 890nm", display: "QHY CH4 890nm", keywords: ["qhy", "qhyccd", "ch4", "methane", "890nm", "890"]},

  // ==================== RADIAN FILTERS ====================
  {id: "1288", brand: "Radian", name: "Triad Ultra", display: "Radian Triad Ultra", keywords: ["radian", "triad", "ultra", "quad", "band"]},
  {id: "1292", brand: "Radian", name: "Triad Ultra (Fast F3)", display: "Radian Triad Ultra F3", keywords: ["radian", "triad", "ultra", "f3", "fast", "multiband"]},
  {id: "1294", brand: "Radian", name: "Triad Tri-band", display: "Radian Triad Tri-band", keywords: ["radian", "triad", "tri-band", "triband", "multiband"]},
  {id: "14257", brand: "Radian", name: "Multiband Original OPT Triad Dual Band", display: "Radian Triad Dual Band", keywords: ["radian", "multiband", "triad", "dual", "dualband", "opt"]},

  // ==================== SVBONY FILTERS ====================
  {id: "1333", brand: "SVBony", name: "OIII 7nm", display: "SVBony OIII 7nm", keywords: ["svbony", "sv", "bony", "oiii", "o3", "oxygen", "501", "7nm"]},
  {id: "1335", brand: "SVBony", name: "SII 7nm", display: "SVBony SII 7nm", keywords: ["svbony", "sv", "bony", "sii", "s2", "sulfur", "672", "7nm"]},
  {id: "1337", brand: "SVBony", name: "H-alpha 7nm", display: "SVBony H-alpha 7nm", keywords: ["svbony", "sv", "bony", "ha", "h-alpha", "656", "7nm"]},
  {id: "1340", brand: "SVBony", name: "H-beta 25nm", display: "SVBony H-beta 25nm", keywords: ["svbony", "sv", "bony", "hb", "h-beta", "486", "25nm"]},
  {id: "1342", brand: "SVBony", name: "OIII 18nm", display: "SVBony OIII 18nm", keywords: ["svbony", "sv", "bony", "oiii", "o3", "oxygen", "501", "18nm"]},
  {id: "1344", brand: "SVBony", name: "Luminance", display: "SVBony Lum", keywords: ["svbony", "sv", "bony", "lum", "l", "luminance", "clear"]},
  {id: "1346", brand: "SVBony", name: "Red", display: "SVBony Red", keywords: ["svbony", "sv", "bony", "red", "r"]},
  {id: "1348", brand: "SVBony", name: "Green", display: "SVBony Green", keywords: ["svbony", "sv", "bony", "green", "g"]},
  {id: "1350", brand: "SVBony", name: "Blue", display: "SVBony Blue", keywords: ["svbony", "sv", "bony", "blue", "b"]},
  {id: "1352", brand: "SVBony", name: "IR Pass 685nm", display: "SVBony IR Pass 685nm", keywords: ["svbony", "sv", "bony", "ir", "pass", "685", "685nm", "infrared"]},
  {id: "1354", brand: "SVBony", name: "UHC", display: "SVBony UHC", keywords: ["svbony", "sv", "bony", "uhc", "ultra", "high", "contrast"]},
  {id: "1357", brand: "SVBony", name: "CLS", display: "SVBony CLS", keywords: ["svbony", "sv", "bony", "cls", "city", "light", "suppression", "pollution"]},
  {id: "1360", brand: "SVBony", name: "UV/IR Cut", display: "SVBony UV/IR Cut", keywords: ["svbony", "sv", "bony", "uv", "ir", "cut", "block"]},
  {id: "9505", brand: "SVBony", name: "SV220 7nm", display: "SVBony SV220 7nm", keywords: ["svbony", "sv220", "sv", "220", "7nm", "dual", "dualband", "duo", "band", "ha", "oiii"]},
  {id: "11320", brand: "SVBony", name: "Moon", display: "SVBony Moon", keywords: ["svbony", "sv", "bony", "moon", "lunar", "nd"]},
  {id: "12805", brand: "SVBony", name: "Moon", display: "SVBony Moon 1.25", keywords: ["svbony", "sv", "bony", "moon", "lunar", "nd", "1.25"]},
  {id: "14719", brand: "SVBony", name: "Yellow #8", display: "SVBony Yellow #8", keywords: ["svbony", "sv", "bony", "yellow", "#8", "8", "planetary"]},
  {id: "17921", brand: "SVBony", name: "SV220 7nm", display: "SVBony SV220 7nm (1.25)", keywords: ["svbony", "sv220", "sv", "220", "7nm", "dual", "dualband", "duo", "band", "ha", "oiii", "1.25"]},
  {id: "19802", brand: "SVBony", name: "SV229 Solar Filter", display: "SVBony SV229 Solar", keywords: ["svbony", "sv229", "sv", "229", "solar", "sun"]},
  {id: "27457", brand: "SVBony", name: "SV227 H-Alpha 5nm", display: "SVBony SV227 H-alpha 5nm", keywords: ["svbony", "sv227", "sv", "227", "ha", "h-alpha", "656", "5nm"]},
  {id: "27458", brand: "SVBony", name: "SV227 OIII 5nm", display: "SVBony SV227 OIII 5nm", keywords: ["svbony", "sv227", "sv", "227", "oiii", "o3", "oxygen", "501", "5nm"]},
  {id: "29503", brand: "SVBony", name: "SV260 Multiband", display: "SVBony SV260 Multiband", keywords: ["svbony", "sv260", "sv", "260", "multiband", "multi", "band", "dual", "trio", "quad"]},

  // ==================== TS-OPTICS FILTERS ====================
  {id: "1818", brand: "TS-Optics", name: "UV & IR Cut Filter", display: "TS UV/IR Cut", keywords: ["ts", "optics", "ts-optics", "uv", "ir", "cut", "block", "luminance"]},
  {id: "1952", brand: "TS-Optics", name: "OIII", display: "TS OIII", keywords: ["ts", "optics", "ts-optics", "oiii", "o3", "oxygen"]},
  {id: "2179", brand: "TS-Optics", name: "CLS", display: "TS CLS", keywords: ["ts", "optics", "ts-optics", "cls", "city", "light", "suppression", "pollution"]},
  {id: "5623", brand: "TS-Optics", name: "LRGB Filterset Blue", display: "TS LRGB Blue", keywords: ["ts", "optics", "ts-optics", "lrgb", "blue", "b", "set"]},
  {id: "5626", brand: "TS-Optics", name: "LRGB Filterset Green", display: "TS LRGB Green", keywords: ["ts", "optics", "ts-optics", "lrgb", "green", "g", "set"]},
  {id: "5629", brand: "TS-Optics", name: "LRGB Filterset Luminance", display: "TS LRGB Lum", keywords: ["ts", "optics", "ts-optics", "lrgb", "luminance", "lum", "l", "set"]},
  {id: "5632", brand: "TS-Optics", name: "LRGB Filterset Red", display: "TS LRGB Red", keywords: ["ts", "optics", "ts-optics", "lrgb", "red", "r", "set"]},

  // ==================== VAONIS/VESPERA FILTERS ====================
  {id: "6964", brand: "Vaonis", name: "Stellina integrated CLS", display: "Vaonis Stellina CLS", keywords: ["vaonis", "stellina", "cls", "integrated", "city", "light"]},
  {id: "9109", brand: "Vaonis", name: "Vespera Light Pollution Filter", display: "Vaonis Vespera LP", keywords: ["vaonis", "vespera", "light", "pollution", "lp"]},
  {id: "11452", brand: "Vaonis", name: "Vespera Dual Band", display: "Vaonis Vespera Dual Band", keywords: ["vaonis", "vespera", "dual", "band", "ha", "oiii"]},
  {id: "13036", brand: "Vaonis", name: "Vespera Solar Filter", display: "Vaonis Vespera Solar", keywords: ["vaonis", "vespera", "solar", "sun"]},

  // ==================== ZWO FILTERS ====================
  {id: "1365", brand: "ZWO", name: "Luminance", display: "ZWO Lum", keywords: ["zwo", "asi", "lum", "l", "luminance", "clear"]},
  {id: "1369", brand: "ZWO", name: "Red", display: "ZWO Red", keywords: ["zwo", "asi", "red", "r"]},
  {id: "1373", brand: "ZWO", name: "Green", display: "ZWO Green", keywords: ["zwo", "asi", "green", "g"]},
  {id: "1377", brand: "ZWO", name: "Blue", display: "ZWO Blue", keywords: ["zwo", "asi", "blue", "b"]},
  {id: "1381", brand: "ZWO", name: "O-III 7nm", display: "ZWO OIII 7nm", keywords: ["zwo", "asi", "oiii", "o3", "oxygen", "501", "7nm"]},
  {id: "1385", brand: "ZWO", name: "H-alpha 7nm", display: "ZWO H-alpha 7nm", keywords: ["zwo", "asi", "ha", "h-alpha", "656", "7nm"]},
  {id: "1389", brand: "ZWO", name: "S-II 7nm", display: "ZWO SII 7nm", keywords: ["zwo", "asi", "sii", "s2", "sulfur", "672", "7nm"]},
  {id: "1393", brand: "ZWO", name: "Duo-Band", display: "ZWO Duo-Band", keywords: ["zwo", "asi", "duo", "band", "dual", "ha", "oiii"]},
  {id: "1395", brand: "ZWO", name: "UV IR CUT", display: "ZWO UV/IR Cut", keywords: ["zwo", "asi", "uv", "ir", "cut", "block"]},
  {id: "1397", brand: "ZWO", name: "CH4", display: "ZWO CH4", keywords: ["zwo", "asi", "ch4", "methane"]}
];

// Internal helper moved out of suggestFilterId to avoid nested function warning in strict mode
function _astrobinValidFilterId(id){ return id && (""+id).trim().length>0; }

// Helper function to suggest AstroBin filter ID based on FITS filter name
function suggestFilterId(fitsFilterName)
{
   if (!fitsFilterName) return "";
   var filterName = fitsFilterName.toLowerCase();
   var preferredBrand = CONFIG.preferredFilterBrand;
   var preferredMatch = "";
   var fallbackMatch = "";

   // 1. Personal filter set override when preferred brand is Auto
   if (CONFIG.preferredFilterBrand === "Auto" && CONFIG.personalFilterSet) {
      var pset = CONFIG.personalFilterSet;
      // Luminance
      if ((filterName.indexOf("lum") >= 0 || filterName.indexOf("lumin") >= 0 || filterName === "l" || filterName.indexOf("luma")>=0) && _astrobinValidFilterId(pset.L)) return pset.L;
      // Red Green Blue
      if (filterName.indexOf("red") >= 0 && _astrobinValidFilterId(pset.R)) return pset.R;
      if (filterName.indexOf("green") >= 0 && _astrobinValidFilterId(pset.G)) return pset.G;
      if (filterName.indexOf("blue") >= 0 && _astrobinValidFilterId(pset.B)) return pset.B;
      // Narrowband Ha OIII SII (case-insensitive variants)
      if ((filterName.indexOf("ha") >= 0 || filterName.indexOf("h-alpha") >= 0 || filterName.indexOf("halpha") >= 0) && _astrobinValidFilterId(pset.Ha)) return pset.Ha;
      if ((filterName.indexOf("oiii") >= 0 || filterName.indexOf("o3") >= 0 || filterName.indexOf("oxygen") >= 0) && _astrobinValidFilterId(pset.OIII)) return pset.OIII;
      if ((filterName.indexOf("sii") >= 0 || filterName.indexOf("s2") >= 0 || filterName.indexOf("sulfur") >= 0 || filterName.indexOf("sulphur") >= 0) && _astrobinValidFilterId(pset.SII)) return pset.SII;
   }
   
   // Search through the filter database using keywords
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      var filter = ASTROBIN_FILTERS[i];
      if (filter.keywords) {
         for (var j = 0; j < filter.keywords.length; j++) {
            var keyword = filter.keywords[j].toLowerCase();
            if (filterName.indexOf(keyword) >= 0) {
               // If we have a preferred brand and this matches, prioritize it
               if (preferredBrand && preferredBrand !== "Auto" && filter.brand === preferredBrand) {
                  return filter.id; // Return immediately for preferred brand match
               }
               // Store fallback match (first good match)
               if (!fallbackMatch) {
                  fallbackMatch = filter.id;
               }
            }
         }
      }
   }
   
   // Return preferred match if found, otherwise fallback
   return preferredMatch || fallbackMatch || ""; // No suggestion found
}

// Get filter display name by ID
function getFilterDisplayName(filterId)
{
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      if (ASTROBIN_FILTERS[i].id === filterId) {
         return ASTROBIN_FILTERS[i].display || ASTROBIN_FILTERS[i].name;
      }
   }
   return "Unknown Filter";
}

// Find filter by ID
function findFilterById(filterId)
{
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      if (ASTROBIN_FILTERS[i].id === filterId) {
         return ASTROBIN_FILTERS[i];
      }
   }
   return null;
}

// Search filters by name or brand
function searchFilters(searchTerm)
{
   if (!searchTerm) return [];
   
   var results = [];
   var term = searchTerm.toLowerCase();
   
   for (var i = 0; i < ASTROBIN_FILTERS.length; i++) {
      var filter = ASTROBIN_FILTERS[i];
      if (filter.name.toLowerCase().indexOf(term) >= 0 ||
          filter.brand.toLowerCase().indexOf(term) >= 0 ||
          (filter.display && filter.display.toLowerCase().indexOf(term) >= 0)) {
         results.push(filter);
      }
   }
   
   return results;
}
