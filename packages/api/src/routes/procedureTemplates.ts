import { Router } from 'express';
import path from 'path';
import fs from 'fs';
import { authenticate } from '../middleware/auth.js';

const router = Router();

const templatesDir = path.join(process.cwd(), 'procedure-templates');

interface ProcedureTemplate {
  id: string;
  name: string;
  filename: string;
  description: string;
  category: string;
}

// Procedure template metadata
const templates: ProcedureTemplate[] = [
  {
    id: 'tonsillectomy',
    name: 'Tonsillectomy',
    filename: 'tonsillectomy.md',
    description: 'Comprehensive guide for tonsil removal surgery including risks, recovery, and post-operative care',
    category: 'Throat Surgery',
  },
  {
    id: 'septoplasty',
    name: 'Septoplasty',
    filename: 'septoplasty.md',
    description: 'Nasal septum straightening procedure information with detailed recovery timeline',
    category: 'Nasal Surgery',
  },
  {
    id: 'adenoidectomy',
    name: 'Adenoidectomy',
    filename: 'adenoidectomy.md',
    description: 'Adenoid removal surgery guide for pediatric and adult patients',
    category: 'Throat Surgery',
  },
  {
    id: 'fess',
    name: 'FESS (Functional Endoscopic Sinus Surgery)',
    filename: 'fess.md',
    description: 'Minimally invasive sinus surgery information including post-operative care requirements',
    category: 'Sinus Surgery',
  },
  {
    id: 'thyroidectomy',
    name: 'Thyroidectomy',
    filename: 'thyroidectomy.md',
    description: 'Thyroid gland removal surgery guide covering total and partial procedures',
    category: 'Neck Surgery',
  },
];

router.use(authenticate);

// Get list of all procedure templates
router.get('/', async (_req, res) => {
  try {
    res.json({ templates });
  } catch (error) {
    console.error('Get procedure templates error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Get a specific procedure template content
router.get('/:id', async (req, res) => {
  try {
    const template = templates.find((t) => t.id === req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const filePath = path.join(templatesDir, template.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    const content = fs.readFileSync(filePath, 'utf-8');

    res.json({
      template: {
        ...template,
        content,
      },
    });
  } catch (error) {
    console.error('Get procedure template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

// Download template as markdown file
router.get('/:id/download', async (req, res) => {
  try {
    const template = templates.find((t) => t.id === req.params.id);

    if (!template) {
      return res.status(404).json({ error: 'Template not found' });
    }

    const filePath = path.join(templatesDir, template.filename);

    if (!fs.existsSync(filePath)) {
      return res.status(404).json({ error: 'Template file not found' });
    }

    res.setHeader('Content-Type', 'text/markdown');
    res.setHeader('Content-Disposition', `attachment; filename="${template.filename}"`);
    res.sendFile(filePath);
  } catch (error) {
    console.error('Download procedure template error:', error);
    res.status(500).json({ error: 'Internal server error' });
  }
});

export default router;
