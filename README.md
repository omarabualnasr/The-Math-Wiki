# Mathematics Wiki

A responsive, monochrome mathematics knowledge library built with React, TypeScript and Vite. The application is designed as a static-first site for GitHub Pages, with local browser drafts and repository-backed published article content.

## Requirements

- Node.js 20.19+ (Node.js 22+ recommended)
- npm 10+

## Run locally

```bash
npm install
npm run dev
```

Open the local URL printed by Vite.

## Validate and build

```bash
npm run test:smoke
npm run test:contracts
npm run test:authoring
npm run test:math-engine
npm run test:graph-tools
npm run test:learning
npm run test:search
npm run test:workspace
npm run test:offline
npm run test:integration
npm run typecheck
npm run build
npm run preview
```

The production build is written to `dist/`.

## Deploy to GitHub Pages

1. Create a GitHub repository and add the project files.
2. Push the default branch as `main`.
3. Open **Settings → Pages** in the repository.
4. Under **Build and deployment**, select **GitHub Actions** as the source.
5. Open the **Actions** tab and confirm that **Deploy to GitHub Pages** succeeds.
6. The deployed address appears in the workflow deployment summary and in **Settings → Pages**.

The project uses `HashRouter` and relative Vite asset paths so repository project URLs work without server-side route rewrites. The GitHub Actions workflow runs the release smoke checks and storage/data contract tests before the TypeScript/Vite build.

## Creating and publishing articles

1. Open **Create Page** in the application.
2. Enter the title, branch, level, difficulty, aliases and summary.
3. Add content blocks and use the up/down controls to reorder them.
4. Drafts autosave in the current browser. Open **My Pages** to reopen, preview, export or delete them.
5. Choose **Export JSON**. The exported file is a publish-ready article record.
6. Add that JSON file to `src/data/pages/` in the repository. Keep one unique JSON filename per article.
7. Commit and push the change. Vite automatically includes every `*.json` file in `src/data/pages/` in the site build.

The browser cannot write files directly into a GitHub repository. Exporting JSON is the safe publishing boundary for this static GitHub Pages architecture. Uploaded images smaller than 1 MB are embedded in the exported article JSON; alternatively, put an image in `public/images/` and reference it with a path such as `images/diagram.png`. Never place a private GitHub token in the client application.

## Article content format

Article records use schema version 1, with stable block IDs. Supported blocks:

- Text and definition
- LaTeX equations (KaTeX rendering)
- Images with alternative text and captions
- YouTube and Vimeo embeds, plus external video links
- Interactive function graphs (arithmetic expressions using `x`)
- Worked examples
- Tables
- Exercises with optional hints and answers

To publish a new article without the editor, add a schema-version-1 JSON file to `src/data/pages/`. The app discovers these files during the Vite build.

## Current scope

### Pass 1 — Foundation

- Responsive shell and navigation
- Black, white and neutral-gray visual system
- Light and dark appearance, persisted locally
- Home page and information pages
- 21 top-level mathematics branches and their topic entries
- Branch/topic catalogue search and Under Development states
- GitHub Pages Actions workflow

### Pass 2 — Article engine and authoring

- Versioned article schema and JSON-backed content
- Complete sample article: **Sum**
- Article metadata: title, level, difficulty, also-known-as, branch and summary
- Block renderer for text, video, image, LaTeX, graphs, definitions, examples, tables and exercises
- Article section navigation and deep links to blocks
- In-app article creation and editing
- Add, remove and reorder content blocks
- Local autosaved drafts and My Pages management
- Article preview, JSON import and JSON export
- Command search across article titles, aliases, headings and block content

## Storage and deployment notes

- Published articles are stored in the repository under `src/data/pages/`.
- Personal drafts are stored in browser local storage. They are not synchronized between devices and are not automatically published.
- The static site has no server-side account system or private database.
- Imported article files are local drafts until exported/published through the repository workflow.
- Google Fonts are used when network access is available, with system font fallbacks.
- The interface does not display an app logo/name, creator biography or copyright notice.

## Pass 3 — Reading system and navigation

Pass 3 adds the first functional reading and library tools:

- **Bookmarks:** saved article IDs are stored in this browser and reflected in the Bookmarks page.
- **Article actions:** Download PDF (opens the browser print dialog so the reader can choose Save as PDF), Bookmark, Copy article, Share and Split View.
- **Block actions:** each article block can be copied independently. Equations copy their LaTeX source; tables copy as tab-separated text.
- **Share fallback:** browsers with the Web Share API open the native share sheet; other browsers copy the article URL.
- **Split View:** opens two available articles in independent, scrollable panes. A second article must exist in the published repository or local drafts before the right pane can display one.
- **Reading width:** Shrink, Normal and Wide settings persist in local storage and affect article layout on desktop.
- **Command bar:** includes navigation to Bookmarks, Settings, Split View and My Pages. Existing article-block search is retained.

