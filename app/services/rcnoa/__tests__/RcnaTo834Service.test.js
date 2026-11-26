import { RcnaTo834Service } from '../RcnaTo834Service';

function workingRcnaRecord(overrides = {}) {
  const record = Array(78).fill('');
  record[0] = '01';
  record[73] = '1: Active Enrollment mismatch';
  record[74] = 'AE501 834 Enrollment Awaiting Processing';
  record[75] = 'Carrier to process the 834 enrollment';
  record[77] = '0';
  Object.entries(overrides).forEach(([index, value]) => {
    record[Number(index)] = value;
  });
  return record;
}

function serviceConfig(overrides = {}) {
  return {
    envelope: {
      senderQualifier: 'ZZ',
      senderId: 'OPM DATAHUB',
      receiverQualifier: 'ZZ',
      receiverId: '076011108LCSP',
      usageIndicator: 'T',
      interchangeControlNumber: '1',
      applicationSenderCode: 'OPM DATAHUB',
      applicationReceiverCode: 'GCA',
      groupControlNumber: '1',
      transactionControlNumber: '1',
      transactionReference: 'EEX2809',
      groupNumber: 'GROUP0001',
      subgroupNumber: '0001',
      regionCode: 'NCR',
      sponsor: {
        name: 'OFFICE OF PERSONNEL MANAGEMENT',
        idQualifier: 'FI',
        id: '123456789',
      },
      payer: {
        name: 'KAISER PERMANENTE',
        idQualifier: 'FI',
        id: '076011108',
      },
    },
    intentByCode: {
      AE501: {
        bgnAction: '2',
        maintenanceType: '001',
        maintenanceReason: 'AI',
        benefitStatus: 'A',
        coverageLevel: 'FAM',
      },
    },
    clock: () => new Date('2026-08-04T14:30:45.000Z'),
    ...overrides,
  };
}

function subscriberRecord() {
  return workingRcnaRecord({
    1: 'EMP000001',
    10: 'DOE',
    13: 'JANE',
    16: '19800102',
    19: '123456789',
    22: '123456789',
    25: 'ABC',
    28: '20260101',
    31: '20261231',
    34: '100 MAIN ST',
    43: 'OAKLAND',
    46: 'CA',
    49: '94612',
    52: 'US',
    55: '(510) 555-0100',
    64: '18',
    70: 'F',
  });
}

function dependentRecord() {
  return workingRcnaRecord({
    1: 'EMP000001',
    10: 'DOE',
    13: 'JOHN',
    16: '20100102',
    19: '987654321',
    22: '123456789',
    25: 'ABC',
    28: '20260101',
    31: '20261231',
    34: '100 MAIN ST',
    43: 'OAKLAND',
    46: 'CA',
    49: '94612',
    52: 'US',
    64: '19',
    70: 'M',
  });
}

