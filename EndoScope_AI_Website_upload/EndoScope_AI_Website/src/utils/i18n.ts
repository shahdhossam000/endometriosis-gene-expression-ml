import type { AnalysisLanguage } from '../types/dossier';

export interface UiCopy {
  nav: {
    dossier: string;
    compare: string;
    history: string;
    methodology: string;
    newAnalysis: string;
  };
  rail: {
    geneLabel: string;
    genePlaceholder: string;
    compartmentLabel: string;
    languageLabel: string;
    runAnalysis: string;
    compiling: string;
    referenceTargets: string;
    modulesTitle: string;
    validationError: string;
  };
  viewModes: {
    dashboard: string;
    fullDossier: string;
  };
  modules: {
    m1Title: string;
    m1Sub: string;
    m2Title: string;
    m2Sub: string;
    m3Title: string;
    m3Sub: string;
    m4Title: string;
    m4Sub: string;
    m5Title: string;
    m5Sub: string;
  };
  dashboard: {
    searchPlaceholder: string;
    analyzeBtn: string;
    ectopicFc: string;
    primaryLineage: string;
    enrichedHallmark: string;
    mlPriority: string;
    predictedLevel: string;
    rankedCandidates: string;
    wetLabTitle: string;
    expandModule: string;
    backToDashboard: string;
    exportPdf: string;
    exportComparisonPdf: string;
    exportFooterTitle: string;
    exportFooterSub: string;
  };
}