### Run locally

```bash
npm install
npm run dev
```

### Exporting an article as PDF

Open an article and select **Download PDF**. The browser print dialog opens; choose **Save as PDF** as the destination. The print stylesheet hides application navigation and action controls and prints the article with its mathematics and figures.

### Local-only data

Bookmarks and reading-width preferences are stored in the current browser. They do not synchronize across devices. The native share sheet may depend on browser and operating-system support.

### Pass 3 verification note

The Pass 3 source files were parsed with the TypeScript compiler API, the article JSON was parsed successfully, and the global CSS brace balance was checked. A full `npm run typecheck` / `npm run build` could not be completed in the current build environment because npm registry DNS resolution failed (`EAI_AGAIN registry.npmjs.org`), and the project dependencies are not installed in this checkout. Run `npm install` and then `npm run build` locally or in GitHub Actions to perform the dependency-backed verification.

## Pass 4 — Math Playground and Symbols Library

Pass 4 implements the first functional mathematics workspace and symbol reference:

- **Scientific calculator:** evaluates real-valued mathematical expressions, supports basic operations, powers, roots, factorials, trigonometric functions, inverse trigonometric functions, logarithms, common constants, an `ans` value, DEG/RAD mode and a locally stored calculation history.
- **Context-sensitive scientific keyboard:** appears when the calculator, graph expression or custom-function table input is focused; provides basic operators, functions and constants and inserts at the current cursor position.
- **Geometry and shapes:** click-to-construct points, infinite lines, segments, circles, triangles and rectangles on a coordinate plane. Constructions are saved in the current browser and can be deleted individually or cleared.
- **Math tables:** generate multiplication, addition, subtraction and division grids, plus square, cube, power, prime-number, Fibonacci and custom-function tables. Tables can be copied as tab-separated data.
- **Math graphs:** plot multiple functions of `x`, change the horizontal viewing range, zoom, and click the graph to inspect x and y values. Function expressions use a constrained mathematical evaluator and real-valued plotting.
- **Math Symbols Library:** searchable symbol catalogue with categories, descriptions, LaTeX, Unicode values, copy actions and individual transparent-background PNG export.
- **Complete symbol collection:** creates a ZIP archive containing individual symbol PNGs and a `symbols.json` metadata catalogue. The ZIP writer is implemented in the app without another runtime dependency.

### Pass 4 storage and runtime notes

- Calculator history, angle mode and geometry constructions are stored locally in the browser. They are not synchronized between devices.
- The scientific keyboard is shown on demand when a supported mathematical input is focused; it can be closed independently.
- The calculator and graphing tools use the already-declared `mathjs` dependency. They do not execute arbitrary JavaScript entered into an expression field; accepted variable and function names are explicitly restricted.
- The graph workspace plots real-valued functions. Complex-valued functions and advanced implicit or 3D plotting are outside this pass.
- PNG rendering uses the fonts available on the user's device. Mathematical glyph coverage can differ slightly between operating systems.
- The full set is exported as a ZIP of PNG files plus metadata; the ZIP is stored without compression to keep export dependency-free.

### Pass 4 verification note

All TypeScript and TSX source files were parsed successfully with the TypeScript compiler API. Dependency-backed type checking and the Vite production build remain unavailable in this environment because `node_modules` is empty and npm registry access is failing. Run `npm install`, `npm run typecheck` and `npm run build` on a connected machine or through GitHub Actions before publishing.


## Pass 5 — Annotation and learning system

Pass 5 adds personal reading annotations, article drawing, reading accessibility and article-derived practice:

- **Text selection actions:** select text inside an article block to open a compact Copy / Highlight / Add note toolbar. Highlights support neutral gray plus red, blue, green and yellow user-mark colors; the application interface itself remains monochrome.
- **Persistent highlights and notes:** saved ranges are keyed by article ID and block ID and include the selected quotation plus surrounding context. Notes receive a dotted underline marker and appear in a small popover when the marked passage is revisited. Notes can be edited or removed from that popover, which opens on pointer hover and on tap/click for touch devices. When an article changes, a unique quotation can be re-anchored; ambiguous or missing text is left unmarked instead of being attached to an unrelated passage.
- **On-page drawing:** an overlay canvas covers the article content. Pen and eraser tools support seven ink choices, four stroke sizes, undo, redo, clear and automatic local saving. Stroke coordinates are normalized to the article canvas so drawings remain aligned when the reading width or device size changes; undo history is bounded to limit memory use. `Save PNG` exports the article content with its drawing layer using `html-to-image`; external resources that cannot be captured may cause the export to show a retry message.
- **Read aloud:** uses the browser's Web Speech API with play, pause, resume, stop, voice and speed controls. Common LaTeX commands are converted to spoken phrases before reading. Actual voices depend on the operating system and browser.
- **Reading Focus Guide:** optional horizontal pointer-following guide for article reading areas. It is suppressed for touch pointer events.
- **Reading preferences:** font family, font size, high contrast, focus guide, theme and content width are saved locally in this browser.
- **Quiz creation:** generates short-answer questions from article exercises, worked examples and definitions, then checks responses and reports a score. The expected answer is shown after submission.
- **Worksheet creation:** creates a printable question sheet with writing space. The answer key is collapsed separately on screen and can be printed/exported independently from the worksheet.
- **Right-click behavior:** the browser context menu is suppressed throughout the application workspace.

