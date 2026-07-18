## A. Symlink verification

1. Focused backend scope passes 17 of 17 tests, including external directory links, nested link traversal, alias identity, broken links, file links, and cycle suppression.
2. Focused frontend scope passes 55 of 55 tests. Both backend and frontend typechecks pass.
3. The Playwright journey creates a catalog link named Ardaria_57 whose target is outside the server root, verifies the link marker, expands Nested Folder through the link, selects the alias, creates the project, preserves README.md, and initializes the target.
4. Direct verification against /home/jbb returns Ardaria_57 with path Ardaria_57, display path /home/jbb/Ardaria_57, symbolic-link metadata, Git metadata, Decision OS metadata, and 15 discoverable children.
5. Merged commit: 3b9c3809 merge: follow project directory symlinks.
