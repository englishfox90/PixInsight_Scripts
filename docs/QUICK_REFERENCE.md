# Quick Reference: AstroBin Export Installation

## For End Users

### Recommended: Install via PixInsight Update Repository

1. Open PixInsight
2. Go to `Resources → Updates → Manage Repositories...`
3. Click **Add**
4. Paste this URL:
   ```
   https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/
   ```
5. Click **OK**, then **Check for Updates**
6. Install the AstroBin Export package
7. Restart PixInsight
8. Find the script under `Script → PFRAstro → AstroBin Export`

### Alternative: Manual Installation

1. Download the `AstroBin Export/` folder
2. In PixInsight: `Script → Feature Scripts...`
3. Click **Add** and select `AstroBin_CSV_Export_v3_Modular.js`

---

## For Developers

### Building a New Release

```powershell
# 1. Navigate to repository
cd "d:\Astrophotography\PixInsight Files\PixInsight Custom Scripts"

# 2. Build the package (optionally specify version)
npm run build:astrobin
# or with version:
npm run build:astrobin -- --version=1.1.0

# 3. Commit and push
git add updates/
git commit -m "Release AstroBin Export v1.0.0"
git push origin main

# 4. Test in PixInsight by adding/refreshing the repository
```

### What the Build Does

- ✅ Copies source files to proper PixInsight structure
- ✅ Creates ZIP package in `updates/`
- ✅ Calculates SHA1 hash
- ✅ Updates `updates.xri` with metadata
- ✅ Cleans up temporary files

### Files Included in Package

**Scripts:**
- AstroBin_CSV_Export_v3_Modular.js (main entry)
- AstroBin-core.js
- AstroBin-filter-database.js
- AstroBin-analysis.js
- AstroBin-gui.js
- AstroBin-gui-methods.js

**Resources:**
- astrobin_filters.csv

**Excluded:**
- archive/ subdirectory (old versions)

---

## Repository URL

Always use the **raw** GitHub URL for PixInsight:

```
https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/
```

(Note the trailing slash is required)
