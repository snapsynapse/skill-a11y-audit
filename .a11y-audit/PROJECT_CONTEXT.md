# Accessibility Audit Project Context

## Project

- name: Skill A11y Audit documentation site
- base_url: https://skilla11y.dev
- repo_root: .
- app_root: docs

## Audit Scope

- standards: WCAG 2.1 AA
- additional_standards: WCAG 2.2 AA
- scan_mode: full
- include_routes:
  - /

## Output Configuration

- output_mode: markdown+json
- report_path: docs/accessibility/audits/audit-YYYY-MM-DD.md
- json_path: docs/accessibility/audits/audit-YYYY-MM-DD.json

## Regression Gate

- fail_on: new
- baseline_path: .a11y-audit/baseline.json
- baseline_policy: Baseline changes require explicit review; never refresh automatically in CI.

## Product Direction

- primary_user: Maintainers of large public, documentation, government, and content-heavy sites
- product_boundary: Open self-hosted accessibility regression evidence; not certification, remediation, or enterprise monitoring
- differentiator: Deterministic template-aware sampling, stable findings, and legacy-friendly CI adoption
- interoperability: Keep scripts callable by broader agent ecosystems instead of competing on agent breadth