### Pass 5 data and browser notes

- Personal text annotations and drawing strokes are stored in the current browser's local storage. They are not included in article JSON exports and do not publish with repository-backed content.
- Text range highlighting uses the CSS Custom Highlight API available in current mainstream browsers. Browsers without this API may retain the saved data but will not paint the highlight until opened in a supporting browser.
- Drawing PNG export uses `html-to-image` as an additional dependency. It captures the article content region and the drawing canvas; external media, cross-origin images or unsupported embedded resources may not be captured by the browser.
- Read aloud requires the browser's Speech Synthesis API. Voice availability varies by platform; the feature reports when the API is unavailable.
- Quiz scoring is intentionally transparent and currently targets short answers, including numeric answers. It is not an adaptive assessment engine and does not generate multiple-choice distractors in this pass.
- Worksheet and quiz questions are derived from authored examples, exercises and definitions. Articles should include these structured blocks to produce richer study sets.

### Pass 5 verification note

The source was parsed with the TypeScript compiler API. The JSON content record was parsed and the stylesheet brace balance was checked. A dependency-backed TypeScript check and Vite production build could not be completed in this workspace because npm dependency installation timed out. `html-to-image` has been added to `package.json`; run `npm install`, `npm run typecheck` and `npm run build` in a network-connected environment before deployment.


## Pass 6 — Release hardening and final scope

Pass 6 prepares the first release and makes planned future features visible without pretending they are implemented:

- **Browser storage protection:** theme, reading preferences, drafts, bookmarks, calculator history, geometry and annotations use guarded storage access. The application can still open when local storage is blocked; operations that require saving report a failure instead of silently claiming success. Article JSON export works without a local draft save, so work can still be downloaded when browser storage is unavailable.
- **Render error fallback:** an application-level error boundary displays a reload action if a component throws during rendering.
- **Annotation history refinement:** erasing one or more strokes is treated as a single undoable action.
- **Visible future reading views:** Page is the active article view. Video and Book are present but disabled and marked Soon.
- **Visible future article tools:** Mind Linker and Compare Mode are present but disabled and marked Soon.
- **Visible future playground tools:** Math Toolkit for Programming, Math to Code, Math Design on Figma, and Graphs and Equations to Embed Outside are listed as disabled Soon items.
- **GitHub Pages workflow:** configures Pages, installs dependencies, runs release smoke checks, type-checks/builds, uploads the static artifact and deploys it.
- **Dependency-free release smoke test:** checks the 21 top-level branches, 246 topic entries, unique branch/topic IDs, article JSON validity, unique block IDs, HashRouter routing, relative Vite paths, GitHub Actions deployment wiring, guarded settings storage and Soon-feature visibility.

### Release validation

Run:

```bash
npm install
npm run test:smoke
npm run typecheck
npm run build
npm run preview
```

`npm run test:smoke` uses only Node.js built-ins and does not need npm packages. `npm run typecheck` and `npm run build` require the dependencies from `package.json`.

### First-release boundaries and known limitations

- **Static publishing:** the site is hosted on GitHub Pages. Article JSON files are published from the repository; in-app drafts are local to one browser until exported and committed. There is no backend account system or cross-device synchronization in this release.
- **Browser-local data:** bookmarks, notes, highlights, drawing strokes, calculator history, geometry and preferences are stored in local storage. Clearing browser site data removes these local records. Export important article drafts before changing devices or clearing site data.
- **Annotations:** saved text annotation overlays depend on browser support for the CSS Custom Highlight API. Note data is retained locally even if the browser cannot visually paint a highlight.
- **PNG capture:** drawing export uses `html-to-image`; third-party, cross-origin or protected media may not be included in an exported PNG.
- **Read aloud:** speech is provided by the browser/operating system and available voices differ by device.
- **Math tools:** graph expressions and calculations are limited to real-valued supported expressions; the playground is not a full computer algebra system or a complete dynamic geometry system yet.
- **Quizzes:** the current assessment generator uses article examples, exercises and definitions to build short-answer questions. It is not adaptive and does not invent unsupported solution steps.
- **Soon items:** Account, sound effects, Mind Linker, Compare Mode, Video view, Book view, programming toolkit, Math to Code, Figma integration and external graph/equation embedding are disabled placeholders.
- **English only:** the interface currently uses English. The content schema is language-neutral in design but translation management is not implemented.

### GitHub Pages release checklist

