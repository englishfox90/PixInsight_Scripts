# PixInsight Update Repository - XML Format Requirements

## Critical Requirements for updates.xri

PixInsight's update repository parser is **extremely strict** about XML formatting. This document describes the requirements and the safeguards built into our build system.

### 1. Version Range Format

**Requirement:** Platform version must be a **fully-specified range** in format `MIN:MAX`

❌ **INVALID:**
```xml
<platform os="all" arch="noarch" version="1.8.0:">
```

✅ **VALID:**
```xml
<platform os="all" arch="noarch" version="1.8.0:2.0.0">
```

**Why:** PixInsight requires both minimum and maximum versions. Half-open ranges (ending with `:`) will cause the parser to fail.

**Build System Safeguard:** Automatically generates `1.8.0:2.0.0` and validates the format.

---

### 2. Release Date Format

**Requirement:** Release date must be **digits only** in format `YYYYMMDD` or `YYYYMMDDHHMM`

❌ **INVALID:**
```xml
releaseDate="2025-11-29T23:40:14.292Z"
releaseDate="2025-11-29"
releaseDate="11/29/2025"
```

✅ **VALID:**
```xml
releaseDate="20251129"
releaseDate="202511291540"
```

**Why:** PixInsight's parser expects pure numeric format without punctuation.

**Build System Safeguard:** Automatically generates `YYYYMMDD` format and validates with regex `/^\d{8}(\d{4})?$/`

---

### 3. Case-Sensitive Filename Matching

**Requirement:** The `fileName` attribute must **exactly match** the actual ZIP file on disk (case-sensitive)

❌ **INVALID:**
```xml
<!-- Actual file: AstroBinExport-1.0.0-20251129.zip -->
<package fileName="astrobinexport-1.0.0-20251129.zip" ...>
```

✅ **VALID:**
```xml
<!-- Exact match -->
<package fileName="AstroBinExport-1.0.0-20251129.zip" ...>
```

**Why:** PixInsight validates the filename against the actual file. Case mismatches cause download failures.

**Build System Safeguard:** Auto-discovers the actual filename from disk after ZIP creation and uses that exact string.

---

### 4. No Trailing Whitespace

**Requirement:** XML attributes must have **no trailing spaces** before closing `>`

❌ **INVALID:**
```xml
<package fileName="file.zip" >
             releaseDate="20251129" >
```

✅ **VALID:**
```xml
<package fileName="file.zip"
             releaseDate="20251129">
```

**Why:** PixInsight's strict XML parser may reject files with unexpected whitespace.

**Build System Safeguard:** Template strings are carefully formatted. Validation scans for trailing spaces and reports warnings.

---

### 5. UTF-8 Encoding (No BOM)

**Requirement:** File must be UTF-8 encoded **without** Byte Order Mark (BOM)

❌ **INVALID:** File starts with `0xEF 0xBB 0xBF` (UTF-8 BOM)

✅ **VALID:** File starts with `<?xml`

**Why:** PixInsight expects pure UTF-8. BOM causes parser errors.

**Build System Safeguard:** Writes file with `{ encoding: 'utf8' }` which produces BOM-less output. Validation checks for BOM.

---

### 6. XML Special Character Escaping

**Requirement:** All text content must properly escape XML special characters

**Characters that must be escaped:**
- `&` → `&amp;`
- `<` → `&lt;`
- `>` → `&gt;`
- `"` → `&quot;`
- `'` → `&apos;`

❌ **INVALID:**
```xml
<p>Supports "quoted" text & special characters</p>
```

✅ **VALID:**
```xml
<p>Supports &quot;quoted&quot; text &amp; special characters</p>
```

**Build System Safeguard:** `escapeXml()` function automatically escapes all project names, descriptions, and features.

---

### 7. Package Elements Inside Platform

**Requirement:** All `<package>` elements must be inside the `<platform>` element

