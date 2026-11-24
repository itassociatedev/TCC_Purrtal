---
name: professional-pdf-generation
description: Create or modify PDFs in TCC Purrtal with accurate application data, polished branding, robust pagination, and visual verification.
---

# Professional PDF generation

Use this skill for every PDF change in this repository. Also read `project-brave-development` to preserve application data flow and authorization.

## Inspect first

- Find the route, controller/service, view/template, existing package, logo/font assets, tests, and sample/reference documents.
- Confirm the PDF library actually installed in `composer.lock` and `vendor`; do not assume an optional package is present.
- Preserve existing wording, fields, filters, authorization, and download behavior unless the request says otherwise. Keep personal and asset data dynamic.
- If references are unavailable, say so; do not claim to have compared them.

## Design system

- Use the actual company logo and brand colors where available. Establish a clear title, hierarchy, restrained palette, consistent type sizes, and generous margins.
- Align headings, labels, table columns, and signatures to a common grid. Use consistent cell padding, borders, and whitespace.
- Keep readable body text; add pages instead of shrinking type to fit. Include stable headers/footers and page numbers on multipage documents.
- Keep tables legible: column widths should fit real values, long names/serials/remarks must wrap, and row height must grow with content.
- Keep each row together when possible; repeat table headers after page breaks. Make empty sections explicit and intentional.
- Place acknowledgments and signature lines in a predictable readable position after asset content, never over data or beyond page bounds.

## Data accuracy and reliability

- Use records supplied by the real application data flow. Never add a real person's name, branch, date, or assets as template defaults.
- Preserve distinct fields such as asset tag and serial/model. Render missing optional values intentionally.
- Include all matching records; never truncate the list silently. Confirm sorting and accountability categories match the current app behavior.
- Escape text for the target PDF format, handle Unicode deliberately, and avoid malformed PDF streams/xref offsets.
- Repeated generation with identical input should produce equivalent content and layout.

## Validation

- Exercise empty, small, long/multipage, long-word, missing-value, and long-remarks cases.
- Use the actual route/data flow for sample output where a safe local database is available. Never substitute fixtures into production behavior.
- Render each PDF page to images using an available renderer, then visually inspect every page for clipping, overlap, broken borders, blank pages, logo/font failures, and misplaced signatures.
- Check extracted text or PDF structure for correct content and page count. Add focused automated tests for pagination and content regressions where suitable.
- Report exactly what was generated, rendered, inspected, and what remains unverified. Do not claim visual comparison if references were unavailable.

## Project implementation note

`App\\Services\\AccountabilityPdfService` is the current dependency-free PDF writer used by `Staff\\MyAssetController`. Improve it in place unless evidence shows it cannot meet the document requirements. `resources/js/Assets/tcc_logo.png` is the source brand mark.
