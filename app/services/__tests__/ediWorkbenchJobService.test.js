import { appendBoundedValidationFindings } from '../../utils/ediWorkbenchStreamState.js';

describe('EDI Workbench bounded streamed findings', () => {
  test('preserves batch order and exact counts while bounding retained findings', () => {
    const first = appendBoundedValidationFindings(
      { findingCount: 0, findingPreview: [] },
      [{ ref: 'A' }, { ref: 'B' }],
      3,
    );
    const second = appendBoundedValidationFindings(
      first,
      [{ ref: 'C' }, { ref: 'D' }],
      3,
    );

    expect(second).toEqual({
      findingCount: 4,
      findingPreview: [{ ref: 'A' }, { ref: 'B' }, { ref: 'C' }],
    });
  });

  test('does not retain later batches after reaching the limit', () => {
    const retained = [{ ref: 'A' }];
    const result = appendBoundedValidationFindings(
      { findingCount: 10, findingPreview: retained },
      [{ ref: 'B' }],
      1,
    );

    expect(result.findingCount).toBe(11);
    expect(result.findingPreview).toBe(retained);
  });
});