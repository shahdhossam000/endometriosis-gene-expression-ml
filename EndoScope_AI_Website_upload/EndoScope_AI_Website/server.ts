import 'dotenv/config';
import express from 'express';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GoogleGenAI, ThinkingLevel, Type } from '@google/genai';
import type {
  AnalysisLanguage,
  CellAlterationStatus,
  GeneAnalysisDossier,
  LesionCompartment,
} from './src/types/dossier.ts';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = Number(process.env.PORT || 3000);
const isProduction = process.env.NODE_ENV === 'production';

const VALID_COMPARTMENTS: LesionCompartment[] = [
  'All Compartments',
  'Peritoneal Ectopic',
  'Ovarian Endometrioma',
  'Deep Infiltrating Endometriosis',
  'Eutopic Endometrium',
];

const SYSTEM_INSTRUCTION = `You are an expert AI Bioinformatics Research Assistant and Computational Biologist specialized in Endometriosis transcriptomics, single-cell RNA-seq (scRNA-seq) analysis, spatial transcriptomics, and molecular pathology.

Your task is to evaluate the user's queried gene symbol (e.g., LYVE1, VEGFA, CCL19, ESR1, COL1A1, MMP9) or endometriosis molecular mechanism query within the specified lesion compartment and generate a rigorous, publication-grade scientific analysis structured across 5 core analytical modules, paired with internally consistent, literature-grounded representative quantitative estimates for visualization.

Scientific & Editorial Requirements:
1. Maintain a rigorous, academic, publication-grade scientific tone using precise molecular biology terminology (e.g., decidualization, myofibroblast transdifferentiation, lymphangiogenesis, progesterone resistance, EMT, perivascular niche, macrophage polarization).
2. Respect the requested output language:
   - If language is "en": write all narrative fields in academic English.
   - If language is "ar": write all narrative overviews, findings, mechanisms, summaries, rationales, and wet-lab hypothesis fields in clear, rigorous academic Arabic while keeping HGNC gene symbols (e.g., LYVE1, VEGFA), pathway acronyms, SHAP, log2FC, and receptor/ligand names in standard scientific notation.
3. Structure the analysis into the 5 required analytical modules:
   - Module 1 (Cell Atlas Integration): Identify specific cell populations in the endometriosis microenvironment (immune subsets such as macrophages, NK cells, T cells; stromal fibroblasts; vascular/lymphatic endothelial cells; epithelial cells; perivascular smooth muscle/pericytes; mesothelial cells), specify which populations exhibit altered transcriptional activity in disease, and provide representative 2D UMAP cluster coordinates (umapX -8 to 8, umapY -8 to 8), gene expression (0-10), and alteration status (Hyperactive, Suppressed, Altered, Homeostatic).
   - Module 2 (Gene Explorer): Detail expression profiles across cell types, compare healthy control endometrium vs. eutopic endometrium vs. ectopic lesion tissues, and cite single-cell and bulk transcriptomic directional trends.
   - Module 3 (Biological Pathways & Functional Enrichment): Explain affected pathways and downstream targets (chronic inflammation, tissue fibrosis, angiogenesis/neo-vascularization, estrogen/progesterone hormone signaling, extracellular matrix remodeling).
   - Module 4 (Cell-Cell Communication & Ligand-Receptor Interactions): Analyze signaling crosstalk in the lesion microenvironment involving the queried gene/mechanism, specifying concrete Ligand-Receptor pairs and directional sender-receiver axes among immune, stromal, endothelial, and epithelial cells.
   - Module 5 (Explainable ML & Hypothesis Generation): Predict the gene's disease-state expression / biomarker score (0-100), rank the top 5 candidate co-predictive genes for study with SHAP importance scores and explicit explanations of WHY the model selected each gene, explain SHAP feature attribution across disease states, and formulate a concrete, actionable wet-lab experimental hypothesis (specific perturbation, model system, assay, primary readouts, and expected outcome).
4. Ensure all numeric plot series are biologically faithful to the prose and accurately reflect endometriosis transcriptomics literature.`;

