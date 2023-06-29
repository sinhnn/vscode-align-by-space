import * as vscode from 'vscode';

type ArrayTransformer = (lines: string[]) => string[];
type SortingAlgorithm = (a: string, b: string) => number;

function makeSorter(algorithm?: SortingAlgorithm): ArrayTransformer {
  return function(lines: string[]): string[] {
    return lines.sort(algorithm);
  };
}

function sortActiveSelection(transformers: ArrayTransformer[]): Thenable<boolean> | undefined {
  const textEditor = vscode.window.activeTextEditor;
  if (!textEditor) {
    return undefined;
  }
  const selection = textEditor.selection;

  if (selection.isEmpty && vscode.workspace.getConfiguration('sortLines').get('sortEntireFile') === true) {
    return sortLines(textEditor, 0, textEditor.document.lineCount - 1, transformers);
  }

  if (selection.isSingleLine) {
    return undefined;
  }
  return sortLines(textEditor, selection.start.line, selection.end.line, transformers);
}

function sortLines(textEditor: vscode.TextEditor, startLine: number, endLine: number, transformers: ArrayTransformer[]): Thenable<boolean> {
  let lines: string[] = [];
  for (let i = startLine; i <= endLine; i++) {
    lines.push(textEditor.document.lineAt(i).text);
  }

  // Remove blank lines in selection
  if (vscode.workspace.getConfiguration('sortLines').get('filterBlankLines') === true) {
    removeBlanks(lines);
  }

  lines = transformers.reduce((currentLines, transform) => transform(currentLines), lines);

  return textEditor.edit(editBuilder => {
    const range = new vscode.Range(startLine, 0, endLine, textEditor.document.lineAt(endLine).text.length);
    editBuilder.replace(range, lines.join('\n'));
  });
}

function removeDuplicates(lines: string[]): string[] {
  return Array.from(new Set(lines));
}

function keepOnlyDuplicates(lines: string[]): string[] {
  return Array.from(new Set(lines.filter((element, index, array) => array.indexOf(element) !== index)));
}

function removeBlanks(lines: string[]): void {
  for (let i = 0; i < lines.length; ++i) {
    if (lines[i].trim() === '') {
      lines.splice(i, 1);
      i--;
    }
  }
}

function reverseCompare(a: string, b: string): number {
  if (a === b) {
    return 0;
  }
  return a < b ? 1 : -1;
}

function caseInsensitiveCompare(a: string, b: string): number {
  return a.localeCompare(b, undefined, {sensitivity: 'base'});
}

function lineLengthCompare(a: string, b: string): number {
  // Use Array.from so that multi-char characters count as 1 each
  const aLength = Array.from(a).length;
  const bLength = Array.from(b).length;
  if (aLength === bLength) {
    return 0;
  }
  return aLength > bLength ? 1 : -1;
}

function lineLengthReverseCompare(a: string, b: string): number {
  return lineLengthCompare(a, b) * -1;
}

function variableLengthCompare(a: string, b: string): number {
  return lineLengthCompare(getVariableCharacters(a), getVariableCharacters(b));
}

function variableLengthReverseCompare(a: string, b: string): number {
  return variableLengthCompare(a, b) * -1;
}

let intlCollator: Intl.Collator;
function naturalCompare(a: string, b: string): number {
  if (!intlCollator) {
    intlCollator = new Intl.Collator(undefined, {numeric: true});
  }
  return intlCollator.compare(a, b);
}

function getVariableCharacters(line: string): string {
  const match = line.match(/(.*)=/);
  if (!match) {
    return line;
  }
  const last = match.pop();
  if (!last) {
    return line;
  }
  return last;
}

function shuffleSorter(lines: string[]): string[] {
    for (let i = lines.length - 1; i > 0; i--) {
        const rand = Math.floor(Math.random() * (i + 1));
        [lines[i], lines[rand]] = [lines[rand], lines[i]];
    }
    return lines;
}


