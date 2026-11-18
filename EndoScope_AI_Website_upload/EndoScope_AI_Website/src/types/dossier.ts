export type AnalysisLanguage = 'en' | 'ar';

export type LesionCompartment =
  | 'All Compartments'
  | 'Peritoneal Ectopic'
  | 'Ovarian Endometrioma'
  | 'Deep Infiltrating Endometriosis'
  | 'Eutopic Endometrium';

export type ExpressionDirection =
  | 'Upregulated'
  | 'Downregulated'
  | 'Cell-Type Specific'
  | 'Context-Dependent';

export type CellAlterationStatus = 'Hyperactive' | 'Suppressed' | 'Altered' | 'Homeostatic';

export interface CellAtlasItem {
  cellType: string;
  lineage: string;
  perturbationScore: number; // 0 to 100 normalized transcriptional perturbation index
  abundanceDeltaPct: number; // -50 to +50 relative shift in lesion vs healthy
  umapX: number; // -10 to +10 representative UMAP coordinate 1
  umapY: number; // -10 to +10 representative UMAP coordinate 2
  geneExpression: number; // 0 to 10 normalized expression in this cluster
  status: CellAlterationStatus;
  dysregulationSummary: string;
}

export interface TissueExpressionPoint {
  cellType: string;
  healthyCpm: number; // Normalized log2(CPM+1) expression in healthy endometrium
  eutopicCpm: number; // Normalized log2(CPM+1) in eutopic endometrium of patients
  ectopicCpm: number; // Normalized log2(CPM+1) in ectopic lesion
  log2FoldChange: number; // Ectopic vs Healthy log2FC
  adjustedPValue: string; // Formatted e.g. "1.4e-09"
}

export interface PathwayEnrichmentPoint {
  pathwayName: string;
  category: string;
  nesScore: number; // Normalized Enrichment Score (-3.5 to +3.5)
  negLog10Fdr: number; // -log10(FDR), e.g., 1.3 to 15.0
  direction: 'Activated' | 'Suppressed';
  mechanisticRole: string;
}

export interface LigandReceptorEdge {
  senderCell: string;
  ligand: string;
  receptor: string;
  receiverCell: string;
  interactionWeight: number; // 0.0 to 1.0 normalized CellChat/NicheNet interaction strength
  signalingAxis: string;
  pathologicalEffect: string;
}

export interface ShapFeatureContribution {
  featureName: string;
  shapImpact: number; // Signed SHAP value in log-odds (-0.8 to +0.8)
  direction: 'Pro-Lesion' | 'Protective';
  biologicalInterpretation: string;
}

export interface CandidateGenePrediction {
  geneSymbol: string;
  rank: number;
  shapScore: number; // 0.0 to 1.0 normalized importance
  predictedDirection: 'Upregulated' | 'Downregulated';
  selectionRationale: string;
}

export interface WetLabHypothesis {
  title: string;
  testableStatement: string;
  experimentalAssay: string;
  targetModelSystem: string;
  primaryReadouts: string[];
  expectedOutcome: string;
}

export interface GeneAnalysisDossier {
  id: string;
  query: string;
  geneSymbol: string;
  fullName: string;
  lesionCompartment: LesionCompartment;
  language: AnalysisLanguage;
  createdAt: string;
  executiveSummary: string;
  summaryMetrics: {
    overallDirection: ExpressionDirection;
    ectopicLog2FC: number;
    primaryCellPopulation: string;
    topPathway: string;
    mlFeatureRank: string;
    meanAbsShap: number;
  };
  modules: {
    cellAtlas: {
      overview: string;
      keyFindings: string[];
      populations: CellAtlasItem[];
    };
    geneExplorer: {
      overview: string;
      tissueComparisonNarrative: string;
      transcriptomicTrends: string[];
      expressionProfiles: TissueExpressionPoint[];
    };
    pathways: {
      overview: string;
      keyMechanisms: string[];
      enrichmentResults: PathwayEnrichmentPoint[];
    };
    cellCommunication: {
      overview: string;
      crosstalkMechanisms: string[];
      interactions: LigandReceptorEdge[];
    };
    explainableMl: {
      overview: string;
      shapRationale: string;
      modelContext: string;
      predictedExpressionScore: number; // 0 to 100 predicted disease association / expression probability
      predictedExpressionSummary: string;
      candidateGenes: CandidateGenePrediction[];
      shapContributions: ShapFeatureContribution[];
      hypothesis: WetLabHypothesis;
    };
  };
}

export interface AnalyzeRequest {
  query: string;
  lesionCompartment: LesionCompartment;
  language?: AnalysisLanguage;
}