1. Push the repository's default branch as `main`, or update the workflow branch filter to match the actual default branch.
2. In GitHub repository settings, set Pages deployment source to **GitHub Actions**.
3. Wait for the `Deploy to GitHub Pages` workflow to pass both the smoke checks and the production build.
4. Open the deployment URL from the workflow summary and test article navigation, refresh, editor draft saving and mobile layout.
5. Export any locally created drafts before clearing browser data; local drafts do not automatically appear on the public site.

Do not mark the first release as production-verified until a connected CI run completes `npm run typecheck` and `npm run build` successfully and the deployed URL has been checked in a browser.

### Pass 6 verification record

In the current build workspace, `npm run test:smoke` passed. The global TypeScript parser successfully parsed all 34 TypeScript/TSX source files, relative source imports resolved, browser-storage helper behavior passed available/blocked-storage contract checks, CSS delimiters balanced, and all published article JSON records parsed. `npm run typecheck` and `npm run build` were attempted but could not complete because this workspace has no installed React/Vite dependencies and npm installation could not reach the npm registry. The production build and visual browser QA therefore remain unverified; the GitHub Actions workflow will run the dependency-backed checks after the repository is pushed to GitHub.


## Second development stage — Pass 1: Stabilization and architecture

The stabilization pass strengthens the data layer without changing the visual system or implementing any features currently marked Soon:

- **Shared storage helpers:** safe JSON reads/writes, temporary local-storage availability probing and optional browser-origin quota estimates.
- **Non-destructive storage migration:** legacy `mw-*` and `mw:*` settings/playground keys are copied to the canonical `math-wiki:*` namespace. Source keys are retained, destination values are not overwritten, and a schema marker advances only when the migration finishes.
- **Strict article validation:** imported and locally saved articles are checked for supported schema version, required metadata, valid timestamps, unique block IDs, consistent table row widths and finite, increasing graph ranges.
- **Draft preservation:** updating or deleting a valid draft no longer silently drops unrelated malformed legacy records. My Pages reports records that cannot be opened instead of removing them.
- **Published article protection:** local drafts cannot claim an existing published sample article ID or duplicate another article's URL slug.
- **Save feedback:** the editor displays the actual validation or storage error instead of only showing a generic unsaved state.
- **Storage diagnostics:** Settings includes a local write-access check and optional browser-origin storage estimate.
- **Data contract tests:** `npm run test:contracts` compiles and tests strict article validation plus non-destructive, idempotent storage migrations.

Run the dependency-free release checks and the TypeScript-backed contract tests with:

```bash
npm run test:smoke
npm run test:contracts
npm run typecheck
npm run build
```

The contract tests use the TypeScript compiler included in the project's development dependencies. The full React/Vite build still requires a successful `npm install`.


## Second development stage — Pass 2: Advanced wiki and publishing engine

Pass 2 expands the existing article format and editor. The article schema remains at version `1` because these block extensions are additive and existing article JSON remains valid. New block types are validated before local saving or publishing.

### Extended article blocks

- **Academic statements:** theorem, lemma, corollary, proposition and axiom blocks support statement text, optional labels and attribution. Each statement type receives its own article-local numbering sequence.
- **Proofs:** proof blocks can refer to a labelled statement, include proof content and display a conclusion marker.
- **Numbered equations:** display LaTeX blocks can be labelled and numbered. Numbering is deterministic within the article. A labelled but unnumbered equation remains referenceable as “Equation” without receiving an automatic number.
- **Cross-references:** reference blocks and proof targets resolve labels to article block anchors. Duplicate labels, missing targets and unsafe labels are reported by publishing preflight.
- **Explanatory components:** callouts, two-column comparisons, ordered method steps and expandable disclosures provide richer educational structure.
- **Source and resource blocks:** citations and web/PDF/download resources include URL validation. Only HTTP(S), local relative paths and in-page anchors are accepted by the publishing preflight.
- **Interactive parameter blocks:** a reader can adjust one bounded parameter and see the constrained math expression recalculate. The expression evaluator uses the existing function/name allowlist; this is not a general-purpose code execution surface.

### Editor improvements