function customAligner(lines: string[], sep: any, removeEmpty: boolean): string[] {
  let alignedLines: string[] = [];
  let columnLenghts: number[] = [];
  let table: string[][] = [];
  for (let i = 0; i < lines.length; i++) {
    let columns = lines[i].split(sep);
    if (removeEmpty === true)
    {
      columns = columns.filter(e => e !== "");
    }
    for(let index = 0; index < columns.length; index++)
    {
        if (index >= columnLenghts.length)
        {
          columnLenghts.push(columns[index].length);
        }
        else
        {
          if (columnLenghts[index] < columns[index].length)
          {
            columnLenghts[index] = columns[index].length;
          }
        }
    }
    table.push(columns);
  }

  for(let i = 0; i < table.length; i ++)
  {
    alignedLines.push(table[i][0]  + " ".repeat(columnLenghts[0] - table[i][0].length));
    for(let ii = 1; ii < table[i].length; ii++)
    {
      alignedLines[i] += " " + sep + table[i][ii] + " ".repeat(columnLenghts[ii] - table[i][ii].length);
    }
  }
  return alignedLines;
}

// Space is very special character
function spaceAligner(lines: string[]): string[] {
  let alignedLines: string[] = [];
  let columnLenghts: number[] = [];
  let table: string[][] = [];
  let indentLength = 0;
  for (let i = 0; i < lines.length; i++) {
    let columns = lines[i].split(new RegExp("[\\s\\t]+"));
    let lineIndent = 0;
    for(let z = 0; z < lines[i].length; z++)
    {
      if (lines[i][z] !== " ")
      {
        lineIndent = z - 1;
        break;
      }
    }
    indentLength = lineIndent > indentLength ? lineIndent : indentLength;
    for(let index = 0; index < columns.length; index++)
    {
        if (index >= columnLenghts.length)
        {
          columnLenghts.push(columns[index].length);
        }
        else
        {
          if (columnLenghts[index] < columns[index].length)
          {
            columnLenghts[index] = columns[index].length;
          }
        }
    }
    table.push(columns);
  }

  for(let i = 0; i < table.length; i ++)
  {
    alignedLines.push(" ".repeat(indentLength) + table[i][0]);
    for(let ii = 1; ii < table[i].length; ii++)
    {
      alignedLines[i] += " " + table[i][ii] + " ".repeat(columnLenghts[ii] - table[i][ii].length);
    }
  }
  return alignedLines;
}

function commaAligner(lines: string[]): string[] {
  return customAligner(lines, ",", false);
}


const transformerSequences = {
  sortNormal: [makeSorter()],
  sortUnique: [makeSorter(), removeDuplicates],
  sortReverse: [makeSorter(reverseCompare)],
  sortCaseInsensitive: [makeSorter(caseInsensitiveCompare)],
  sortCaseInsensitiveUnique: [makeSorter(caseInsensitiveCompare), removeDuplicates],
  sortLineLength: [makeSorter(lineLengthCompare)],
  sortLineLengthReverse: [makeSorter(lineLengthReverseCompare)],
  sortVariableLength: [makeSorter(variableLengthCompare)],
  sortVariableLengthReverse: [makeSorter(variableLengthReverseCompare)],
  sortNatural: [makeSorter(naturalCompare)],
  sortShuffle: [shuffleSorter],
  alignBySpace: [spaceAligner],
  alignByComma: [commaAligner],
  removeDuplicateLines: [removeDuplicates],
  keepOnlyDuplicateLines: [keepOnlyDuplicates]
};

export const sortNormal = () => sortActiveSelection(transformerSequences.sortNormal);
export const sortUnique = () => sortActiveSelection(transformerSequences.sortUnique);
export const sortReverse = () => sortActiveSelection(transformerSequences.sortReverse);
export const sortCaseInsensitive = () => sortActiveSelection(transformerSequences.sortCaseInsensitive);
export const sortCaseInsensitiveUnique = () => sortActiveSelection(transformerSequences.sortCaseInsensitiveUnique);
export const sortLineLength = () => sortActiveSelection(transformerSequences.sortLineLength);
export const sortLineLengthReverse = () => sortActiveSelection(transformerSequences.sortLineLengthReverse);
export const sortVariableLength = () => sortActiveSelection(transformerSequences.sortVariableLength);
export const sortVariableLengthReverse = () => sortActiveSelection(transformerSequences.sortVariableLengthReverse);
export const sortNatural = () => sortActiveSelection(transformerSequences.sortNatural);
export const sortShuffle = () => sortActiveSelection(transformerSequences.sortShuffle);
export const alignBySpace = () => sortActiveSelection(transformerSequences.alignBySpace);
export const alignByComma = () => sortActiveSelection(transformerSequences.alignByComma);
export const removeDuplicateLines = () => sortActiveSelection(transformerSequences.removeDuplicateLines);
export const keepOnlyDuplicateLines = () => sortActiveSelection(transformerSequences.keepOnlyDuplicateLines);
