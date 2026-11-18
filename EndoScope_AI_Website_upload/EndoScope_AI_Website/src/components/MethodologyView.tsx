export function MethodologyView() {
  return (
    <div className="mx-auto max-w-[920px] px-6 py-8 space-y-8">
      <header className="space-y-3 border-b border-[#311C33] pb-6">
        <div className="font-mono text-xs uppercase tracking-wider text-[#F472B6]">
          Analytical Framework &amp; Standards
        </div>
        <h1 className="font-display text-2xl sm:text-3xl font-bold text-[#FAF2F7]">
          EndoScope Ai Computational Methodology
        </h1>
        <p className="text-sm text-[#A98CA0] leading-relaxed max-w-2xl">
          EndoScope Ai structures computational pathology queries into five synchronized analytical modules designed for translational endometriosis research.
        </p>
      </header>

      <div className="space-y-6">
        <section className="rounded-md border border-[#311C33] bg-[#160D17] p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
            01. Cell Atlas Integration
          </h2>
          <p className="text-sm text-[#DFCBD8] leading-relaxed">
            Resolves cellular composition across endometriotic lesions—including endometrial stromal fibroblasts, myofibroblasts, lymphatic and vascular endothelial cells, epithelial glands, perivascular cells, and infiltrating immune lineages (macrophages, uterine NK cells, T-cell subsets). Perturbation indices (0–100) and UMAP niche clusters highlight disease-altered populations.
          </p>
        </section>

        <section className="rounded-md border border-[#311C33] bg-[#160D17] p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
            02. Gene Explorer &amp; Differential Expression
          </h2>
          <p className="text-sm text-[#DFCBD8] leading-relaxed">
            Contrasts normalized expression in <span className="font-mono text-[#F472B6]">log2(CPM + 1)</span> across healthy control endometrium, patient-matched eutopic endometrium, and ectopic lesion compartments (peritoneal lesions, ovarian endometriomas, or deep infiltrating nodules). Directionality is quantified via pseudobulk/bulk <span className="font-mono text-[#EC4899]">log2FC</span> and false-discovery-adjusted significance thresholds.
          </p>
        </section>

        <section className="rounded-md border border-[#311C33] bg-[#160D17] p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
            03. Biological Pathways &amp; Functional Enrichment
          </h2>
          <p className="text-sm text-[#DFCBD8] leading-relaxed">
            Evaluates hallmark molecular axes governing endometriosis pathophysiology—chronic macrophage-driven inflammation, TGF-β/collagen fibrosis, VEGF-mediated neo-vascularization and lymphangiogenesis, estrogen hypersensitivity / progesterone resistance, and matrix metalloproteinase ECM remodeling—quantified by Normalized Enrichment Score (NES) and <span className="font-mono">-log10(FDR)</span>.
          </p>
        </section>

        <section className="rounded-md border border-[#311C33] bg-[#160D17] p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
            04. Cell-Cell Communication &amp; Ligand-Receptor Inference
          </h2>
          <p className="text-sm text-[#DFCBD8] leading-relaxed">
            Models directional sender → ligand/receptor → receiver communication edges analogous to CellChat and NicheNet workflows, isolating paracrine and autocrine feedback loops sustaining lesion survival, neuroangiogenesis, and immune evasion.
          </p>
        </section>

        <section className="rounded-md border border-[#311C33] bg-[#160D17] p-6 space-y-2">
          <h2 className="font-display text-base font-semibold text-[#FAF2F7]">
            05. Explainable ML &amp; Wet-Lab Translation
          </h2>
          <p className="text-sm text-[#DFCBD8] leading-relaxed">
            Applies SHapley Additive exPlanations (SHAP) log-odds attribution principles to rank candidate genes and explain why ensemble classifiers prioritize specific targets across disease states, translating high-importance computational features into falsifiable wet-lab perturbations (siRNA/CRISPRi knockdown, co-culture assays, flow cytometry, and multiplex immunofluorescence).
          </p>
        </section>
      </div>
    </div>
  );
}