describe('RcnaTo834Service', () => {
  test('generates a grouped X12 834 with balanced controls and counts', () => {
    const service = new RcnaTo834Service(serviceConfig());

    const result = service.transform({
      workingRcnaRecords: [dependentRecord(), subscriberRecord()],
    });

    expect(result.counts).toEqual({
      subscribers: 1,
      dependents: 1,
      members: 2,
      transactionSegments: 35,
    });
    expect(result.x12.split('~')[0]).toHaveLength(105);
    expect(result.x12).toMatch(/~\r\n$/);
    expect(result.x12.split('\r\n').filter(Boolean).every((segment) => segment.endsWith('~'))).toBe(true);
    expect(result.x12).toContain('GS*BE*OPM DATAHUB*GCA*20260804*143045*1*X*005010X220A1~');
    expect(result.x12).toContain('QTY*ET*1~\r\nQTY*DT*1~\r\nQTY*TO*2~');
    expect(result.x12).toContain('INS*Y*18*001*AI*A~');
    expect(result.x12).toContain('INS*N*19*001*AI*A~');
    expect(result.x12.indexOf('NM1*IL*1*DOE*JANE')).toBeLessThan(
      result.x12.indexOf('NM1*IL*1*DOE*JOHN'),
    );
    expect(result.x12).toContain('HD*001**HMO*ABC*FAM~');
    expect(result.x12).toContain('HD*001**HMO*ABC~');
    expect(result.x12).toContain('DTP*348*D8*20260101~\r\nDTP*349*D8*20261231~');
    expect(result.x12).toContain('SE*35*000000001~\r\nGE*1*1~\r\nIEA*1*000000001~');
  });

  test('rejects a row whose RCNA code has no approved 834 intent', () => {
    const service = new RcnaTo834Service(serviceConfig());
    const record = subscriberRecord();
    record[74] = 'UNKNOWN Unmapped Display Value';

    expect(() => service.transform({ workingRcnaRecords: [record] }))
      .toThrow('no approved 834 intent for code UNKNOWN');
  });

  describe('multi-code RCNA rows (DM508/DM507)', () => {
    const dm508Intent = { ...serviceConfig().intentByCode.AE501, maintenanceReason: '41' };
    const dm507Intent = { ...serviceConfig().intentByCode.AE501, maintenanceReason: '43' };

    function generate(intentByCode) {
      const record = subscriberRecord();
      record[74] = 'DM508 Payroll Office Number pending update/DM507 Address pending update';
      const service = new RcnaTo834Service(serviceConfig({ intentByCode }));
      return service.transform({ workingRcnaRecords: [record] }).x12;
    }

    test('uses the first token when it has an approved intent', () => {
      const x12 = generate({ DM508: dm508Intent, DM507: dm507Intent });
      expect(x12).toContain('INS*Y*18*001*41*A~');
    });

    test('falls back to the second token when the first has no approved intent', () => {
      const x12 = generate({ DM507: dm507Intent });
      expect(x12).toContain('INS*Y*18*001*43*A~');
    });

    test('rejects the row when no token has an approved intent', () => {
      expect(() => generate({}))
        .toThrow('no approved 834 intent for code DM508/DM507');
    });
  });

  test('generates an incremental 834 for a dependent-only subscriber group', () => {
    const service = new RcnaTo834Service(serviceConfig());

    const result = service.transform({ workingRcnaRecords: [dependentRecord()] });

    expect(result.counts).toEqual({
      subscribers: 0,
      dependents: 1,
      members: 1,
      transactionSegments: 21,
    });
    expect(result.x12).toContain('QTY*ET*0~\r\nQTY*DT*1~\r\nQTY*TO*1~');
    expect(result.x12).toContain('INS*N*19*001*AI*A~');
    expect(result.x12).toContain('REF*0F*123456789~');
    expect(result.x12).not.toContain('INS*Y*18*001*AI*A~');
    expect(result.x12).toContain('SE*21*000000001~');
  });

  test('omits address line 3 without failing when no handler is configured', () => {
    const service = new RcnaTo834Service(serviceConfig());
    const record = subscriberRecord();
    record[40] = 'UNIT 4';

    const { x12, skipped } = service.transform({ workingRcnaRecords: [record] });

    expect(skipped).toEqual([]);
    expect(x12).toContain('N3*100 MAIN ST~');
    expect(x12).not.toContain('UNIT 4');
  });

  test('uses an approved address line 3 handler', () => {
    const service = new RcnaTo834Service(serviceConfig({
      addressLine3Handler: ({ line1, line2, line3 }) => ({
        line1,
        line2: [line2, line3].filter(Boolean).join(' '),
      }),
    }));
    const record = subscriberRecord();
    record[37] = 'BUILDING A';
    record[40] = 'UNIT 4';

    const { x12 } = service.transform({ workingRcnaRecords: [record] });

    expect(x12).toContain('N3*100 MAIN ST*BUILDING A UNIT 4~');
  });

  test('sanitizes reserved X12 delimiters in payload data instead of failing', () => {
    const service = new RcnaTo834Service(serviceConfig());
    const record = subscriberRecord();
    record[10] = 'DO*E~';
    record[43] = 'OAK:LAND';

    const { x12 } = service.transform({ workingRcnaRecords: [record] });

    expect(x12).toContain('NM1*IL*1*DO E*JANE');
    expect(x12).toContain('N4*OAK LAND*CA*94612*US~');
    expect(x12.split('\r\n').filter(Boolean).every((segment) => segment.endsWith('~'))).toBe(true);
  });

  describe('optional member fields', () => {
    function generate(mutate, base = subscriberRecord()) {
      const service = new RcnaTo834Service(serviceConfig());
      mutate(base);
      return service.transform({ workingRcnaRecords: [base] });
    }

    test('omits NM108 and NM109 when the member SSN is blank', () => {
      const dependent = dependentRecord();
      dependent[19] = '';

      const { x12, counts, skipped } = generate(() => {}, dependent);

      expect(skipped).toEqual([]);
      expect(counts.members).toBe(1);
      expect(x12).toContain('INS*N*19*001*AI*A~');
      expect(x12).toContain('NM1*IL*1*DOE*JOHN~');
      expect(x12).not.toContain('NM1*IL*1*DOE*JOHN*');
    });

    test('omits N4 city when blank and keeps the other N4 elements', () => {
      const { x12 } = generate((record) => { record[43] = ''; });

      expect(x12).toContain('N4**CA*94612*US~');
    });

    test('omits N4 when city, state, ZIP and country are all blank', () => {
      const { x12 } = generate((record) => {
        [43, 46, 49, 52].forEach((index) => { record[index] = ''; });
      });

      expect(x12).not.toContain('N4*');
    });

    test('omits gender but keeps the birth date when gender is blank', () => {
      const { x12 } = generate((record) => { record[70] = ''; });

      expect(x12).toContain('DMG*D8*19800102~');
    });

    test('omits birth date but keeps the gender when the birth date is blank', () => {
      const { x12 } = generate((record) => { record[16] = ''; });

      expect(x12).toContain('DMG***F~');
    });

    test('omits DMG when birth date and gender are both blank', () => {
      const { x12 } = generate((record) => { record[16] = ''; record[70] = ''; });

      expect(x12).not.toContain('DMG*');
    });

    test.each([
      ['birth date', 16, 'DMG*D8*'],
      ['coverage start', 28, 'DTP*348*'],
      ['coverage end', 31, 'DTP*349*'],
    ])('omits a malformed %s instead of failing', (label, index, segmentPrefix) => {
      const { x12, counts } = generate((record) => { record[index] = '2026-13-45'; });

      expect(counts.members).toBe(1);
      expect(x12).not.toContain(segmentPrefix);
    });

    test('omits coverage dates that are blank or not real calendar dates', () => {
      const { x12 } = generate((record) => {
        record[28] = '';
        record[31] = '20260230';
      });

      expect(x12).not.toContain('DTP*348');
      expect(x12).not.toContain('DTP*349');
    });

    test('emits a blank INS02 when the relationship of a dependent is blank', () => {
      const dependent = dependentRecord();
      dependent[64] = '';

      const { x12 } = generate(() => {}, dependent);

      expect(x12).toContain('INS*N**001*AI*A~');
    });

    test.each(['12345', '510-555-01', '1 510 555 0100 99'])(
      'omits PER instead of failing when the phone is "%s"',
      (phone) => {
        const { x12 } = generate((record) => { record[55] = phone; });

        expect(x12).not.toContain('PER*');
      },
    );

    test('still emits PER for a ten digit phone', () => {
      const { x12 } = generate(() => {});

      expect(x12).toContain('PER*IP**TE*5105550100~');
    });
  });

  test('accepts the 76-column outbound RCNA used for business review', () => {
    const service = new RcnaTo834Service(serviceConfig());
    const record = subscriberRecord().slice(0, 76);

    expect(service.transform({ workingRcnaRecords: [record] }).counts.members).toBe(1);
  });

  test('rejects RCNA rows with the wrong width', () => {
    const service = new RcnaTo834Service(serviceConfig());

    expect(() => service.transform({ workingRcnaRecords: [Array(75).fill('')] }))
      .toThrow('must contain exactly 76 or 78 columns');
  });

  describe('skipping rows with missing required source fields', () => {
    // PSHBS columns: last name 10, first name 13, subscriber SSN 22, address line 1 34.
    test.each([
      ['PSHBS_Last_Name', 10],
      ['PSHBS_First_Name', 13],
      ['PSHBS_Subscriber_SSN', 22],
      ['PSHBS_Address_Line1', 34],
    ])('skips an F or N family row missing %s and still generates the 834', (label, index) => {
      const service = new RcnaTo834Service(serviceConfig());
      const incomplete = dependentRecord();
      incomplete[3] = 'F';
      incomplete[index] = '';

      const result = service.transform({
        workingRcnaRecords: [incomplete, subscriberRecord()],
      });

      expect(result.counts.members).toBe(1);
      expect(result.x12).toContain('NM1*IL*1*DOE*JANE');
      expect(result.skipped).toEqual([
        expect.objectContaining({
          sourceRow: 1,
          discrepancyFamily: 'F',
          sourceSide: 'PSHBS',
          missingFields: [label],
        }),
      ]);
    });

    test('treats whitespace-only values as missing and reports every missing field', () => {
      const service = new RcnaTo834Service(serviceConfig());
      const incomplete = subscriberRecord();
      incomplete[3] = 'N';
      incomplete[10] = '   ';
      incomplete[22] = '';

      const result = service.transform({
        workingRcnaRecords: [incomplete, dependentRecord()],
      });

      expect(result.skipped[0].missingFields).toEqual([
        'PSHBS_Last_Name',
        'PSHBS_Subscriber_SSN',
      ]);
      expect(result.skipped[0].record).toHaveLength(78);
    });

    test('skips before intent resolution so a skipped row cannot fail the run', () => {
      const service = new RcnaTo834Service(serviceConfig());
      const incomplete = subscriberRecord();
      incomplete[10] = '';
      incomplete[74] = 'UNKNOWN Unmapped Display Value';

      const result = service.transform({
        workingRcnaRecords: [incomplete, dependentRecord()],
      });

      expect(result.counts.members).toBe(1);
      expect(result.skipped).toHaveLength(1);
    });

    function menrRecord(record) {
      const shifted = [...record];
      for (let index = 70; index >= 1; index -= 1) {
        if (index !== 3) {
          shifted[index + 1] = record[index];
          shifted[index] = '';
        }
      }
      shifted[3] = 'I';
      return shifted;
    }

    test('generates I family rows from MENR columns and ignores PSHBS values', () => {
      const service = new RcnaTo834Service(serviceConfig());
      const record = menrRecord(subscriberRecord());
      // A populated PSHBS value must not be used for an I family row.
      record[10] = 'PSHBSNAME';

      const result = service.transform({ workingRcnaRecords: [record] });

      expect(result.skipped).toEqual([]);
      expect(result.counts.members).toBe(1);
      expect(result.x12).toContain('NM1*IL*1*DOE*JANE');
      expect(result.x12).not.toContain('PSHBSNAME');
    });

    test.each([
      ['MENR_Last_Name', 11],
      ['MENR_First_Name', 14],
      ['MENR_Subscriber_SSN', 23],
      ['MENR_Address_Line1', 35],
    ])('skips an I family row missing %s without falling back to PSHBS', (label, index) => {
      const service = new RcnaTo834Service(serviceConfig());
      const incomplete = menrRecord(subscriberRecord());
      incomplete[index] = '';
      // PSHBS holds a value, but I family rows are sourced from MENR only.
      incomplete[index - 1] = 'PSHBS VALUE';

      const result = service.transform({
        workingRcnaRecords: [incomplete, dependentRecord()],
      });

      expect(result.counts.members).toBe(1);
      expect(result.skipped).toEqual([
        expect.objectContaining({
          sourceRow: 1,
          discrepancyFamily: 'I',
          sourceSide: 'MENR',
          missingFields: [label],
        }),
      ]);
    });

    test('returns no 834 when every row is skipped', () => {
      const service = new RcnaTo834Service(serviceConfig());
      const incomplete = subscriberRecord();
      incomplete[22] = '';

      const result = service.transform({ workingRcnaRecords: [incomplete] });

      expect(result.x12).toBeNull();
      expect(result.counts.members).toBe(0);
      expect(result.skipped).toHaveLength(1);
    });

    test('returns an empty skipped list when all required data is present', () => {
      const service = new RcnaTo834Service(serviceConfig());

      expect(service.transform({ workingRcnaRecords: [subscriberRecord()] }).skipped).toEqual([]);
    });
  });
});