- **Article templates:** Mathematical concept, theorem and proof, formula reference, worked problem, mathematical method, concept comparison and interactive lesson templates provide starter structures.
- **Block editing:** add, edit, duplicate, delete, multi-select, bulk duplicate/delete, move up/down and drag to reorder. The block editor supports the full extended block catalogue.
- **Undo and redo:** in-editor history supports up to 50 actions per active editing session. `Ctrl/Cmd + Z`, `Ctrl/Cmd + Shift + Z`, `Ctrl/Cmd + Y` and `Ctrl/Cmd + S` are supported by the editor.
- **Equation composer:** visual insertion controls for fractions, roots, integrals, summations, limits, matrices, cases and products, with a live rendered preview, optional reference label and numbering toggle.
- **Revision history:** up to 12 recent valid snapshots are stored locally per article. Snapshots larger than 300 KB are skipped to avoid filling browser storage. Restoring a revision places it into the current undo history.
- **Article media manager:** manage image blocks attached to the current article, including asset name, alternative text, caption, replacement and removal. Uploaded PNG, JPEG, WebP and GIF files are limited to 1 MB and embedded as data URLs in the article JSON export. This is article-scoped asset management, not yet a global media library.
- **Publishing preflight:** checks article structure, empty content blocks, missing summaries, image alternative text, unsafe resource URLs, invalid video links, duplicate labels and unresolved proof/cross-reference targets. Errors block Ready/export; warnings are actionable but non-blocking.
- **Published article safety:** repository-published articles open as an independent editable draft copy with a new article ID, unique slug and new block IDs. The source article remains unchanged.
- **Multi-block movement:** selected blocks can be moved up or down together while preserving their relative order.
- **Unsaved-change protection:** the editor warns before closing or refreshing with unsaved changes; the in-app back action attempts to save before leaving.
- **Library visibility:** branch pages list repository-published articles only. Local drafts and Ready items remain in My Pages and are not presented as public articles.

### Publishing workflow

- Drafts remain browser-local until exported.
- Marking an article Ready is a local workflow state; it does not publish to GitHub by itself.
- Exporting a publish-ready JSON file changes its exported status to `published`.
- Add the exported JSON to `src/data/pages/` and commit it to the repository. The static content loader discovers JSON article files at build time.
- The public GitHub Pages application contains no publishing token and does not directly push commits to the repository.

### Authoring contract tests

Run all dependency-light checks with:

```bash
npm run test:smoke
npm run test:contracts
npm run test:authoring
```

`test:authoring` compiles the pure article validation/reference/publishing modules with strict TypeScript and checks optional draft summaries, every new academic/reference block family, equation and theorem numbering, label security, dangling references, parameter validation and unsafe resource links. The GitHub Actions deployment workflow runs this test before the production build.

### Pass 2 verification note

The pure article, validation, reference-index, publishing and revision-history modules pass a strict standalone TypeScript check. The release smoke test, storage contracts and authoring contracts pass. All changed TSX files are syntax-checked separately. A full application `npm run typecheck` / `npm run build` still requires the React, Vite, KaTeX, MathJS and type packages. Installing those dependencies timed out in this workspace and the offline npm cache does not contain them; therefore the complete app build and browser interaction QA remain unverified until GitHub Actions or a network-connected local environment completes the build.


## Second development stage — Pass 3: Advanced Mathematics Engine

Pass 3 adds a unified mathematics engine workspace to Math Playground. The workspace has four sections:

- **Algebra:** simplify supported symbolic expressions with `mathjs`, expand and factor supported rational-root polynomials, differentiate supported functions, integrate polynomials, and solve single-variable polynomial equations. Linear and quadratic equations use algebraic methods; higher-degree real roots use numerical root isolation and bisection.
- **Calculus:** symbolic differentiation, polynomial antiderivatives, numerical definite integration using composite Simpson's rule, and sampled one-sided/two-sided limit estimates. Numerical results are explicitly labeled as approximations.
- **Matrices:** parse rectangular matrices, calculate determinants, inverses, transposes and ranks, compute reduced row-echelon form, add and multiply matrices, and solve linear systems when a unique solution exists.
- **Statistics:** calculate mean, median, mode, range, population/sample variance and standard deviation, permutations, combinations, binomial point probabilities, and least-squares linear regression with correlation and R-squared.

### Mathematics engine boundaries

- Polynomial expansion, antiderivatives and equation parsing use a small dependency-free parser that requires explicit multiplication (for example, `3*x`) and supports non-negative integer powers through 12. Polynomial division is supported only by a non-zero constant.
- The equation solver currently handles one-variable polynomial equations with real roots. It does not return complex roots or claim to solve arbitrary transcendental equations. Degree 1 and 2 use linear/quadratic formula methods; higher-degree real roots are approximations and can be numerically difficult for ill-conditioned or tightly clustered roots.
- Symbolic differentiation and simplification use the declared `mathjs` dependency and a restricted identifier allowlist. They are not a general-purpose theorem prover.
- Indefinite symbolic integration is currently limited to polynomial functions. Definite integration is a numerical Simpson estimate over finite bounds and may be inaccurate near discontinuities or singularities.
- Limits are numerical samples approaching a finite point. They are exploratory estimates, not formal limit proofs, and oscillatory/singular functions may be classified as indeterminate.
- Matrix and statistics calculations use finite JavaScript numbers. Exact rational, arbitrary-precision and interval arithmetic are not included in this pass.
- The Math Engine is a new Math Playground tab; the existing Calculator, Geometry, Tables and Graphs tools remain available. The previously designated Soon features remain disabled and unchanged.

### Mathematics engine validation

Run the new dependency-free engine contracts and existing release checks:

