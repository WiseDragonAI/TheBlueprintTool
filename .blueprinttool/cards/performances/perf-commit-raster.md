# Commit And Raster Mechanism

The worst frame is not explained by a long JavaScript handler alone.

For `Logo and naming` at scale `0.35`:

```text
Frame duration: 80.4ms
EventDispatch(pointermove) max: about 9.9ms
ProxyMain::BeginMainFrame: about 71ms
Commit: about 71ms
LayerTreeHost::WaitForCommitCompletion: about 71ms
```

That means the pointermove handler triggers invalidation, then Chrome spends the frame producing the committed visual result.

Why it is expensive:

- Drag writes `left/top`, which changes layout position.
- The card is large on screen even while zoomed out.
- The card surface has borders, layered background, shadows, overview text, and status controls.
- The canvas itself is transformed by viewport scale.
- Chrome has to update style/layout state, update paint artifacts, commit the layer tree, and run raster/compositor tasks.

Trace totals like `raster-composite total=1694ms` inside an 80ms frame are sums of overlapping trace events and worker tasks. They do not mean a 1.6s frame; they mean the frame spawned a large amount of raster/compositor work and the main thread waited on a costly commit.

This is why removing some visuals helps but does not fully solve the problem. The structural problem is the drag rendering model.
