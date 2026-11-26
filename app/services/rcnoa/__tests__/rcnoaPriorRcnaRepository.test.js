jest.mock('../../../../db/connection.js', () => {
  const find = jest.fn();
  const collection = { find };
  return {
    connectToDatabase: jest.fn().mockResolvedValue({
      collection: jest.fn(() => collection),
    }),
  };
});

import { connectToDatabase } from '../../../../db/connection.js';
import { loadPriorRcnaRecords } from '../rcnoaRepositoryService.js';

describe('MongoDB prior RCNA store', () => {
  const originalLocalTesting = process.env.RCNOA_LOCAL_TESTING;

  beforeEach(() => {
    process.env.RCNOA_LOCAL_TESTING = 'false';
    const find = connectToDatabase().then((db) => db.collection().find);
    return find.then((mockFind) => {
      mockFind.mockReset();
      mockFind.mockImplementation((filter) => {
        const cursor = {
          toArray: jest.fn().mockResolvedValue(filter.memberMatchKey.$in.map((memberMatchKey) => ({
            memberMatchKey,
            priority: '1',
            noticeCode: 'B200',
            noticeDescription: 'Prior decision',
            notes: '',
            ageMonths: 2,
          }))),
        };
        cursor.sort = jest.fn(() => cursor);
        return cursor;
      });
    });
  });

  afterAll(() => {
    if (originalLocalTesting === undefined) delete process.env.RCNOA_LOCAL_TESTING;
    else process.env.RCNOA_LOCAL_TESTING = originalLocalTesting;
  });

  test('splits large match-key sets into bounded queries', async () => {
    const db = await connectToDatabase();
    const find = db.collection().find;
    const records = Array.from({ length: 1001 }, (_, index) => {
      const record = Array(73).fill('');
      record[0] = String(index);
      return record;
    });

    const priorRecords = await loadPriorRcnaRecords(records, '202609', 'test-secret');

    expect(find).toHaveBeenCalledTimes(3);
    expect(find.mock.calls.map(([filter]) => filter.memberMatchKey.$in.length))
      .toEqual([500, 500, 1]);
    expect(priorRecords).toHaveLength(1001);
    expect(priorRecords[1000].slice(73)).toEqual([
      '1',
      'B200',
      'Prior decision',
      '',
      '2',
    ]);
  });
});