
import { connectToDatabase } from '@/db/connection';
import { queryDB2 } from '@/app/services/langgraphs/bcsChatBot/db2';

const FUNCTIONALITY_TEMPLATE = [
    { S_NO: 1, UOM: "Sec", Functionality: "Home Page / Refresh UI / Application Loading", Target_Value: 1.00 },
    { S_NO: 2, UOM: "Sec", Functionality: "Search RQR", Target_Value: 1.50 },
    { S_NO: 3, UOM: "Sec", Functionality: "Update RQR details & Group Info", Target_Value: 5.50 },
    { S_NO: 4, UOM: "Sec", Functionality: "CAT Upload", Target_Value: 6.50 },
    { S_NO: 5, UOM: "Sec", Functionality: "Change RQR Owner", Target_Value: 2.50 },
    { S_NO: 6, UOM: "Sec", Functionality: "Quotes Tab", Target_Value: 1.00 },
    { S_NO: 7, UOM: "Sec", Functionality: "Retrieve Quote Details", Target_Value: 1.00 },
    { S_NO: 8, UOM: "Sec", Functionality: "Quote Name Update", Target_Value: 1.50 },
    { S_NO: 9, UOM: "Sec", Functionality: "Population Management Group Search", Target_Value: 1.50 },
    { S_NO: 10, UOM: "Sec", Functionality: "Create STU", Target_Value: 2.50 },
    { S_NO: 11, UOM: "Sec", Functionality: "Find STU", Target_Value: 1.50 },
    { S_NO: 12, UOM: "Sec", Functionality: "Search WI", Target_Value: 2.00 },
    { S_NO: 13, UOM: "Sec", Functionality: "Create WI", Target_Value: 1.50 },
    { S_NO: 14, UOM: "Sec", Functionality: "Create WI - addToExistingWorkItem", Target_Value: 3.50 },
    { S_NO: 15, UOM: "Sec", Functionality: "Reassign WI", Target_Value: 4.50 },
    { S_NO: 16, UOM: "Sec", Functionality: "Update WI", Target_Value: 1.50 },
    { S_NO: 17, UOM: "Sec", Functionality: "Delete WI", Target_Value: 2.50 },
    { S_NO: 18, UOM: "Sec", Functionality: "Duplicate WI", Target_Value: 1.00 },
    { S_NO: 19, UOM: "Sec", Functionality: "Ratebuildup View Backup", Target_Value: 0.50 },
    { S_NO: 20, UOM: "Sec", Functionality: "Ratebuildup Backup Comment", Target_Value: 1.50 },
    { S_NO: 21, UOM: "Sec", Functionality: "Benefit Adjustment Factor View Backup", Target_Value: 1.50 },
    { S_NO: 22, UOM: "Sec", Functionality: "Benefit Adjustment Factor Backup Overrides", Target_Value: 4.00 },
    { S_NO: 23, UOM: "Sec", Functionality: "Pooling BackUp", Target_Value: 1.00 },
    { S_NO: 24, UOM: "Sec", Functionality: "Retention View Backup", Target_Value: 0.50 },
    { S_NO: 25, UOM: "Sec", Functionality: "Other Benefit View Backup", Target_Value: 1.00 },
    { S_NO: 26, UOM: "Sec", Functionality: "Demographic Factor View backup", Target_Value: 4.50 },
    { S_NO: 27, UOM: "Sec", Functionality: "Trend Factor", Target_Value: 1.50 },
    { S_NO: 28, UOM: "Sec", Functionality: "Inforce Rates", Target_Value: 1.50 },
    { S_NO: 29, UOM: "Sec", Functionality: "Incurred BackUp", Target_Value: 10.00 },
    { S_NO: 30, UOM: "Sec", Functionality: "Member Month Summary", Target_Value: 6.50 },
    { S_NO: 31, UOM: "Sec", Functionality: "Fetch Industry Code", Target_Value: 1.00 },
    { S_NO: 32, UOM: "Sec", Functionality: "Fetch Zip Code", Target_Value: 1.50 },
    { S_NO: 33, UOM: "Sec", Functionality: "UnderWriter Adjustment Backup", Target_Value: 2.00 },
    { S_NO: 34, UOM: "Sec", Functionality: "UnderWriter Adjustment Backup Overrides", Target_Value: 2.50 },
    { S_NO: 35, UOM: "Sec", Functionality: "UnderWriter Adjustment Roll Back", Target_Value: 2.50 },
    { S_NO: 36, UOM: "Sec", Functionality: "UnderWriter Adjustment Cascade", Target_Value: 1.50 },
    { S_NO: 37, UOM: "Sec", Functionality: "Capping View Backup", Target_Value: 1.50 },
    { S_NO: 38, UOM: "Sec", Functionality: "Capping Override", Target_Value: 1.50 },
    { S_NO: 39, UOM: "Sec", Functionality: "Medicare RateBuildup View Backup", Target_Value: 2.00 },
    { S_NO: 40, UOM: "Sec", Functionality: "RRC Override", Target_Value: 2.50 },
    { S_NO: 41, UOM: "Sec", Functionality: "Update RRC", Target_Value: 2.00 },
    { S_NO: 42, UOM: "Sec", Functionality: "CA Blend", Target_Value: 3.00 },
    { S_NO: 43, UOM: "Sec", Functionality: "RRC Deletion", Target_Value: 3.00 },
    { S_NO: 44, UOM: "Sec", Functionality: "Tier Rates View Backup", Target_Value: 1.50 },
    { S_NO: 45, UOM: "Sec", Functionality: "TierRates Backup Overrides", Target_Value: 1.50 },
    { S_NO: 46, UOM: "Sec", Functionality: "Multi quote Incurred Claims Adjustment View Backup", Target_Value: 1.00 },
    { S_NO: 47, UOM: "Sec", Functionality: "Multi quote Incurred Claim Adjustment Overrides", Target_Value: 3.50 },
    { S_NO: 48, UOM: "Sec", Functionality: "Paid claims Upload", Target_Value: 3.00 },
    { S_NO: 49, UOM: "Sec", Functionality: "SVCC Backup", Target_Value: 1.50 },
    { S_NO: 50, UOM: "Sec", Functionality: "Mark for Sale", Target_Value: 10.00 },
    { S_NO: 51, UOM: "Sec", Functionality: "View Sold Plan", Target_Value: 1.50 },
    { S_NO: 52, UOM: "Sec", Functionality: "Sold Quote Review", Target_Value: 5.00 },
    { S_NO: 53, UOM: "Sec", Functionality: "Post Sale Overrides", Target_Value: 1.50 },
    { S_NO: 54, UOM: "Sec", Functionality: "Open WI", Target_Value: 1.50 },
    { S_NO: 55, UOM: "Sec", Functionality: "Rating", Target_Value: 125.00 },
    { S_NO: 56, UOM: "Sec", Functionality: "Work Item Unlock", Target_Value: 1.00 },
    { S_NO: 57, UOM: "Sec", Functionality: "Update Membership and Transition dates", Target_Value: 2.50 },
    { S_NO: 58, UOM: "Sec", Functionality: "Updating Sub-group", Target_Value: 1.50 },
    { S_NO: 59, UOM: "Sec", Functionality: "Add RQR to the WI", Target_Value: 2.50 },
    { S_NO: 60, UOM: "Sec", Functionality: "Remove RQR from the WI", Target_Value: 2.50 },
    { S_NO: 61, UOM: "Sec", Functionality: "Rename iteration", Target_Value: 2.50 },
    { S_NO: 62, UOM: "Sec", Functionality: "Delete iteration", Target_Value: 2.50 },
    { S_NO: 63, UOM: "Sec", Functionality: "Duplicate iteration", Target_Value: 1.50 },
    { S_NO: 64, UOM: "Sec", Functionality: "Update Rate Summary", Target_Value: 1.50 },
    { S_NO: 65, UOM: "Sec", Functionality: "Prospect view Backup", Target_Value: 1.00 },
    { S_NO: 66, UOM: "Sec", Functionality: "Revenue Track", Target_Value: 16.50 },
    { S_NO: 67, UOM: "Sec", Functionality: "Revenue Untrack", Target_Value: 16.50 },
    { S_NO: 68, UOM: "Sec", Functionality: "CPQ Complete Suite (CS)", Target_Value: 115.00 },
    { S_NO: 69, UOM: "Sec", Functionality: "Load Memory Map", Target_Value: 1.50 },
    { S_NO: 70, UOM: "Sec", Functionality: "Area Factor", Target_Value: 1.00 },
    { S_NO: 71, UOM: "Sec", Functionality: "MOC Complete Suite (CS)", Target_Value: 105.00 }
];

