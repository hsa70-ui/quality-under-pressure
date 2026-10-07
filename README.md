# Quality Under Pressure

A browser-based decision simulation that accompanies the healthcare operations case **"The Infected Margin"** (XLRI, Case OM-HC-2025-04).

Players run quality and operations decisions at a hospital where the infection rate shown to the board can drift away from the real infection risk. Each choice moves visible dashboard metrics (patient safety, process control, financial health, staff trust and others) and hidden ones (true infection risk, accumulated quality debt, cost of poor quality). The results screen compares the reported rate with the true rate and generates a board memo and a faculty debrief.

## How to run

No installation, build step, login or internet connection is needed.

1. Download or clone this repository.
2. Open `index.html` in any modern browser (Chrome, Edge, Firefox, Safari).

`original/quality-under-pressure-single-file.html` is the same simulation as one self-contained file, which is the version used in class.

## Repository structure

```
index.html                 Page layout and markup
css/style.css              Styling
js/simulation.js           All simulation logic and content
original/                  Single-file version (identical behaviour)
```

### Inside `js/simulation.js`

| Section | What it does |
|---|---|
| `freshState()` | Starting values for the 8 visible metrics, the hidden metrics and the 70-point improvement budget |
| `DECISIONS` | The decision scenarios. Each option has a cost, visible effects (`v`), hidden effects (`h`), a result and the concept it teaches |
| Events | Situations triggered by the state of the game between decisions |
| `applyDelta()`, `clamp()` | Applies an option's effects and keeps metrics within range |
| `trueRatePct()` | Converts hidden true risk into a true infection rate, compared against the reported rate |
| `computeScore()`, `archetype()` | Final score and the leadership style the player's choices add up to |
| `chartSVG()` | Reported vs true infection rate chart on the results screen |
| `boardMemo()`, `facultyDebrief()` | Text outputs at the end of the game |
| Instructor view | Faculty-only view showing hidden metrics and teaching notes (password in the teaching note, TN 7.5) |

## Concepts covered

Measurement integrity and under-reporting, mistake-proofing (poka-yoke), cost of poor quality, the trade-off between schedule pressure and process control, and the gap between what a dashboard shows and what is actually happening.

## Author

Harsh Agrawal. Built as a teaching supplement to *The Infected Margin*.
