## A. Result

1. **State:** implemented and verified.
2. **Change:** `compareControlRoomQueueTasks()` now compares only descending finite `waitingTime`, followed by stable project, ledger, and card identity.
3. **Coverage:** local, multi-project, frontend fallback, hydrated API, and federated projections ignore conflicting legacy ranks.
4. **Evidence:** focused backend tests passed `15/15`; responsive Control Room tests passed `51/51`.