// };

// ══════════════════════════════════════════════════════════════════════════════
// RECORD GENERATOR — Combines template + daily avg values into enriched docs
// ══════════════════════════════════════════════════════════════════════════════
function generateAllScorecardRecords(DAILY_AVG_VALUES) {
    const allRecords = [];
    const dateKeys = Object.keys(DAILY_AVG_VALUES).sort();

    for (const dateStr of dateKeys) {
        const avgValues = DAILY_AVG_VALUES[dateStr];

        if (avgValues.length !== FUNCTIONALITY_TEMPLATE.length) {
            throw new Error(
                `Data mismatch for ${dateStr}: expected ${FUNCTIONALITY_TEMPLATE.length} avg values, got ${avgValues.length}`
            );
        }

        const currentDate = new Date(dateStr + 'T00:00:00.000Z');

        FUNCTIONALITY_TEMPLATE.forEach((template, index) => {
            const avgValue = parseFloat(avgValues[index]);
            const targetValue = template.Target_Value;

            allRecords.push({
                S_NO: template.S_NO,
                UOM: template.UOM,
                Functionality: template.Functionality,
                Target_Value: targetValue,
                Avg_Value: avgValue,
                Current_date: currentDate,
                Current_date_str: dateStr,
                type: 'nps_scorecard',
                Difference: parseFloat((targetValue - avgValue).toFixed(4)),
                Utilization_Pct: targetValue > 0
                    ? parseFloat(((avgValue / targetValue) * 100).toFixed(2))
                    : 0,
                SLA_Status: avgValue === 0
                    ? 'No Usage'
                    : avgValue > targetValue
                        ? 'SLA Breached'
                        : 'Within SLA',
                uploadedAt: new Date()
            });
        });
    }

    return allRecords;
}
export async function scorecardDataLoad() {
    try {
        let allAvgValues = []
        const log = [];
        const scorecard = await queryDB2(`Select S_NO,UOM,FUNCTIONALITY,COALESCE(AVG_VALUE,'0') as AVG_VALUE,Target_Value from STG.NPG_SCORECARD`);

        log.push(`Records Found ${scorecard.length}`);

        if (scorecard.length === 0) {
            throw new Error("No Records found today");
        }

        for (const avg_value of scorecard) {
            allAvgValues.push(avg_value.AVG_VALUE);
        }
        const yesterday = new Date();
        yesterday.setDate(yesterday.getDate() - 1);

        let formattedDate = yesterday.toISOString().split('T')[0]; // yyyy-MM-dd

        const DAILY_AVG_VALUES = {

            [formattedDate]: allAvgValues
        }
        const totalDates = Object.keys(allAvgValues).length;
        const totalItems = FUNCTIONALITY_TEMPLATE.length;
        const expectedDocs = totalDates * totalItems;



        log.push('[STEP 1/3] Connecting to MongoDB (team-nps-db)...');
        let db;
        try {
            db = await connectToDatabase('team-nps-db');
            log.push('✅ Connected to MongoDB database: team-nps-db');
        } catch (dbError) {
            console.error(' ❌ FAILED to connect to MongoDB.');
            console.error(`Error: ${dbError.message}`);

        }

        log.push('[STEP 2/3] Generating enriched scorecard records...');
        let allRecords;
        try {
            allRecords = generateAllScorecardRecords(DAILY_AVG_VALUES);
            log.push(`✅ Generated ${allRecords.length} records across ${totalDates} dates`);
            const dateKeys = Object.keys(DAILY_AVG_VALUES).sort();
            dateKeys.forEach(dateStr => {
                const count = allRecords.filter(r => r.Current_date_str === dateStr).length;
                log.push(`📅 ${dateStr}  →  ${count} records`);
            });
        } catch (genError) {
            console.error('❌ FAILED to generate scorecard records.');
            console.error(`Error: ${genError.message}`);

        }

        log.push(`[STEP 3/3] Inserting ${allRecords.length} records into NPS_SCORECARD...`);
        let insertedCount = 0;
        let message = '';
        try {
            const collection = db.collection('NPS_SCORECARD');


            const dateFilter = { Current_date_str: formattedDate };
            const dTotal = await collection.countDocuments({ ...dateFilter, type: 'nps_scorecard' });
            if (dTotal > 0) {
                message = `Records already loaded to NPS_SCORECARD collection for thsi date ${formattedDate}`;

            }
            else {
                const result = await collection.insertMany(allRecords);
                insertedCount = result.insertedCount;
                message = `Successfully uploaded ${insertedCount} scorecard records to NPS_SCORECARD collection`;

                log.push(`✅ Inserted ${insertedCount} records into NPS_SCORECARD`);
            }
        } catch (insertError) {
            console.error('❌ FAILED to insert scorecard data.');
            console.error(`Error: ${insertError.message}`);

        }
        return ({
            success: true,
            message: message,
            insertedCount: insertedCount,
            log
        });
    } catch (error) {
        console.error('[scorecard/upload] Error:', error);
        return ({ success: false, error: error.message, log }, { status: 500 });
    }
}