```bash
npm run test:math-engine
npm run test:smoke
npm run test:contracts
npm run test:authoring
npm run typecheck
npm run build
```

The math-engine contract script compiles and executes the polynomial, matrix and statistics modules using the installed TypeScript compiler. It verifies polynomial parsing, expansion/factorization, derivatives/antiderivatives, real roots, identity/contradiction detection, matrix operations, unique linear-system solutions, descriptive statistics, combinatorics, binomial probability and regression. The symbolic simplification/differentiation integration uses `mathjs` and must additionally be covered by the full dependency-backed build and browser testing.

### Pass 3 verification note

The dependency-free math engine contracts, release smoke tests, storage contracts and article-authoring contracts passed in the current workspace. All 44 TypeScript/TSX files parsed successfully. The five new engine modules and Math Engine UI were also checked under strict TypeScript settings using temporary ambient declarations for the missing external packages; this is a focused source check, not a replacement for the actual project type-check. `npm install` timed out because the npm registry was unreachable, so `npm run typecheck`, `npm run build` and interactive browser QA remain pending. Run the full commands in a network-connected environment or through GitHub Actions before treating this pass as production-verified.

## Second development stage — Pass 4: Professional graphing and geometry studio

Pass 4 expands the existing Math Playground graph and geometry workspaces while keeping the same monochrome visual system. No features previously marked **Soon** are implemented or changed.

### Advanced graphing

- **Cartesian functions:** plot and compare multiple real-valued functions of `x` over a configurable interval.
- **Polar graphs:** plot `r(θ)` expressions, using `t` as the parameter variable in the input (for example `2 + sin(3*t)`). The plotted curve is converted to Cartesian coordinates for display.
- **Parametric curves:** enter independent `x(t)` and `y(t)` expressions and adjust the parameter interval.
- **Implicit contours:** plot approximate zero contours `F(x, y) = 0` using a sampled marching-squares grid. This is a numerical contour, not an exact symbolic solution.
- **Numerical function analysis:** estimate roots, local extrema, derivative at the inspected x-coordinate, minimum/maximum sampled values and signed area over the selected interval. Tangent and area overlays can be toggled. These are estimates and may miss narrow features, discontinuities or closely spaced roots.
- **3D surfaces:** explore `z = f(x, y)` through a sampled wireframe with azimuth, elevation, zoom, mesh resolution and independent x/y ranges. Presets include a paraboloid, saddle, ripple, sine surface and saddle wave. The current renderer uses a projected SVG wireframe rather than a WebGL renderer; it supports visual exploration but is not intended for high-density scientific visualization.
- **Graph export:** 3D surfaces can be exported as PNG using the existing `html-to-image` dependency.

### Dynamic geometry

- Select and drag free points on the coordinate plane.
- Add midpoint, perpendicular-bisector, angle-bisector, parallel-line, perpendicular-line and circumcircle constructions by selecting existing free points in the required order.
- Advanced constructions retain references to their source points, so they recalculate when those points move.
- Existing point, line, segment, circle, triangle and rectangle creation remains available.
- Triangle area/perimeter, rectangle area/perimeter, segment length and circle radius are shown in the construction list.
- Constructions remain stored locally in the current browser. PNG export captures the geometry plane.

### Graph and geometry engine boundaries

The pure TypeScript `graphEngine.ts` module contains reusable sampling and analysis functions. It receives an evaluator function, which allows engine contracts to run without loading the browser UI. `geometryEngine.ts` contains geometric measurements and construction algorithms independently of React. Both modules validate finite ranges and report invalid or degenerate constructions rather than returning fabricated geometry.

The first 3D renderer uses a software-projected wireframe. It does not include surface shading, WebGL acceleration, arbitrary parametric surfaces, 3D implicit surfaces or complex-valued graphing. Geometry constructions currently depend on user-created free points; automatic constraint solving and dragging of every derived object are not part of this pass.

### Pass 4 validation

Run:

```bash
npm run test:graph-tools
npm run test:math-engine
npm run test:smoke
npm run test:contracts
npm run test:authoring
npm run typecheck
npm run build
```

`test:graph-tools` compiles the pure graph/geometry engines with strict TypeScript and checks Cartesian, polar, parametric and implicit sampling, numerical function analysis, 3D surface sampling/projection, geometric constructions, degeneracy handling and measurements. The GitHub Actions workflow runs this test before the full application build. Run the dependency-backed type-check and production build on GitHub Actions or a connected local machine before treating this pass as production-verified.

#### Pass 4 implementation refinements

The graphing workspace also includes a **Mathematical Visualizations** area with an interactive unit circle, a tangent/derivative explorer, a definite-integral area explorer and finite sequence plots (natural, square, harmonic, geometric and Fibonacci sequences). The geometry workspace includes origin-based translation, rotation, reflection across either axis and scaling; each transformation creates a separate copy so the original construction is preserved.

