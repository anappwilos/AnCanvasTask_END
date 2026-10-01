Antes de crear o modificar cualquier interfaz web, leer y cumplir
`UNIVERSAL_WEB_DESIGN_GUIDELINES.md`.

En ausencia de una especificación visual específica del proyecto,
este documento define el comportamiento visual por defecto.

----

# Global Anti-Generative Directive

## Core Rule

Do not make the output larger, noisier, more complex, or more elaborate than the task requires.

Every element must justify its existence against a concrete need.

Prefer:

- less over more;
- explicit over clever;
- direct over indirect;
- existing patterns over invented ones;
- deletion over addition;
- clarity over exhaustiveness;
- usefulness over completeness;
- restraint over demonstration.

## Global Prohibitions

Do not:

- over-explain;
- repeat the same idea in different forms;
- add information merely because it may be useful;
- fill empty space;
- invent requirements;
- anticipate every possible future need;
- add optional complexity without evidence;
- introduce abstractions before they are necessary;
- create structure for hypothetical future use;
- expand scope beyond the requested task;
- add decoration without function;
- create unnecessary sections, layers, categories, or hierarchy;
- generate boilerplate simply because it is conventional;
- use verbosity to signal quality;
- use complexity to signal sophistication;
- produce alternatives when one clear solution is sufficient;
- turn a simple task into a framework, system, workflow, or methodology;
- hide uncertainty behind confident wording;
- treat assumptions as requirements;
- change unrelated things while solving a local problem.

## Relevance Rule

Before including anything, ask:

> Does the user need this to complete, understand, decide, verify, or safely use the result?

If not, omit it.

## Removal Rule

For every element ask:

> What concrete problem appears if this is removed?

If no meaningful problem appears, remove it.

## Duplication Rule

If information is already communicated, do not communicate it again unless repetition is required for safety or clarity.

## Timing Rule

Do not present information before it becomes relevant.

Prefer progressive disclosure over exposing every option immediately.

## Scope Rule

Solve the requested problem.

Do not automatically solve adjacent problems.

Do not redesign surrounding systems unless required.

## Assumption Rule

Distinguish clearly between:

- known facts;
- explicit requirements;
- necessary consequences;
- assumptions.

Never silently promote an assumption into a requirement.

## Complexity Rule

Any increase in complexity requires a concrete justification.

This applies to:

- text;
- UI;
- code;
- architecture;
- configuration;
- states;
- files;
- dependencies;
- workflows;
- documentation;
- tests;
- error handling.

## Existing-First Rule

Before creating something new:

1. check whether an equivalent already exists;
2. reuse or extend it when appropriate;
3. create a new concept only when the existing model cannot represent the requirement cleanly.

## No Speculation Rule

Do not optimize for imagined future requirements.

Build for the current verified requirement unless future needs are explicitly known.

## No Demonstration Rule

Do not make the result look more intelligent, advanced, polished, comprehensive, or sophisticated than necessary.

The goal is not to demonstrate effort.

The goal is to solve the problem cleanly.

## Simplicity Pass

Before considering the work complete, perform a reduction pass.

Remove:

- redundant information;
- speculative functionality;
- duplicated concepts;
- unnecessary abstraction;
- unnecessary configuration;
- excessive explanation;
- decorative structure;
- weakly justified edge-case handling;
- unnecessary dependencies;
- unnecessary files;
- unnecessary state;
- unnecessary UI.

Ask:

> Can this be reduced by 30% without losing correctness, clarity, safety, or required functionality?

If yes, reduce it.

Then ask again.

## Final Standard

The final result should feel:

- intentional;
- restrained;
- clear;
- compact;
- maintainable;
- unsurprising;
- proportionate to the problem.

Do not make the solution larger than the problem.