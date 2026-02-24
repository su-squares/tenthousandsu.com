import {
  createBatchErrorGroups,
  buildBatchErrorMessage,
} from '@assets-js/personalize-modern/batch/errors.js';

interface BatchErrorGroups {
  missingColumns: string[];
  missingSquare: string[];
  invalidSquare: string[];
  duplicateSquares: string[];
  titleTooLong: string[];
  uriTooLong: string[];
  notOwned: string[];
  invalidFilenames: string[];
  duplicateImageSquares: string[];
  unreadableImages: string[];
  invalidImageSize: string[];
  animatedImages: string[];
}

describe('createBatchErrorGroups', () => {
  it('returns object with all 12 error category arrays', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;

    expect(groups).toEqual({
      missingColumns: [],
      missingSquare: [],
      invalidSquare: [],
      duplicateSquares: [],
      titleTooLong: [],
      uriTooLong: [],
      notOwned: [],
      invalidFilenames: [],
      duplicateImageSquares: [],
      unreadableImages: [],
      invalidImageSize: [],
      animatedImages: [],
    });
  });

  it('returns a new object each call', () => {
    const groups1 = createBatchErrorGroups() as BatchErrorGroups;
    const groups2 = createBatchErrorGroups() as BatchErrorGroups;

    expect(groups1).not.toBe(groups2);
    groups1.missingColumns.push('Row 1');
    expect(groups2.missingColumns).toHaveLength(0);
  });
});

describe('buildBatchErrorMessage', () => {
  it('returns only title when no errors', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;
    const message = buildBatchErrorMessage('Batch Errors', groups);

    expect(message).toBe('Batch Errors');
  });

  it('formats single error group', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;
    groups.invalidSquare = ['Row 2', 'Row 5'];

    const message = buildBatchErrorMessage('CSV Errors', groups);

    expect(message).toBe('CSV Errors\nInvalid Square numbers: Row 2, Row 5');
  });

  it('formats multiple error groups', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;
    groups.missingColumns = ['Row 1'];
    groups.titleTooLong = ['#42', '#100'];
    groups.notOwned = ['#999'];

    const message = buildBatchErrorMessage('Validation Failed', groups);

    expect(message).toBe(
      'Validation Failed\n' +
        'Rows with missing columns: Row 1\n' +
        'Titles too long: #42, #100\n' +
        'Squares not owned: #999'
    );
  });

  it('formats all error types in correct order', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;
    groups.missingColumns = ['Row 1'];
    groups.missingSquare = ['Row 2'];
    groups.invalidSquare = ['Row 3'];
    groups.duplicateSquares = ['#4'];
    groups.titleTooLong = ['#5'];
    groups.uriTooLong = ['#6'];
    groups.notOwned = ['#7'];
    groups.invalidFilenames = ['bad.png'];
    groups.duplicateImageSquares = ['#9'];
    groups.unreadableImages = ['corrupt.png'];
    groups.invalidImageSize = ['big.png'];
    groups.animatedImages = ['anim.gif'];

    const message = buildBatchErrorMessage('All Errors', groups);
    const lines = message.split('\n');

    expect(lines[0]).toBe('All Errors');
    expect(lines[1]).toContain('Rows with missing columns');
    expect(lines[2]).toContain('Rows missing Square numbers');
    expect(lines[3]).toContain('Invalid Square numbers');
    expect(lines[4]).toContain('Duplicate Squares');
    expect(lines[5]).toContain('Titles too long');
    expect(lines[6]).toContain('URIs too long');
    expect(lines[7]).toContain('Squares not owned');
    expect(lines[8]).toContain('Invalid filenames');
    expect(lines[9]).toContain('Duplicate image Squares');
    expect(lines[10]).toContain('Unreadable images');
    expect(lines[11]).toContain('Invalid image size');
    expect(lines[12]).toContain('Animated images');
  });

  it('skips empty error groups', () => {
    const groups = createBatchErrorGroups() as BatchErrorGroups;
    groups.titleTooLong = ['#1'];
    // leave others empty

    const message = buildBatchErrorMessage('Test', groups);

    expect(message).toBe('Test\nTitles too long: #1');
    expect(message).not.toContain('missing');
    expect(message).not.toContain('invalid');
  });
});
