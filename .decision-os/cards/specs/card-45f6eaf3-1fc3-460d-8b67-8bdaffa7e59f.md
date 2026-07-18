## A. Result

1. **State:** implemented and verified.
2. **Removed:** `queueRank` parsing, projection fields, mutation types, `withQueueRank()`, Queue-order state, sequential rank writes, and rank persistence requests.
3. **Interaction:** SortableJS `1.15.7` remains pinned under the MIT license for the existing Queue and Backlog workflow; in-Queue drops re-render canonical timestamp order without persistence.
4. **Evidence:** the served browser gesture emitted no Queue-order PATCH and preserved newest-first order after pointer, touch, cancellation, and reload.
