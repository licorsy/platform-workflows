'use strict';

// See licorsy/.github's docs/org-governance-adoption.md for the policy this
// file enforces mechanically.
//
// This config declares DATA, never logic. If you need a check that doesn't
// exist, it belongs in the engine (licorsy/docs-governance), not here —
// otherwise the engine ends up forked-by-config and duplication sneaks back
// in through the side door.

// Every rule accepts a `why` field, printed when it fails. Fill it with the
// REAL defect that motivated the rule. A rule with no real defect shouldn't
// exist.

module.exports = {
  engine: '^1',

  rules: {
    frontmatter: {
      // This repository's governed corpus is exactly one file. It holds two
      // Markdown files: README.md and CLAUDE.md.
      //
      //   README.md   is the rendered repository landing page, and GitHub
      //               renders frontmatter there as a visible table. It is an
      //               org-wide exception (see the exceptions register in
      //               licorsy/.github's docs/org-governance-adoption.md) and
      //               carries no frontmatter, so it declares no id either.
      //
      // No scope_dirs: there is no docs/, agents/, or commands/ here. This
      // repository publishes reusable workflows, not prose. A scope pointing
      // at directories that do not exist would be a claim about a corpus this
      // repository does not have.
      scope_dirs: [],
      root_files: ['CLAUDE.md'],
      exclude_prefixes: [],
      id_only_sources: [],
      // The full org schema, matching the corpus this file governs. CLAUDE.md
      // is scaffolded carrying all eight fields, so requiring them costs
      // nothing and catches a scaffold that arrives stripped.
      required: ['title', 'doc_type', 'description', 'status', 'version', 'created', 'updated', 'language'],
      status_enum: ['draft', 'active', 'deprecated', 'archived'],
      doc_type_enum: [
        'instruction', 'manual', 'prompt', 'template', 'tool-catalog',
        'governance', 'adr', 'status-artifact', 'product-doc', 'spec-kit-artifact',
      ],
      date_fields: ['created', 'updated'],
      why: 'the schema is what makes the corpus machine-enumerable org-wide; a '
        + 'repository small enough to skip it is exactly where the exception '
        + 'starts spreading',
    },

    'internal-links': {
      // prunes by directory NAME, at any depth
      exclude_dir_names: ['.git', 'node_modules', '.vscode', 'local-notes'],
      skip_link_patterns: [],
      why: 'README.md is the interface for every consuming repository — each '
        + 'reusable workflow is documented by a `uses:` snippet that has to '
        + 'match a real path, and a broken cross-reference here breaks callers, '
        + 'not just readers',
    },

    'changelog-retention': {
      // Same corpus as `frontmatter`. No document here keeps a body changelog
      // today, so the rule is a no-op — declared anyway so it applies the
      // moment one does, which is the only time the cap matters.
      scope_dirs: [],
      root_files: ['CLAUDE.md'],
      exclude_prefixes: [],
      exclude_files: [],
      marker: 'Changelog:',
      max_entries: 3,
      why: 'unbounded in-body changelogs push the real history out of reach; the '
        + 'newest three belong in the file, the rest belongs to `git log --follow`',
    },

    'version-bump': {
      // CLAUDE.md carries `version:`, so editing it without bumping is a
      // detectable defect rather than a matter of memory.
      enabled: true,
    },

    // ---- Phase 2+ content rules ----
    // Deliberately inert. Each exists to pin a fact that has ALREADY drifted
    // here; adding entries speculatively is how a config turns into logic.
    // Nothing has drifted in this repository yet — it has one governed
    // document and no restated facts to keep in sync.
  },
};