const dossierSchema = {
  type: Type.OBJECT,
  properties: {
    geneSymbol: {
      type: Type.STRING,
      description: 'Canonical HGNC gene symbol or concise mechanism identifier (e.g., LYVE1, VEGFA, CCL19).',
    },
    fullName: {
      type: Type.STRING,
      description: 'Official full gene or molecular axis name.',
    },
    executiveSummary: {
      type: Type.STRING,
      description: 'A rigorous 2-3 sentence scientific abstract summarizing the target role in endometriosis pathology.',
    },
    summaryMetrics: {
      type: Type.OBJECT,
      properties: {
        overallDirection: {
          type: Type.STRING,
          description: 'Must be one of: Upregulated, Downregulated, Cell-Type Specific, Context-Dependent.',
        },
        ectopicLog2FC: {
          type: Type.NUMBER,
          description: 'Representative bulk/pseudobulk log2 fold-change in ectopic lesions vs healthy endometrium.',
        },
        primaryCellPopulation: {
          type: Type.STRING,
          description: 'Primary cell type exhibiting peak expression or pathological dysregulation.',
        },
        topPathway: {
          type: Type.STRING,
          description: 'Most significantly enriched hallmark biological process.',
        },
        mlFeatureRank: {
          type: Type.STRING,
          description: 'Representative feature priority rank (e.g., Top 2% · Rank #14 / 2,400).',
        },
        meanAbsShap: {
          type: Type.NUMBER,
          description: 'Mean absolute SHAP attribution magnitude (0.01 to 0.85).',
        },
      },
      required: [
        'overallDirection',
        'ectopicLog2FC',
        'primaryCellPopulation',
        'topPathway',
        'mlFeatureRank',
        'meanAbsShap',
      ],
    },
    modules: {
      type: Type.OBJECT,
      properties: {
        cellAtlas: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            keyFindings: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            populations: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  cellType: { type: Type.STRING },
                  lineage: { type: Type.STRING },
                  perturbationScore: { type: Type.NUMBER },
                  abundanceDeltaPct: { type: Type.NUMBER },
                  umapX: { type: Type.NUMBER },
                  umapY: { type: Type.NUMBER },
                  geneExpression: { type: Type.NUMBER },
                  status: {
                    type: Type.STRING,
                    description: 'Must be one of: Hyperactive, Suppressed, Altered, Homeostatic.',
                  },
                  dysregulationSummary: { type: Type.STRING },
                },
                required: [
                  'cellType',
                  'lineage',
                  'perturbationScore',
                  'abundanceDeltaPct',
                  'umapX',
                  'umapY',
                  'geneExpression',
                  'status',
                  'dysregulationSummary',
                ],
              },
            },
          },
          required: ['overview', 'keyFindings', 'populations'],
        },
        geneExplorer: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            tissueComparisonNarrative: { type: Type.STRING },
            transcriptomicTrends: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            expressionProfiles: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  cellType: { type: Type.STRING },
                  healthyCpm: { type: Type.NUMBER },
                  eutopicCpm: { type: Type.NUMBER },
                  ectopicCpm: { type: Type.NUMBER },
                  log2FoldChange: { type: Type.NUMBER },
                  adjustedPValue: { type: Type.STRING },
                },
                required: [
                  'cellType',
                  'healthyCpm',
                  'eutopicCpm',
                  'ectopicCpm',
                  'log2FoldChange',
                  'adjustedPValue',
                ],
              },
            },
          },
          required: ['overview', 'tissueComparisonNarrative', 'transcriptomicTrends', 'expressionProfiles'],
        },
        pathways: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            keyMechanisms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            enrichmentResults: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  pathwayName: { type: Type.STRING },
                  category: { type: Type.STRING },
                  nesScore: { type: Type.NUMBER },
                  negLog10Fdr: { type: Type.NUMBER },
                  direction: { type: Type.STRING },
                  mechanisticRole: { type: Type.STRING },
                },
                required: ['pathwayName', 'category', 'nesScore', 'negLog10Fdr', 'direction', 'mechanisticRole'],
              },
            },
          },
          required: ['overview', 'keyMechanisms', 'enrichmentResults'],
        },
        cellCommunication: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            crosstalkMechanisms: {
              type: Type.ARRAY,
              items: { type: Type.STRING },
            },
            interactions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  senderCell: { type: Type.STRING },
                  ligand: { type: Type.STRING },
                  receptor: { type: Type.STRING },
                  receiverCell: { type: Type.STRING },
                  interactionWeight: { type: Type.NUMBER },
                  signalingAxis: { type: Type.STRING },
                  pathologicalEffect: { type: Type.STRING },
                },
                required: [
                  'senderCell',
                  'ligand',
                  'receptor',
                  'receiverCell',
                  'interactionWeight',
                  'signalingAxis',
                  'pathologicalEffect',
                ],
              },
            },
          },
          required: ['overview', 'crosstalkMechanisms', 'interactions'],
        },
        explainableMl: {
          type: Type.OBJECT,
          properties: {
            overview: { type: Type.STRING },
            shapRationale: { type: Type.STRING },
            modelContext: { type: Type.STRING },
            predictedExpressionScore: {
              type: Type.NUMBER,
              description: 'Predicted ectopic lesion association / expression probability (0 to 100).',
            },
            predictedExpressionSummary: {
              type: Type.STRING,
              description: 'Concise prediction summary explaining expected transcript level or biomarker separation.',
            },
            candidateGenes: {
              type: Type.ARRAY,
              description: 'Top 5 ranked candidate genes prioritized alongside the target for experimental study.',
              items: {
                type: Type.OBJECT,
                properties: {
                  geneSymbol: { type: Type.STRING },
                  rank: { type: Type.INTEGER },
                  shapScore: { type: Type.NUMBER },
                  predictedDirection: { type: Type.STRING },
                  selectionRationale: { type: Type.STRING },
                },
                required: ['geneSymbol', 'rank', 'shapScore', 'predictedDirection', 'selectionRationale'],
              },
            },
            shapContributions: {
              type: Type.ARRAY,
              items: {
                type: Type.OBJECT,
                properties: {
                  featureName: { type: Type.STRING },
                  shapImpact: { type: Type.NUMBER },
                  direction: { type: Type.STRING },
                  biologicalInterpretation: { type: Type.STRING },
                },
                required: ['featureName', 'shapImpact', 'direction', 'biologicalInterpretation'],
              },
            },
            hypothesis: {
              type: Type.OBJECT,
              properties: {
                title: { type: Type.STRING },
                testableStatement: { type: Type.STRING },
                experimentalAssay: { type: Type.STRING },
                targetModelSystem: { type: Type.STRING },
                primaryReadouts: {
                  type: Type.ARRAY,
                  items: { type: Type.STRING },
                },
                expectedOutcome: { type: Type.STRING },
              },
              required: [
                'title',
                'testableStatement',
                'experimentalAssay',
                'targetModelSystem',
                'primaryReadouts',
                'expectedOutcome',
              ],
            },
          },
          required: [
            'overview',
            'shapRationale',
            'modelContext',
            'predictedExpressionScore',
            'predictedExpressionSummary',
            'candidateGenes',
            'shapContributions',
            'hypothesis',
          ],
        },
      },
      required: ['cellAtlas', 'geneExplorer', 'pathways', 'cellCommunication', 'explainableMl'],
    },
  },
  required: ['geneSymbol', 'fullName', 'executiveSummary', 'summaryMetrics', 'modules'],
};

