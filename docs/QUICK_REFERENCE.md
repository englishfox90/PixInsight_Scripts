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

### Building Packages (New Multi-Project System)

```powershell
# 1. Navigate to repository
cd "d:\Astrophotography\PixInsight Files\PixInsight Custom Scripts"

# 2. Install dependencies (first time only)
npm install

# 3. Build all ready projects
npm run build:packages

# 4. Commit and push
git add updates/ packaging.config.json
git commit -m "Release updates"
git push origin main
```

### Updating Project Versions

```powershell
# 1. Edit packaging.config.json
# Change the version number for the desired project

# 2. Build packages
npm run build:packages

# 3. Commit with tag
git add packaging.config.json updates/
git commit -m "Release ProjectName vX.Y.Z"
git tag -a vX.Y.Z -m "Release notes"
git push origin main --tags
```

### Making a Project Ready for Distribution

1. Edit `packaging.config.json`
2. Find your project entry
3. Change `"ready": false` to `"ready": true`
4. Run `npm run build:packages`
5. Commit and push

### Legacy Build (Deprecated)

```powershell
# Old single-project build (still works but deprecated)
npm run build:astrobin
# or with version:
npm run build:astrobin -- --version=1.1.0
```

### What the Build Does

- ✅ Reads `packaging.config.json` for project definitions
- ✅ Builds ZIP packages for all projects marked `"ready": true`
- ✅ Copies source files to proper PixInsight structure
- ✅ Generates unified `updates.xri` manifest
- ✅ Calculates SHA1 hash for each package
- ✅ Cleans up old packages and temporary files

### Files Included in Packages

Configuration in `packaging.config.json` controls which files are included:

**AstroBin Export:**
- All JavaScript modules (6 files)
- CSV filter database
- Excludes: archive/ directory

**Signature (when ready):**
- MasterSignature.js
- Font files
- Logo resources

---

## Repository URL

Always use the **raw** GitHub URL for PixInsight:

```
https://raw.githubusercontent.com/englishfox90/PixInsight_Scripts/main/updates/
```

(Note the trailing slash is required)
