# Anatomogram artwork
The Expression view uses three human anatomy illustrations from the EBI
Expression Atlas anatomogram project: `homo_sapiens.female.svg`,
`homo_sapiens.male.svg`, and `homo_sapiens.brain.svg`.

- **Source:** <https://github.com/ebi-gene-expression-group/anatomogram>
- **Source revision:** `9fcc37022cce1e2862692a5f5fbfb78572b87e67`
  (2019-12-12), files `src/svg/homo_sapiens.{female,male,brain}.svg`.
- **License:** [Creative Commons Attribution 4.0 International](https://creativecommons.org/licenses/by/4.0/)

## Changes from the originals
These copies were optimized with SVGO and recolored at runtime to match the
application.  The anatomical shapes, labels, element IDs, and transforms remain
unchanged. The app uses the original IDs to connect each shape to its tissue
data.

The original browser titles are removed when a figure is displayed so the app
can show a single consistent tooltip. The embedded credit badge was replaced
with the attribution button beside each figure, which links back to the source
and license.