function getGeminiClient() {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey || apiKey === 'MY_GEMINI_API_KEY') {
    return null;
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function extractHttpStatus(error: unknown): number {
  if (typeof error === 'object' && error !== null) {
    if ('status' in error && typeof (error as { status?: unknown }).status === 'number') {
      return (error as { status: number }).status;
    }
    if ('code' in error && typeof (error as { code?: unknown }).code === 'number') {
      return (error as { code: number }).code;
    }
  }
  const msg = error instanceof Error ? error.message : String(error ?? '');
  if (msg.includes('429') || msg.includes('RESOURCE_EXHAUSTED') || msg.toLowerCase().includes('rate limit')) {
    return 429;
  }
  if (msg.includes('403') || msg.includes('PERMISSION_DENIED')) return 403;
  if (msg.includes('400') || msg.includes('API_KEY_INVALID')) return 400;
  if (msg.includes('404') || msg.includes('NOT_FOUND')) return 404;
  return 500;
}

function extractRetryDelayMs(error: unknown): number | null {
  const msg = error instanceof Error ? error.message : String(error ?? '');
  const match = msg.match(/retry(?:\s+in|\s+after)?\s+([\d.]+)\s*s/i);
  if (match) {
    const secs = Number(match[1]);
    if (Number.isFinite(secs) && secs > 0) {
      return Math.min(10000, Math.ceil(secs * 1000) + 300);
    }
  }
  return null;
}

async function generateWithRetry<T>(fn: () => Promise<T>, maxRetries = 2): Promise<T> {
  let lastError: unknown;
  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    try {
      return await fn();
    } catch (error: unknown) {
      lastError = error;
      const status = extractHttpStatus(error);
      const isRetryable = status === 429 || status >= 500;
      if (!isRetryable || attempt === maxRetries) {
        throw error;
      }
      const hintedDelay = status === 429 ? extractRetryDelayMs(error) : null;
      const jitter = Math.floor(Math.random() * 400);
      const delayMs = hintedDelay ?? 1500 * Math.pow(2, attempt) + jitter;
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
  }
  throw lastError;
}

async function generateWithModelFallback<T>(
  primaryFn: () => Promise<T>,
  fallbackFn: () => Promise<T>
): Promise<T> {
  try {
    return await generateWithRetry(primaryFn, 1);
  } catch (error: unknown) {
    const status = extractHttpStatus(error);
    if (status === 429 || status >= 500) {
      console.warn(`Primary model hit ${status}; switching to gemini-3.1-flash-lite fallback.`);
      return await generateWithRetry(fallbackFn, 2);
    }
    throw error;
  }
}

function normalizeDirection(raw: string): GeneAnalysisDossier['summaryMetrics']['overallDirection'] {
  const lower = raw.toLowerCase();
  if (lower.includes('down')) return 'Downregulated';
  if (lower.includes('cell')) return 'Cell-Type Specific';
  if (lower.includes('context')) return 'Context-Dependent';
  return 'Upregulated';
}

function normalizeCellStatus(raw: string): CellAlterationStatus {
  const lower = raw.toLowerCase();
  if (lower.includes('hyper')) return 'Hyperactive';
  if (lower.includes('supp')) return 'Suppressed';
  if (lower.includes('homeo')) return 'Homeostatic';
  return 'Altered';
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '1mb' }));

  app.get('/api/health', (_req, res) => {
    res.json({ status: 'ok', timestamp: new Date().toISOString() });
  });

  app.post('/api/analyze', async (req, res) => {
    const rawQuery = typeof req.body?.query === 'string' ? req.body.query.trim() : '';
    const rawCompartment =
      typeof req.body?.lesionCompartment === 'string' ? req.body.lesionCompartment : 'All Compartments';
    const language: AnalysisLanguage = req.body?.language === 'ar' ? 'ar' : 'en';

    if (!rawQuery || rawQuery.length < 2) {
      res.status(400).json({ error: 'Please provide a valid gene symbol or molecular mechanism query.' });
      return;
    }

    const lesionCompartment: LesionCompartment = VALID_COMPARTMENTS.includes(
      rawCompartment as LesionCompartment
    )
      ? (rawCompartment as LesionCompartment)
      : 'All Compartments';

    const ai = getGeminiClient();
    if (!ai) {
      res.status(403).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Please set a valid Gemini API key in Settings > Secrets.',
      });
      return;
    }

    try {
      const prompt = `Analyze the following endometriosis transcriptomics target:
Target Gene / Molecular Query: "${rawQuery}"
Lesion Compartment Focus: "${lesionCompartment}"
Output Language: "${language}" (${language === 'ar' ? 'Write academic scientific prose in Arabic while keeping HGNC gene symbols and standard bioinformatics notation in English/monospace' : 'Write all fields in rigorous academic English'})

Generate the complete 5-module computational biology dashboard payload including 2D UMAP coordinates, tissue expression profiles, pathway enrichment, ligand-receptor edges, ML candidate gene ranking with SHAP explanations, and a wet-lab hypothesis.`;

      const response = await generateWithModelFallback(
        () =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: dossierSchema,
              thinkingConfig: { thinkingLevel: ThinkingLevel.MEDIUM },
            },
          }),
        () =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents: prompt,
            config: {
              systemInstruction: SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: dossierSchema,
            },
          })
      );

      const text = response.text;
      if (!text) {
        res.status(502).json({ error: 'The model returned an empty analysis payload. Please retry.' });
        return;
      }

      const parsed = JSON.parse(text) as Omit<
        GeneAnalysisDossier,
        'id' | 'query' | 'lesionCompartment' | 'language' | 'createdAt'
      >;

      const dossier: GeneAnalysisDossier = {
        id: `${parsed.geneSymbol.toUpperCase().replace(/[^A-Z0-9_-]/g, '')}-${Date.now()}`,
        query: rawQuery,
        geneSymbol: parsed.geneSymbol.trim(),
        fullName: parsed.fullName,
        lesionCompartment,
        language,
        createdAt: new Date().toISOString(),
        executiveSummary: parsed.executiveSummary,
        summaryMetrics: {
          ...parsed.summaryMetrics,
          overallDirection: normalizeDirection(parsed.summaryMetrics.overallDirection),
        },
        modules: {
          ...parsed.modules,
          cellAtlas: {
            ...parsed.modules.cellAtlas,
            populations: parsed.modules.cellAtlas.populations.map((pop) => ({
              ...pop,
              status: normalizeCellStatus(pop.status || ''),
            })),
          },
          pathways: {
            ...parsed.modules.pathways,
            enrichmentResults: parsed.modules.pathways.enrichmentResults.map((p) => ({
              ...p,
              direction: p.direction === 'Suppressed' || p.nesScore < 0 ? 'Suppressed' : 'Activated',
            })),
          },
          explainableMl: {
            ...parsed.modules.explainableMl,
            predictedExpressionScore: Math.max(
              0,
              Math.min(100, Number(parsed.modules.explainableMl.predictedExpressionScore ?? 75))
            ),
            candidateGenes: (parsed.modules.explainableMl.candidateGenes ?? []).map((cg, i) => ({
              ...cg,
              rank: cg.rank || i + 1,
              predictedDirection:
                cg.predictedDirection === 'Downregulated' ? 'Downregulated' : 'Upregulated',
            })),
            shapContributions: parsed.modules.explainableMl.shapContributions.map((s) => ({
              ...s,
              direction: s.shapImpact < 0 || s.direction === 'Protective' ? 'Protective' : 'Pro-Lesion',
            })),
          },
        },
      };

      res.json({ dossier });
    } catch (error: unknown) {
      console.error('Error in /api/analyze:', error);
      const status = extractHttpStatus(error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to synthesize bioinformatics dossier from Gemini API.';

      if (status === 403 || status === 400) {
        res.status(status).json({
          error: `Gemini API authentication or request error (${status}): ${message}. Verify your API key in Settings > Secrets.`,
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error:
            'API rate limit reached (429). Please wait a few seconds and retry, or check your API quota in Settings > Secrets.',
        });
        return;
      }
      res.status(status >= 400 ? status : 500).json({ error: message });
    }
  });

  const CHAT_SYSTEM_INSTRUCTION = `You are EndoScope AI Assistant, an expert computational biologist, endometriosis researcher, and medical science educator embedded inside the EndoScope Ai workbench.

Your role:
- Answer any scientific, clinical, cellular, transcriptomic, genetic, diagnostic, or experimental question related to endometriosis (including pathophysiology, retrograde menstruation, coelomic metaplasia, estrogen dominance, progesterone resistance, chronic inflammation, macrophage polarization, lymphangiogenesis, angiogenesis, fibrosis, ECM remodeling, single-cell RNA-seq biomarkers, spatial transcriptomics, lesion subtypes such as peritoneal, ovarian endometrioma, and deep infiltrating endometriosis, and wet-lab validation methods).
- Reply in the same language the user uses (if the user writes in Arabic—whether Modern Standard Arabic or Egyptian Arabic—respond clearly and naturally in Arabic while keeping HGNC gene symbols like LYVE1, VEGFA, ESR1 and standard molecular acronyms in English; if the user writes in English, respond in clear academic English).
- Use well-structured formatting (short paragraphs, bold key terms with **...**, and concise bullet points) so answers read cleanly inside a research chat panel.
- If the user is currently viewing a specific gene dossier in the workbench, use that context when relevant.
- If a user asks about something completely unrelated to endometriosis or biomedical research, politely clarify that you specialize in endometriosis biology and transcriptomics and invite them to ask an endometriosis-related question.
- Keep responses accurate, grounded in established endometriosis research, and include a brief note that clinical treatment decisions should always be discussed with a specialist physician when questions touch on personal medical care.`;

  app.post('/api/chat', async (req, res) => {
    const rawMessages: unknown[] = Array.isArray(req.body?.messages) ? req.body.messages : [];
    const activeGene = typeof req.body?.activeGene === 'string' ? req.body.activeGene.trim() : '';
    const activeCompartment =
      typeof req.body?.activeCompartment === 'string' ? req.body.activeCompartment.trim() : '';
    const language: AnalysisLanguage = req.body?.language === 'ar' ? 'ar' : 'en';

    const sanitizedMessages: { role: 'user' | 'assistant'; content: string }[] = rawMessages
      .filter(
        (m: unknown): m is { role: 'user' | 'assistant'; content: string } =>
          typeof m === 'object' &&
          m !== null &&
          'role' in m &&
          (m.role === 'user' || m.role === 'assistant') &&
          'content' in m &&
          typeof m.content === 'string' &&
          m.content.trim().length > 0
      )
      .slice(-16);

    if (sanitizedMessages.length === 0 || sanitizedMessages[sanitizedMessages.length - 1].role !== 'user') {
      res.status(400).json({ error: 'Please provide a valid chat message.' });
      return;
    }

    const ai = getGeminiClient();
    if (!ai) {
      res.status(403).json({
        error:
          'GEMINI_API_KEY is not configured on the server. Please set a valid Gemini API key in Settings > Secrets.',
      });
      return;
    }

    try {
      const contextPrefix = activeGene
        ? `[Workbench Context: The user currently has the ${activeGene} dashboard open${
            activeCompartment ? ` (Compartment: ${activeCompartment})` : ''
          }. UI language preference: ${language}.]\n\n`
        : `[Workbench Context: No active gene selected yet. UI language preference: ${language}.]\n\n`;

      const contents = sanitizedMessages.map((msg, idx: number) => {
        const isFirstUser = idx === 0 && msg.role === 'user';
        return {
          role: msg.role === 'assistant' ? 'model' : 'user',
          parts: [{ text: isFirstUser ? `${contextPrefix}${msg.content.trim()}` : msg.content.trim() }],
        };
      });

      const response = await generateWithModelFallback(
        () =>
          ai.models.generateContent({
            model: 'gemini-4-hydrogen',
            contents,
            config: {
              systemInstruction: CHAT_SYSTEM_INSTRUCTION,
              thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
            },
          }),
        () =>
          ai.models.generateContent({
            model: 'gemini-3.1-flash-lite',
            contents,
            config: {
              systemInstruction: CHAT_SYSTEM_INSTRUCTION,
            },
          })
      );

      const reply = response.text?.trim();
      if (!reply) {
        res.status(502).json({ error: 'The assistant returned an empty response. Please retry.' });
        return;
      }

      res.json({ reply });
    } catch (error: unknown) {
      console.error('Error in /api/chat:', error);
      const status = extractHttpStatus(error);
      const message =
        error instanceof Error
          ? error.message
          : 'Failed to generate endometriosis assistant response.';

      if (status === 403 || status === 400) {
        res.status(status).json({
          error: `Gemini API authentication or request error (${status}): ${message}. Verify your API key in Settings > Secrets.`,
        });
        return;
      }
      if (status === 429) {
        res.status(429).json({
          error:
            'API rate limit reached (429). Please wait a few seconds and click Retry, or add a billing-enabled API key in Settings > Secrets for higher quota.',
        });
        return;
      }
      res.status(status >= 400 ? status : 500).json({ error: message });
    }
  });

  if (!isProduction) {
    const { createServer: createViteServer } = await import('vite');
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distDir = path.resolve(__dirname, 'dist');
    app.use(express.static(distDir));
    app.get('*', (_req, res) => {
      const indexPath = path.join(distDir, 'index.html');
      if (fs.existsSync(indexPath)) {
        res.sendFile(indexPath);
      } else {
        res.status(404).send('Production build not found. Run npm run build first.');
      }
    });
  }

  app.listen(PORT, '0.0.0.0', () => {
    console.log(`EndoScope Ai server listening on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Fatal server startup error:', err);
  process.exit(1);
});
