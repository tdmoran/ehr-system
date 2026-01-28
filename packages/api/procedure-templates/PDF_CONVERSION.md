# PDF Conversion Instructions

The procedure template documents are currently in Markdown (.md) format. To convert them to PDF for easier distribution:

## Option 1: Using Pandoc (Recommended)

### Install Pandoc
```bash
# macOS
brew install pandoc

# Install LaTeX for better PDF generation
brew install --cask mactex
```

### Convert Individual Files
```bash
cd packages/api/procedure-templates

pandoc tonsillectomy.md -o tonsillectomy.pdf
pandoc septoplasty.md -o septoplasty.pdf
pandoc adenoidectomy.md -o adenoidectomy.pdf
pandoc fess.md -o fess.pdf
pandoc thyroidectomy.md -o thyroidectomy.pdf
```

### Convert All Files at Once
```bash
for file in *.md; do
  if [ "$file" != "README.md" ] && [ "$file" != "PDF_CONVERSION.md" ]; then
    pandoc "$file" -o "${file%.md}.pdf"
  fi
done
```

## Option 2: Online Converters

Upload .md files to any of these services:
- https://www.markdowntopdf.com/
- https://md2pdf.netlify.app/
- https://cloudconvert.com/md-to-pdf

## Option 3: Using Node.js Package

### Install markdown-pdf
```bash
npm install -g markdown-pdf
```

### Convert Files
```bash
markdown-pdf tonsillectomy.md -o tonsillectomy.pdf
```

## Option 4: VS Code Extension

1. Install "Markdown PDF" extension in VS Code
2. Open any .md file
3. Right-click → "Markdown PDF: Export (pdf)"

## Future Enhancement

Consider adding automatic PDF generation to the build process:

```javascript
// In package.json scripts
"generate-pdfs": "node scripts/generate-pdfs.js"
```

```javascript
// scripts/generate-pdfs.js
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';

const execAsync = promisify(exec);

const templatesDir = 'packages/api/procedure-templates';
const files = fs.readdirSync(templatesDir)
  .filter(f => f.endsWith('.md') && !['README.md', 'PDF_CONVERSION.md'].includes(f));

for (const file of files) {
  const mdPath = path.join(templatesDir, file);
  const pdfPath = mdPath.replace('.md', '.pdf');
  await execAsync(`pandoc "${mdPath}" -o "${pdfPath}"`);
  console.log(`Generated ${pdfPath}`);
}
```

## Styling PDFs

For better-looking PDFs, create a custom CSS file:

```css
/* procedure-template.css */
body {
  font-family: 'Arial', sans-serif;
  font-size: 11pt;
  line-height: 1.6;
  margin: 1in;
}

h1 {
  color: #0d9488;
  border-bottom: 2px solid #0d9488;
  padding-bottom: 0.3em;
}

h2 {
  color: #115e59;
  margin-top: 1.5em;
}

strong {
  color: #0f766e;
}
```

Then use with pandoc:
```bash
pandoc input.md -o output.pdf --css=procedure-template.css
```

---

*Last updated: January 2026*