The graph engine validates all sampling ranges, resolutions, sample counts and projection inputs before work begins. The area-between-curves helper returns a non-negative geometric area regardless of the order in which bounds are supplied. The graph contract suite covers these boundaries and the geometry transformation calculations in addition to the earlier sampling and construction tests.

The GitHub Actions workflow runs the graph/geometry contract suite once before the full build. The projected 3D wireframe remains a lightweight SVG renderer; it is an exploration tool, not a high-performance WebGL surface renderer. Numerical intersections, roots, extrema and area estimates remain approximations and should not be treated as symbolic proofs.

## Second-stage Pass 5 — Intelligent Learning System

The Learning Center adds a local learning history and spaced-repetition flashcard workspace. Article quizzes, timed exams and worksheets share a question generator. Arithmetic articles can include generated numerical variants; other articles use authored exercises, examples, definitions, theorem statements and supported formula prompts rather than unrelated generic arithmetic questions.

Learning data is stored in IndexedDB when available, with a guarded local-storage fallback. It is local to the current browser and is not synchronized to an account or another device. Quiz and exam attempts store per-question results for accuracy and mistake review. Flashcards are generated from supported article blocks and scheduled with Again / Hard / Good / Easy recall ratings. Numerical and polynomial-equivalence checking is limited to the supported expression grammar; text-answer scoring uses a keyword coverage heuristic and should be treated as practice feedback, not formal grading.

New verification command: `npm run test:learning`.


## Second-stage Pass 6 — Advanced Search & Knowledge Discovery

The command palette now uses a reusable search index across the mathematics catalogue and local/published article data. It indexes branch names and descriptions, branch topics, article titles and aliases, summaries, individual article blocks, LaTeX source, symbol names/Unicode/aliases and navigation actions. Block matches deep-link to the matching article block.

Supported query operators (combine them in one query):

```text
branch:algebra
level:university
difficulty:easy
type:formula
branch:"probability and statistics" type:theorem
"associative property"
```

`type:` supports `article`, `block`, `branch`, `topic`, `symbol`, `formula`, `equation`, `definition`, `theorem`, `lemma`, `corollary`, `proposition`, `axiom`, `exercise`, `worked-example` and other indexed article block types. Search uses weighted title/alias/body relevance, quoted phrase matching, short contextual snippets, spelling suggestions and a keyboard-navigable result list. Recent searches are stored locally (up to eight entries) and can be cleared from the command palette. Search indexing is rebuilt when the palette opens, so articles saved while editing become discoverable on the next open.

New verification command: `npm run test:search`. GitHub Actions runs the search contracts alongside the existing storage, article authoring, math engine, graphing, learning and release smoke tests before the production build.


## Second-stage Pass 7 — Personal Workspace & Offline Experience

Pass 7 adds a local personal workspace without introducing accounts, cloud synchronization or a backend. It is designed to work on a static GitHub Pages deployment.

### Personal Workspace

Open **Personal Workspace** from the navigation to:

- Create and delete personal article collections and reading lists.
- Add published articles or local drafts to lists. Lists store article IDs and do not move or republish the original article.
- Save named calculator sessions, including the current expression, result, angle mode and recent calculation history.
- Save named graph sessions, including Cartesian/polar/parametric/implicit settings, displayed functions and inspection/analysis settings.
- Save named 3D surface sessions with their equation, ranges, camera orientation, zoom and resolution.
- Save geometry constructions and reopen them in the geometry workspace.
- Pin an article to the local offline library.

Personal workspace records use IndexedDB with a guarded local-storage fallback. These records belong to the current browser profile and are not synchronized across devices.

### Installable and offline application

The repository includes `public/manifest.webmanifest`, install icons and `public/sw.js`. The service worker is registered only in production builds and uses a scope relative to the GitHub Pages project URL. The standalone app shell, entry HTML and hashed first-party JavaScript/CSS bundles are cached. Same-origin assets such as article images are cached when requested while online. The service worker uses versioned, app-owned caches and prunes stale hashed bundles without deleting runtime-cached media or unrelated site caches. It only replaces the cached entry page after all new first-party JavaScript and CSS assets are available, preserving the previous offline build if an update is incomplete.

Use **Personal Workspace → Prepare offline** while connected to cache the current application build. On supported browsers, use **Install app**. On iOS/iPadOS, use Safari's Share menu and choose **Add to Home Screen** when available.

Offline boundaries:

- Published article JSON files are eagerly bundled into the application JavaScript, so the published catalogue is available with the cached app shell.
- Local article drafts, bookmarks, notes, highlights, drawing data, learning records and personal workspace records remain in browser storage and can be opened offline on the same device/profile.
- First-party media is runtime-cached after it is requested online. Visit an article while online before relying on its images offline.
- External video embeds, remote websites and externally hosted fonts may require a network connection. Offline mode does not download third-party video content.
- Browser storage can be cleared by the user, browser settings or device cleanup. Keep a separate backup for important personal work.

