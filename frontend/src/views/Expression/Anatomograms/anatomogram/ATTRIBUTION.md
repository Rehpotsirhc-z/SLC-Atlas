# Anatomogram SVGs Attribution

The three `homo_sapiens.{female,male,brain}.svg` files in this directory are
vendored from the EBI Expression Atlas **anatomogram** project and re-used here
as the anatomy figures in the Expression view's Anatomograms side rail.

- **Source:** https://github.com/ebi-gene-expression-group/anatomogram
- **Vendored from commit:** `9fcc37022cce1e2862692a5f5fbfb78572b87e67` (2019-12-12), files
  `src/svg/homo_sapiens.{female,male,brain}.svg`.
- **License of the artwork:** Creative Commons Attribution 4.0 International (CC BY 4.0),
  https://creativecommons.org/licenses/by/4.0/ — the anatomogram images are distributed under
  CC BY 4.0 (the project's *code* is Apache-2.0; only the traced SVG art is used here).

## Modifications

These files are modified copies of the originals:

- Optimized with [SVGO](https://github.com/svg/svgo) (editor metadata stripped, coordinate
  precision reduced to 3 decimals, fixed `width`/`height` dropped in favor of the `viewBox` for
  responsive scaling). The `LAYER_OUTLINE` / `LAYER_EFO` group structure, every element `id`
  (UBERON ids and named brain regions), `<title>`s, `<use>` references, and element `transform`s
  are preserved unchanged.
- Element fills/strokes are re-themed to the application palette at runtime; the source files
  ship the interactive parts as `fill:none;stroke:none`.

No changes were made to the underlying anatomical tracings.