❌ **INVALID:**
```xml
</platform>
<package fileName="..." ...>
```

✅ **VALID:**
```xml
<platform ...>
  <package fileName="..." ...>
  </package>
</platform>
```

**Build System Safeguard:** Validation checks that all `<package>` elements appear between `<platform>` and `</platform>`.

---

### 8. SHA1 Hash Format

**Requirement:** SHA1 hash must be exactly 40 hexadecimal characters (lowercase)

❌ **INVALID:**
```xml
sha1="E4526FDC17D6C1368FA6D05577B040AF3529690A"  <!-- uppercase -->
sha1="e4526fdc17d6"  <!-- too short -->
```

✅ **VALID:**
```xml
sha1="e4526fdc17d6c1368fa6d05577b040af3529690a"
```

**Build System Safeguard:** Calculates SHA1 directly from file. Validation checks format with `/^[a-f0-9]{40}$/`

---

## Build System Validation

The build system performs comprehensive validation **before completing the build:**

### Automatic Checks

1. ✅ File exists with exact case-sensitive name
2. ✅ Release date is digits only (YYYYMMDD)
3. ✅ Platform version range is fully specified (MIN:MAX)
4. ✅ SHA1 hash is 40 hex characters
5. ✅ No BOM in file
6. ✅ XML structure is valid
7. ✅ All packages are inside platform element
8. ✅ No trailing whitespace before `>`

### If Validation Fails

The build will **abort** with clear error messages:

```
❌ updates.xri validation failed!
The generated manifest contains errors that will cause PixInsight to reject it.
   • Platform version range must be fully specified (MIN:MAX), not half-open: 1.8.0:
   • Invalid releaseDate format: must be YYYYMMDD or YYYYMMDDHHMM
```

### Success Output

```
🔍 Validating updates.xri...
   ✅ Validation passed - updates.xri is valid
```

---

## Developer Guidelines

### When Adding New Projects

1. Update `packaging.config.json`
2. Set `"ready": true` when stable
3. Run `npm run build:packages`
4. **Validation runs automatically** - if it passes, the XRI is PixInsight-compliant

### Testing in PixInsight

1. Add repository URL to PixInsight
2. If PixInsight rejects the repository:
   - Check validation output from build
   - Review updates.xri against this document
   - Re-run build to regenerate

### Manual XRI Editing

**⚠️ WARNING:** Do not manually edit `updates.xri`

The file is **auto-generated** on every build. Manual edits will be lost and may introduce formatting errors.

If you need to change content:
1. Edit `packaging.config.json`
2. Run `npm run build:packages`
3. Let the build system generate valid XML

---

## Example Valid updates.xri

```xml
<?xml version="1.0" encoding="UTF-8"?>
<xri version="1.0">
  <description>
    <p>
      PixInsight Custom Scripts
    </p>
    <p>
      This repository provides the AstroBin Export tool.
    </p>
  </description>

  <platform os="all" arch="noarch" version="1.8.0:2.0.0">
    <package fileName="AstroBinExport-1.0.0-20251129.zip"
             sha1="e4526fdc17d6c1368fa6d05577b040af3529690a"
             type="script"
             releaseDate="20251129">
      <title>
        AstroBin Export
      </title>
      <description>
        <p>
          AstroBin Export v1.0.0
        </p>
        <p>
          Generates CSV files compatible with AstroBin&apos;s bulk acquisition upload feature.
        </p>
        <p>
          <b>Key Features:</b>
        </p>
        <ul>
          <li>Automatic FITS header analysis</li>
          <li>200+ filters across 22+ manufacturers</li>
        </ul>
      </description>
    </package>
  </platform>
</xri>
```

---

## References

- Build Script: `tools/build-packages.mjs`
- Configuration: `packaging.config.json`
- Validation Function: `validateUpdatesXri()` in build script

---

**Last Updated:** 2025-11-29  
**Build System Version:** 1.1.0+
