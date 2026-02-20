/**
 * Test utility to load and resolve CSS @import statements.
 * Since tests need to check CSS content, this helper reads the index.css
 * and recursively resolves all @import statements.
 */

const fs = require('fs');
const path = require('path');

/**
 * Loads CSS file and resolves all @import statements recursively
 * @param {string} cssPath - Path to the CSS file
 * @returns {string} - Resolved CSS content with all imports expanded
 */
function loadCSSWithImports(cssPath) {
  const content = fs.readFileSync(cssPath, 'utf8');
  const baseDir = path.dirname(cssPath);
  
  // Replace @import statements with the actual file content
  return content.replace(/@import\s+['"](.+)['"]\s*;/g, (match, importPath) => {
    const resolvedPath = path.join(baseDir, importPath);
    if (fs.existsSync(resolvedPath)) {
      // Recursively resolve imports (in case imported files have imports)
      return loadCSSWithImports(resolvedPath);
    }
    // If file doesn't exist, return the import statement as-is
    return match;
  });
}

module.exports = { loadCSSWithImports };
