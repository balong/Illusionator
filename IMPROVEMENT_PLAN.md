# Illusionator Improvement Plan

This plan is ordered by leverage. The goal is not to add more features indiscriminately, but to make the generator produce stronger illusions more consistently and make the good results easier to reach, compare, and keep.

## Track 1: Stronger Composition Direction

Problem:
The app still relies on broad stochastic mixing. Even with stricter filtering, some outputs remain visually noisy or conceptually split between multiple illusion ideas.

Plan:
- Add named generation modes such as `Focused`, `Balanced`, and `Wild`.
- Create a small set of hand-tuned family compatibility rules so certain principles are encouraged or discouraged together.
- Add per-family layer caps so some families can only appear once while others may repeat.
- Introduce palette archetypes tied to principle families instead of using only generic hue randomness.

Success criteria:
- The median generated output feels more legible at first glance.
- Fewer candidates are rejected for clutter.
- Distinct modes produce meaningfully different output styles.

## Track 2: Better Candidate Ranking

Problem:
The app ranks candidates mostly from novelty, predicted appeal, and rendered quality metrics. That is useful, but it still misses more subjective traits like compositional clarity or illusion strength.

Plan:
- Add a `clarityScore` that rewards stronger figure-ground separation and fewer competing focal zones.
- Add a `cohesionScore` that rewards repeated internal structure over arbitrary variety.
- Down-rank candidates whose motion cues, geometry cues, and contrast cues conflict too evenly.
- Show these internal scores in the menu for debugging and tuning.

Success criteria:
- Top-ranked results look better than random accepted candidates.
- Liked and favorited illusions correlate more strongly with the internal ranking metrics.
- Debugging low-quality generations becomes easier.

## Track 3: Curation and Review Workflow

Problem:
Good generations are easy to lose in the stream, and there is no structured review loop for discovering what consistently works.

Plan:
- Add a gallery strip or batch review mode that shows 6 to 12 accepted candidates at once.
- Add simple labels such as `clean`, `tense`, `drifty`, `graphic`, `muddy`, and `too busy`.
- Use those labels to update preference weights in addition to likes and favorites.
- Add a `lock current palette` and `lock current family mix` option so successful directions can be explored deliberately.

Success criteria:
- Users can identify and revisit strong directions quickly.
- Preference learning improves faster because feedback is more specific.
- Evolutions from a strong candidate stay closer to what made it good.

## Track 4: Presentation and Export

Problem:
Some illusions may be strong, but the app does not present them like finished pieces. Export is functional but thin.

Plan:
- Add export presets for square, portrait, landscape, and poster aspect ratios.
- Add optional title and metadata overlays for saved pieces.
- Add a `presentation mode` that hides UI chrome and stages the illusion with more deliberate framing.
- Save a lightweight recipe alongside exports so a piece can be regenerated or evolved later.

Success criteria:
- Saved outputs feel publishable rather than just captured screenshots.
- Users can reproduce and refine exported favorites.
- The app becomes more useful as a generative art tool, not just a demo.

## Track 5: Performance and Stability

Problem:
The quality probe and candidate search are good foundations, but more scoring logic and UI features will increase runtime cost.

Plan:
- Profile generation time for fresh, evolve, and batch flows.
- Cache intermediate metrics for unchanged candidates.
- Move batch candidate evaluation into a worker if UI responsiveness drops.
- Add a lightweight smoke test script for state restore, generation, and export safety.

Success criteria:
- Interactive generation remains responsive.
- Batch generation does not visibly stall the interface.
- Future changes can be validated without manual regression hunting.

## Track 6: Illusion-Specific Deepening

Problem:
The app currently treats each family mostly as a generic drawable layer. Some families could become much stronger with family-specific craft rather than just random parameter ranges.

Plan:
- Pick the top 5 most promising families from observed output quality.
- Expand each with 2 to 3 stronger sub-variants instead of adding brand-new families.
- Add family-specific quality checks where needed, such as alignment quality for line-based illusions or spacing quality for ring-based illusions.
- Retire or quarantine any family that repeatedly underperforms.

Success criteria:
- The strongest families become consistently excellent rather than occasionally good.
- New work deepens quality instead of inflating surface variety.
- The generator develops a recognizable point of view.

## Recommended Build Order

1. Track 2: Better Candidate Ranking
2. Track 3: Curation and Review Workflow
3. Track 1: Stronger Composition Direction
4. Track 6: Illusion-Specific Deepening
5. Track 4: Presentation and Export
6. Track 5: Performance and Stability

## Next Concrete Milestones

### Milestone A
- Add `Focused`, `Balanced`, and `Wild` generation modes.
- Add debug score readouts for quality, clarity, and cohesion.

### Milestone B
- Add batch review gallery with quick labels.
- Add locks for palette and family mix.

### Milestone C
- Deepen the 5 strongest illusion families and remove weak ones aggressively.