export const UI_COPY: Record<AnalysisLanguage, UiCopy> = {
  en: {
    nav: {
      dossier: 'Dashboard',
      compare: 'Compare',
      history: 'History',
      methodology: 'Methodology',
      newAnalysis: 'Add Gene',
    },
    rail: {
      geneLabel: 'Gene Symbol or Mechanism',
      genePlaceholder: 'e.g., LYVE1, VEGFA, CCL19',
      compartmentLabel: 'Lesion Compartment',
      languageLabel: 'Analysis Language',
      runAnalysis: 'Run Analysis',
      compiling: 'Compiling Dashboard',
      referenceTargets: 'Reference Targets',
      modulesTitle: 'Dashboard Modules',
      validationError: 'Enter a gene symbol or mechanism query (minimum 2 characters).',
    },
    viewModes: {
      dashboard: 'Dashboard Grid',
      fullDossier: 'Full Dossier',
    },
    modules: {
      m1Title: '01. Cell Atlas',
      m1Sub: 'Sample cell types (immune, endothelial, stromal, vascular) and disease-altered gene activity',
      m2Title: '02. Gene Explorer',
      m2Sub: 'Expression across cell types and Healthy vs. Diseased tissue comparison',
      m3Title: '03. Biological Pathways',
      m3Sub: 'Inflammation, fibrosis, neo-vascularization, hormone response, and ECM remodeling',
      m4Title: '04. Cell-Cell Communication',
      m4Sub: 'Ligand-Receptor signaling crosstalk inside the lesion microenvironment',
      m5Title: '05. Explainable ML & Hypothesis',
      m5Sub: 'Predicted level, top candidate gene ranking, SHAP rationale, and Wet-lab hypothesis',
    },
    dashboard: {
      searchPlaceholder: 'Enter gene symbol (e.g., LYVE1, VEGFA, CCL19) to build dashboard...',
      analyzeBtn: 'Analyze Gene',
      ectopicFc: 'Ectopic vs. Healthy',
      primaryLineage: 'Primary Cell Lineage',
      enrichedHallmark: 'Enriched Hallmark',
      mlPriority: 'ML Feature Priority',
      predictedLevel: 'ML Predicted Disease Association',
      rankedCandidates: 'Top Ranked Candidate Genes (SHAP)',
      wetLabTitle: 'Actionable Wet-Lab Experimental Hypothesis',
      expandModule: 'Inspect Full Module',
      backToDashboard: 'Back to Dashboard Grid',
      exportPdf: 'Export PDF Report',
      exportComparisonPdf: 'Export Comparison PDF',
      exportFooterTitle: 'Publication-Ready PDF Report',
      exportFooterSub: 'Download a structured, multi-section A4 PDF containing all five analytical modules, quantitative tables, SHAP rankings, and the wet-lab experimental protocol.',
    },
  },
  ar: {
    nav: {
      dossier: 'لوحة التحليل',
      compare: 'مقارنة الجينات',
      history: 'السجل المحفوظ',
      methodology: 'المنهجية العلمية',
      newAnalysis: 'إضافة جين',
    },
    rail: {
      geneLabel: 'اسم الجين أو المسار الجزيئي',
      genePlaceholder: 'مثال: LYVE1, VEGFA, CCL19',
      compartmentLabel: 'نطاق النسيج المصاب',
      languageLabel: 'لغة التحليل العلمي',
      runAnalysis: 'تشغيل التحليل',
      compiling: 'جاري بناء الداش بورد',
      referenceTargets: 'جينات مرجعية مقترحة',
      modulesTitle: 'Dashboard Modules',
      validationError: 'أدخل رمز جين صحيح أو استعلاماً علمياً (حرفان على الأقل).',
    },
    viewModes: {
      dashboard: 'عرض الداش بورد',
      fullDossier: 'التقرير التفصيلي',
    },
    modules: {
      m1Title: '01. خريطة الخلايا (Cell Atlas)',
      m1Sub: 'أنواع الخلايا في العينة (مناعية، بطانية، أوعية دموية) والخلايا المتغيرة في المرض',
      m2Title: '02. بحث الجينات (Gene Explorer)',
      m2Sub: 'مستوى الجين في كل نوع خلية والمقارنة بين الأنسجة السليمة والمصابة',
      m3Title: '03. المسارات الحيوية (Pathways)',
      m3Sub: 'الالتهاب، التليف، تكوين الأوعية الدموية الجديدة، واستجابة الهرمونات',
      m4Title: '04. تواصل الخلايا (Cell-Cell Communication)',
      m4Sub: 'إشارات التواصل بين الخلايا (Ligand-Receptor interactions) داخل بيئة المرض',
      m5Title: '05. توقعات الذكاء الاصطناعي القابلة للتفسير (Explainable ML)',
      m5Sub: 'توقع مستوى الجين، ترتيب الجينات المرشحة وتفسير SHAP، وبناء فرضية المعمل (Wet-lab)',
    },
    dashboard: {
      searchPlaceholder: 'اكتب اسم الجين (مثل LYVE1 أو VEGFA) لعرض الداش بورد...',
      analyzeBtn: 'تحليل الجين',
      ectopicFc: 'التغير في النسيج المصاب',
      primaryLineage: 'الخلية الأساسية المعبّرة',
      enrichedHallmark: 'المسار الحيوي الأبرز',
      mlPriority: 'أهمية الجين في النموذج',
      predictedLevel: 'توقع الذكاء الاصطناعي لمستوى الارتباط بالمرض',
      rankedCandidates: 'ترتيب أهم الجينات المرشحة للدراسة (SHAP)',
      wetLabTitle: 'الفرضية العلمية القابلة للاختبار في المعمل (Wet-lab)',
      expandModule: 'عرض التفاصيل الكاملة',
      backToDashboard: 'العودة لعرض الداش بورد',
      exportPdf: 'تصدير التقرير بصيغة PDF',
      exportComparisonPdf: 'تصدير المقارنة PDF',
      exportFooterTitle: 'تصدير التقرير العلمي النهائي (PDF)',
      exportFooterSub: 'قم بتحميل ملف PDF منسق واحترافي يحتوي على جميع المحاور الخمسة، الجداول الكمية، ترتيب الجينات عبر SHAP، وبروتوكول التجربة المعملية.',
    },
  },
};
