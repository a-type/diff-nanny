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
    const diffs = await getDiffs(rootPath, excludes);
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

  let disposable = vscode.commands.registerCommand(
    'diffNanny.helloWorld',
    () => {
      vscode.window.showInformationMessage('Hello World from Diff Nanny!');
    },
  );
  subscriptions.push(disposable);
  statusBarItem.show();
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
): Promise<{ inserted: number; deleted: number }> {
  try {
    const { stdout } = await promisify(exec)(`git diff --numstat`, { cwd });
    // filter out untracked file lines
    const lines = stdout
      .split('\n')
      .filter((line) => line.match(/^\d+\t\d+\t/))
      .map(parseDiffLine)
      .filter((line) => {
        return !micromatch.isMatch(line.filePath, excludes);
      });

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
