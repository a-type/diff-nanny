// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import { exec } from 'child_process';
import { promisify } from 'util';
import * as vscode from 'vscode';
import micromatch from 'micromatch';

let statusBarItem: vscode.StatusBarItem;

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate({ subscriptions }: vscode.ExtensionContext) {
  const folders = vscode.workspace.workspaceFolders;
  if (!folders?.[0]) {
    return;
  }

  const config = vscode.workspace.getConfiguration('diffNanny');
  const excludes = config.get<string[]>('excludes') || [];
  const maxTotal = config.get<number>('maxDiffTotal') ?? -1;
  const maxInsert = config.get<number>('maxDiffInserts') ?? -1;
  const maxDelete = config.get<number>('maxDiffRemovals') ?? -1;
  const baseBranch = config.get<string>('baseBranch') ?? 'master';

  statusBarItem = vscode.window.createStatusBarItem(
    vscode.StatusBarAlignment.Left,
    100,
  );
  subscriptions.push(statusBarItem);

  subscriptions.push(
    vscode.workspace.onDidChangeConfiguration(updateStatusBarItem),
  );

  const rootPath = folders[0].uri.path;
  const pattern = new vscode.RelativePattern(rootPath, '**/*');
  const watcher = vscode.workspace.createFileSystemWatcher(pattern);
  subscriptions.push(watcher);
  watcher.onDidChange(updateStatusBarItem);
  watcher.onDidCreate(updateStatusBarItem);
  watcher.onDidDelete(updateStatusBarItem);

  updateStatusBarItem();

  async function updateStatusBarItem(): Promise<void> {
    const diffs = await getDiffs(rootPath, excludes, baseBranch);
    const { inserted, deleted } = diffs;
    statusBarItem.text = `$(diff-added) ${inserted} | $(diff-removed) ${deleted}`;

    if (
      hitLimit(inserted + deleted, maxTotal) ||
      hitLimit(inserted, maxInsert) ||
      hitLimit(deleted, maxDelete)
    ) {
      statusBarItem.backgroundColor = new vscode.ThemeColor(
        'statusBarItem.warningBackground',
      );
    } else {
      statusBarItem.backgroundColor = undefined;
    }
  }
}

// This method is called when your extension is deactivated
export function deactivate() {}

/**
 * Get the number of inserted and deleted lines in the current git repository base on working
 * changes.
 *
 * Accepts excludes list, a list of glob matches of files to exclude from the diff.
 */
async function getDiffs(
  cwd: string,
  excludes: string[],
  baseBranch?: string,
): Promise<{ inserted: number; deleted: number }> {
  try {
    const diffCommand = `git diff ${baseBranch ?? ''} --numstat`;
    console.debug(`diffNanny: Running diff command: ${diffCommand} in ${cwd}`);
    const { stdout } = await promisify(exec)(diffCommand, { cwd });
    // filter out untracked file lines
    const rawLines = stdout
      .split('\n')
      .filter((line) => line.match(/^\d+\t\d+\t/))
      .map(parseDiffLine);
    const lines = rawLines.filter((line) => {
      return !micromatch.isMatch(line.filePath, excludes);
    });

    console.debug(
      `diffNanny: ${lines.length} files diffed (${
        lines.length - rawLines.length
      } excluded by filters)`,
    );

    return {
      inserted: lines.reduce((acc, line) => acc + line.inserted, 0),
      deleted: lines.reduce((acc, line) => acc + line.deleted, 0),
    };
  } catch (error) {
    return {
      inserted: 0,
      deleted: 0,
    };
  }
}

function parseDiffLine(line: string): {
  inserted: number;
  deleted: number;
  filePath: string;
} {
  const [inserted, deleted, filePath] = line.split('\t');
  return {
    inserted: parseInt(inserted),
    deleted: parseInt(deleted),
    filePath,
  };
}

function hitLimit(value: number, limit: number) {
  return limit > -1 && value > limit;
}
