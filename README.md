# Design reference library

Personal visual archive. Paste links or upload screenshots, then browse them in a gallery.

```bash
npm install
npm run dev
```

Data stays in this browser (IndexedDB). No account required.

## References

A reference is a set of screens, not a single image. Cards in the gallery and
the detail view share one carousel component, so you can page through the real
UI without opening anything: swipe on touch, arrows or arrow keys on a pointer,
pagination dots and an `n/total` counter everywhere. Seeded examples carry at
least three genuinely different screens.

A reference can belong to several collections at once (`collectionIds`), because
a sign-up flow that starts on a marketing page honestly belongs under Web,
Onboarding and Landing Pages.

## Seeded examples

The examples are generated, not hand written. `src/lib/storage/seed-examples.ts`
is produced by:

```bash
python3 scripts/harvest-mobbin.py     # metadata + flow screens -> scripts/mobbin-data.json
python3 scripts/build-seed-data.py    # screens -> public/screens, seeds -> seed-examples.ts
python3 scripts/make-audit-sheets.py  # contact sheet per reference, for reviewing categories
```

Collections are assigned by looking at the screens. Apps that cannot reach three
distinct screens are left out rather than padded with duplicates or crops.

Seeding is keyed to `SEED_REVISION`: when the seed data changes, seeded rows are
replaced and references you added yourself (no `seedKey`) are left alone.

## QA

Both scripts drive the running dev server with a real browser:

```bash
npm run dev
npm run qa:responsive   # 320/375/390/430/768/1280/1600, overflow, carousels, sheets
npm run qa:tabs         # tab counts vs rendered cards, categories, search, filters, drawer
```
