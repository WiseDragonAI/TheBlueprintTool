**Implementation direction**

- Core differs from Start UI: no React, TanStack Router, Expo, or generated client runtime owns the canvas.
- Implement UI behavior with browser DOM modules and Core runtime composition.
- Keep route handling lightweight and server-backed instead of adopting Start UI client framework structure.
- Treat framework adoption as a separate architecture decision, not an implied dependency.