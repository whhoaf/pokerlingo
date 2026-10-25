## Variant: Full arcade

### Design stance
As close to Balatro's look as a phone app can get: one pixel font for everything, a CRT screen over the top.

### Key choices
- Typography: m6x11plus (Daniel Linssen, free to use with attribution) for every word, at 18, 36 and 54 px only, smoothing off.
- Colour: Balatro's palette (red FE5F55, blue 009DFF, orange FDA200, gold EAC058, green 4BC292, purple 8867A5, dark 374244). Green swirl for a normal session.
- Background: our own swirling sine field drawn at 78 by 169 pixels and scaled up with pixelated rendering. Not a port of the game's shader.
- Surfaces: CRT scanlines and a vignette over everything, small corner radius, hard offset shadows.
- Interaction: cards deal in with a bounce and wobble gently; buttons drop onto their shadow when pressed; the feedback sheet slides up and the +1 chip pops.

### Trade-offs
- Strong at: atmosphere, instant Balatro recognition.
- Weak at: reading. Explanations in an 18 px pixel font are tiring, which is also Balatro's most reported complaint.

### Best for
- Short answers and numbers. Weak for the explainer screens.
