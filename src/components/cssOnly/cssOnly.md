# CSS-Only nested checkboxes — how it works

Design notes for `cssOnly.astro`. This lives outside the implementation so the
measured/displayed source stays a fair length next to the other frameworks — the
`.astro` file carries only the code, this file carries the "why".

## The XOR trick

Pure CSS can't write another input's `checked` state, so the parent toggle can't
actually check the children. Instead the parent works as an **XOR** over the
children: each child *looks* checked when `(parent XOR child)`.

- The parent toggle inverts every child's **appearance**. From all-empty that
  reads as "select all"; from all-checked it reads as "deselect all".
- Clicking a child always flips just that child's glyph, even while the parent is
  engaged — so you can build, edit, and clear any combination.
- The parent glyph is derived purely from how many children *look* checked:
  none → empty, some → dash, all → check.

## The three appearance rules

The `<style>` block encodes the XOR as three `:has()`-driven selectors:

1. **Child looks checked** when `(parent XOR child)`:
   - master OFF → a checked child looks checked
   - master ON → the appearance inverts, so an *unchecked* child looks checked
2. **Parent shows CHECK** when every child looks checked:
   - master OFF + all children checked
   - master ON + no child checked (all inverted to checked)
3. **Parent shows DASH** when children are mixed. Inverting a mixed set is still
   mixed, so this holds whether the master is on or off.

## Trade-offs vs. the JS versions

This is the most behaviour we can cover deterministically without script, but two
gaps remain:

- Clicking the parent from a **partial** state inverts the children instead of
  selecting all — a self-inverse toggle can't do both.
- The children's DOM `checked` state stays literal, so assistive tech doesn't see
  the XOR-faked appearance. The visual "checked" and the accessibility tree can
  disagree.