### Full workspace backup and restore

The **Backup & restore** section creates a ZIP archive containing a versioned JSON manifest, local `math-wiki:` storage records, learning data and personal workspace data. Before restoring, the app validates the archive, ZIP entry paths, duplicate filenames, CRC integrity, schema versions and data shapes. Restoration is selective by category; selected categories are replaced, not merged. If a storage write fails, the restore attempts to roll back both newly introduced keys and the previous category values (plus the affected IndexedDB records). Create a fresh backup first if the current device contains important work.

Backups can include personal notes, drafts, annotations, settings and learning history. Keep exported backup files private. The current archive reader supports the uncompressed ZIP format generated by this application; arbitrary compressed third-party ZIP archives are rejected rather than partially restored.

### Pass 7 verification

Run:

```bash
npm run test:workspace
npm run test:offline
npm run test:smoke
npm run typecheck
npm run build
```

The workspace contracts exercise collection/reading-list CRUD, saved calculator/graph/geometry snapshots, offline article pins, ZIP backup creation, CRC and path-safety validation, selective category restore, and rollback when a simulated storage quota failure interrupts restoration. The offline contracts validate the web app manifest and icon dimensions, service-worker syntax and GitHub Pages scope, versioned cache behavior, offline navigation fallback, workspace routing, article pinning and saved tool-session flows. The service-worker update test verifies that a new entry page is not committed before all required bundles are cached.

The contract suites are dependency-free and do not replace a real browser/PWA installability audit. Confirm installation, offline navigation, offline article reading, backup download and restore on the deployed HTTPS site and the target browsers/devices before calling the PWA production-verified.

## Pass 7 — Personal workspace and offline experience

Pass 7 adds a local personal workspace, saved mathematical sessions, a Progressive Web App manifest and service worker, offline preparation, and full workspace backup/restore:

- **Collections and reading lists:** organize published and local article references without modifying the underlying articles.
- **Saved tool sessions:** save and reopen graph, geometry and calculator snapshots from the playground.
- **PWA installation:** install on browsers and devices that support the relevant install flow. On iOS/iPadOS, use Safari's Share menu and Add to Home Screen.
- **Offline app shell:** the service worker caches the application entry, local JavaScript/CSS bundles, manifest and icons. Article JSON is eagerly included in the static application catalogue. First-party images and other assets are cached as they are visited. External video and third-party resources still require a network connection.
- **Offline article references:** article pins are personal workspace references; the articles themselves are part of the eagerly bundled published catalogue, not individually downloaded HTML documents.
- **Saved sessions:** graph, geometry and calculator sessions are stored locally and can be restored from the Personal Workspace.
- **Workspace backup:** export a versioned ZIP with a JSON manifest containing namespaced browser data, learning records and personal workspace records. The archive is validated for format, size, paths and CRC before restoration.
- **Selective restore:** choose categories to replace. Restore is not a merge operation; it uses rollback snapshots where the browser permits recovery writes.

The service worker keeps the previous offline entry page until all JavaScript and CSS files referenced by a newly fetched `index.html` have been cached. Use **Personal Workspace → Prepare offline** after a deployment to refresh the cached application bundle deliberately.

## Pass 8 — Mathematics Wiki 2.0 release QA

Pass 8 adds release-level integration checks and hardens personal data recovery:

- **Cross-feature release checks:** verifies every article block type has a renderer and validator, primary routes remain registered, app startup retains the error boundary and PWA registration, and all contract scripts are executed by GitHub Actions.
- **Storage snapshot reconciliation:** personal workspace and learning snapshots carry an optional `updatedAt` timestamp. When IndexedDB and the local-storage fallback diverge, the newest valid snapshot wins and is synchronized to the other store where available.
- **Corruption preservation:** malformed personal workspace or learning fallback records, and invalid IndexedDB records, are no longer silently replaced with empty data. The data is left untouched and the affected page shows a recovery message.
- **Recovery UI:** Personal Workspace and Learning Center now display an explicit data-recovery state and retry control instead of presenting corrupted data as an empty account.
- **Offline update safety:** ordinary navigation no longer writes a network `index.html` into the last-known-good offline cache. Cache replacement remains in the service worker's validated update/preparation flow.
- **CI integration:** `npm run test:integration` is included in GitHub Actions in addition to all existing release contract suites.

### Final validation commands

```bash
npm install
npm run test:smoke
npm run test:contracts
npm run test:authoring
npm run test:math-engine
npm run test:graph-tools
npm run test:learning
npm run test:search
npm run test:workspace
npm run test:offline
npm run test:integration
npm run typecheck
npm run build
npm run preview
```

A green dependency-free contract run does not replace the full TypeScript/Vite build or a real browser test. Complete those checks in GitHub Actions or on a machine with the package dependencies installed before treating the deployment as release-verified.
