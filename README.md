# diff-nanny README

Keeps a running tally of your git diff and lets you set warnings if you hit a threshold.

Good for people who keep submitting big PRs because they didn't realize they were a little too in the zone.

## Features

- Always shows a diff count in your status bar
- The diff count turns yellow (or whatever your warning color is) when you hit a threshold you decide. Default is 1k changes.
- Allows excluding files you don't care about, like `package-lock.json`, to reduce the noise.

## Extension Settings

Include if your extension adds any VS Code settings through the `contributes.configuration` extension point.

For example:

This extension contributes the following settings:

- `diffNanny.excludes`: A list of glob patterns for files to exclude from the diff totals.
- `diffNanny.maxDiffTotal`: The warning threshold for total diff size (+ and -)
- `diffNanny.maxDiffInserts`: The warning threshold for only inserts (+)
- `diffNanny.maxDiffRemovals`: The warning threshold for only removals (-)

## Release Notes

### 1.0.0

Initial functionality with excludes and threshold limits.
