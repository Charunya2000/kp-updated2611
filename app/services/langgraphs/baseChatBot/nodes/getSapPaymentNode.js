
import { Transaction } from 'mongodb';
import { getSapRecords } from '../querySAP';
import { chatCompletion } from "@/app/services/chatCompletionService2";

async function validateDate(dateValue) {
  const regex = /'(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{4}\sWk\s[1-5]'/g;

  const matches = dateValue.match(regex);

  if (!matches || matches.length !== 3) {
    throw new Error("Expected exactly 3 values in format 'Month YYYY Wk N'");
  }

  // Ensure nothing else exists in the string
  const reconstructed = `(${matches.join(',')})`;
  if (reconstructed !== dateValue) {
    throw new Error("Invalid format");
  }

  return true;
}
export async function getSapPaymentNode(state) {
  try {

    // let previousIdentifier = ''
    //  if (state.structuredMemory.activeDomain == 'payment_summary') { previousIdentifier = state.structuredMemory.domains['payment_summary'].lastIdentifier }
    // if (!previousIdentifier) {
    const currentDate = new Date().toString();
    const defaultSystemMessage = {
      role: "system",
      content: `
Role:You are an Data generator agent.Your job is to determine previous month and previous year of current month from the provided user query and generate output as per given format.
In addition, you are required to determine type of request into 4 categories provided

Input Query: ${state.userPrompt}
Identifiers: ${state.identifiers}
CurrentDate: ${currentDate}

Payment Cycles (JSON):

    {
  "2026 Week3": [
    "August 13 Thu",
    "September 15 Tue",
    "October 13 Tue",
    "November 16 Mon",
    "December 15 Tue"
  ],
  "2026 Week5": [
    "August 25 Tue",
    "September 25 Fri",
    "October 26 Mon",
    "November 24 Tue",
    "December 23 Wed"
  ]

Extraction Rule:
Using the Input Query, extract the month, week and year.
Ex. Preapre payment summary for "April 2026 Week 3" or "Apr 2026 Wk 3", then it will be "April 2026 Wk 3".
If given in any other format or requested as "Entier Year" or "last 3 months" or so , consider as "out_of_scope"

Using the given month and year, get the previous year of given month and previous month of given year and provide in below format as output.
Ex. Given query as June 2026 Wk 3, then
previous year of given Month->June 2025 Wk 3
previous month of given Month->May 2026 Wk 3

Request_Type=["analysis","general_inquiry","generate_summary","out_of_Scope","paymentcycle_query"]
Category=["Week3","Week5","Week2"]

From the Input query, use the Request_type, Category and PaymentCycles to determine the request_type, category and payment_cycle
request_type to be
 - generate_summary only when user requested to Create/Generate Payment summary
 - analysis - when asked for analyze or analysis of payment summary
 - general_inquiry - When asked for generic queris on specific payment category or Why there is a drop in standard commission paymen
 - trueUp_Summary - When asked for true up summary for specific period
 - paymentcycle_query - When asked for upcoming , list out payment cycles/dates for current year. 
 - out_of_scope - Apart from above queries
payment_cycle to be
  - Based on current date, populate exact date of payment from the payment cycles JSON

Output Format:
{"dateQuery":"('May 2026 Wk 3','June 2026 Wk 3','June 2025 Wk 3')","request_type":"","category":"","payment_cycle":"")

Output Rule:
Only provide the output in format asked
No Explanation or additional formation needed
`
    };

    const systemMessage = defaultSystemMessage;
    const userMessage = { role: "user", content: `User input: Extract request_type and date query as per format ` };


    const messages = [
      //{ role: "system", content:prompt},// "You extract database identifiers from user queries. Return only valid JSON." },
      systemMessage,
      userMessage];

    const response = await chatCompletion({
      model: "gpt-4o",
      temperature: 0,
      max_tokens: 500,
      messages: messages,
      teamName: state?.teamName,
      assistantName: state?.assistantName,
      nuid: state?.nuid
    });

    let identifiers = '';

    const intentResponse = response
      .replace(/```json|```/g, "")
      .trim();
    const result = JSON.parse(intentResponse)
    let dateParameter = result.dateQuery
    let requestType = result.request_type
    let category = result.category
    let paymentCycle = result.payment_cycle
    if (requestType == "paymentcycle_query") {
      return {
        ...state, paymentResults: { "CommissionSummary": [], "Medicare Summary": [], "requestType": requestType, "category": category, "RewardSummary": [], "TrueupSummary": [], "PaymentCycle": paymentCycle }
      };
    }
    else if (requestType == "out_of_scope") {
      return {
        ...state, paymentResults: { "CommissionSummary": [], "Medicare Summary": [], "requestType": requestType, "category": category, "RewardSummary": [], "TrueupSummary": [], "PaymentCycle": paymentCycle }
      };
    }
    else {
      const dateValidation = await validateDate(dateParameter)
      if (dateValidation) {
        const sqlQuery =
          `SELECT * FROM (select p.name,e.eventtypeid,ct.credittypeid,count(distinct t.salestransactionseq),sum(c.value)
from bcsprd.cs_salestransaction_vw t, bcsprd.cs_eventtype_vw e,bcsprd.cs_credit_vw c, bcsprd.cs_credittype_vw ct, bcsprd.cs_period_vw p
where e.datatypeseq=t.eventtypeseq
and t.compensationdate=c.compensationdate
and c.periodseq=p.periodseq
and p.removedate='2200-01-01'
and p.name in ${dateParameter}
and t.salestransactionseq=c.salestransactionseq
and ct.removedate='2200-01-01'
and ct.datatypeseq=c.credittypeseq
AND e.eventtypeid NOT IN ('Production Reward')
and t.compensationdate between p.startdate and p.enddate
group by p.name,e.eventtypeid,ct.credittypeid
UNION all
select p.name,'Production Reward',i.name,count(1),sum(value) from bcsprd.cs_incentive_vw i, bcsprd.cs_period_vw p
where p.periodseq=i.periodseq
and p.removedate='2200-01-01'
and p.name in ${dateParameter}
and i.name in ('I Production Reward CY','I Production Reward PY')
group by p.name,i.name)
ORDER BY 1,2,3;`

        const medicareQuery = `SELECT name,Med,sum(val) FROM (
select payeeid,CASE WHEN payeeid IN (397515,397750 ,384193,384190,417444, 424094) THEN 'Medicare (FMO)'
WHEN payeeid IN (386235,386282,386285 ,361764, 411053) THEN 'Medicare (WBE)' ELSE 'Medicare (WBEX)' END AS Med,
sum(d.value) val,p.name FROM
bcsprd.cs_deposit_vw d, bcsprd.cs_period_vw p, bcsprd.cs_payee_vw pa,
bcsprd.cs_position_vw po, bcsprd.cs_title_vw t
where p.periodseq=d.periodseq
AND d.payeeseq=pa.payeeseq
AND d.positionseq=po.ruleelementownerseq
AND po.titleseq=t.ruleelementownerseq
AND po.payeeseq=pa.payeeseq
AND t.name LIKE '%Medicare%'
AND po.removedate='2200-01-01'
AND t.removedate='2200-01-01'
and p.removedate='2200-01-01'
and pa.removedate='2200-01-01'
and p.name in ${dateParameter}
group by PAYEEID,p.name ) GROUP BY med,name ORDER BY 1`
        let sapResponse = [];
        let groupedSummary;
        let medicareSummary;
        let rewardsSummary;
        let trendResults, medicareResults, trueUpResults;


        if (requestType == 'trueUp_Summary') {
          let trueupSql = `
select t.compensationdate,e.eventtypeid,
count(distinct t.salestransactionseq),sum(c.value),ct.credittypeid
from bcsprd.cs_salestransaction_vw t, bcsprd.cs_eventtype_vw e,bcsprd.cs_credit_vw c, bcsprd.cs_credittype_vw ct, bcsprd.cs_period_vw p
where e.datatypeseq=t.eventtypeseq
and t.compensationdate=c.compensationdate
and c.periodseq=p.periodseq
and p.removedate='2200-01-01'
and p.name in (SELECT name FROM bcsprd.cs_period_vw WHERE removedate = '2200-01-01' AND 
PERIODSEQ IN
      (SELECT min(
        p.PERIODSEQ)
      FROM bcsprd.cs_period_vw p, 
      (SELECT MAX(p1.enddate) stdate
FROM bcsprd.cs_period_vw p1,
     bcsprd.cs_pipelinerun_vw pr1,
     bcsprd.cs_periodtype_vw pt1
WHERE p1.removedate>='2200-01-01'
    AND p1.periodseq = pr1.periodseq
    AND p1.periodtypeseq = pt1.periodtypeseq
    AND pt1.name = 'week'
    AND pr1.description LIKE '%Finalize%' AND pr1.description NOT LIKE '%UnFinalize%' 
    AND pr1.status = 'Successful')fp
    WHERE p.startdate>= fp.stdate
      AND p.removedate = '2200-01-01'
      AND p.name LIKE '%Wk 3%'
      ) )
and t.salestransactionseq=c.salestransactionseq
and ct.removedate='2200-01-01'
and ct.datatypeseq=c.credittypeseq
and t.compensationdate between p.startdate and p.enddate
group by e.eventtypeid,ct.credittypeid,t.compensationdate;

`
          trueUpResults = await getSapRecords(trueupSql);
        }
        else {
          trendResults = await getSapRecords(sqlQuery);
          medicareResults = await getSapRecords(medicareQuery)




          if (trendResults.length === 0) {
            sapResponse.push("No records available.");
          }
          else {

            let creditResult;
            if (category == "Week3" || category == "Week2") {
              creditResult = trendResults.map(item => {
                let typeValue = "Unknown Type";
                if (item.CREDITTYPEID.toLowerCase().includes("adjust commission")) {
                  typeValue = "Adjust Commissions";
                } else if (item.CREDITTYPEID.toLowerCase().includes("commission") && !(item.CREDITTYPEID.toLowerCase().includes("adjust commission"))) {
                  typeValue = "Standard Commissions";
                } else if (item.CREDITTYPEID.toLowerCase().includes("reward")) {
                  typeValue = "Rewards";
                }
                else if (item.CREDITTYPEID.toLowerCase().includes("ga override")) {
                  typeValue = "General Agency";
                }

                const credit = parseFloat(item["SUM(VALUE)"])

                return {
                  TimePeriod: item.NAME,
                  EventType: item.EVENTTYPEID,
                  CreditType: item.CREDITTYPEID,
                  Transactions: item["COUNT(DISTINCT SALESTRANSACTIONSEQ)"],
                  CreditAmount: isNaN(credit) ? 0 : credit,
                  Type: typeValue
                };
              });
            }
            else {
              creditResult = trendResults.map(item => {
                let typeValue = "Unknown Type";
                if (item.EVENTTYPEID.toLowerCase().includes("kpif initial")) {
                  typeValue = "KPIF New Business Rewards";
                } else if (item.EVENTTYPEID.toLowerCase().includes("kpif renewal")) {
                  typeValue = "KPIF Renewal Rewards";
                } else if (item.EVENTTYPEID.toLowerCase().includes("production reward")) {
                  typeValue = "Production Rewards";
                }
                else if (item.EVENTTYPEID.toLowerCase().includes("bonus")) {
                  typeValue = "Manual Transaction Rewards";
                }
                else if (item.CREDITTYPEID.toLowerCase().includes("adjust commission")) {
                  typeValue = "Off-Cycle Commissions";
                }


                const credit = parseFloat(item["SUM(VALUE)"])
                return {
                  TimePeriod: item.NAME,
                  EventType: item.EVENTTYPEID,
                  CreditType: item.CREDITTYPEID,
                  Transactions: item["COUNT(DISTINCT SALESTRANSACTIONSEQ)"],
                  CreditAmount: isNaN(credit) ? 0 : credit,
                  Type: typeValue
                };
              });
            }
            // console.log(creditResult)
            groupedSummary = creditResult.reduce((accumulator, item) => {
              const timePeriod = item.TimePeriod;
              const type = item.Type;
              const creditAmount = item.CreditAmount || 0;
              const transactions = item.Transactions || 0;

              const groupKey = `${timePeriod}_${type}`;
              const timeKey = `Total ${timePeriod}`;
              if (type != 'Unknown Type') {
                //   if (!accumulator[groupKey]) {
                //     accumulator[groupKey] = {
                //       //timePeriod: timePeriod,
                //      // Type: type,
                //       "CreditAmount": 0
                //     };
                //   }
                if (!accumulator[timeKey]) {
                  accumulator[timeKey] = {
                    TotalCredit: 0,
                    TotalTransactions: 0,
                    byType: {}
                  };
                }

                // Overall for this timePeriod

                accumulator[timeKey].TotalCredit += creditAmount;
                accumulator[timeKey].TotalTransactions += transactions;

                // Create type inside timePeriod
                if (!accumulator[timeKey].byType[type]) {
                  accumulator[timeKey].byType[type] = {
                    transactions: 0,
                    totalAmount: 0
                  };
                }

                // Type-level aggregation
                accumulator[timeKey].byType[type].transactions += transactions;
                accumulator[timeKey].byType[type].totalAmount += creditAmount;
                // if (!accumulator[timeKey]) {
                //   accumulator[timeKey] = {
                //     //timePeriod: timePeriod,
                //     // Type: type,
                //   type,count:0,amount:0,
                //     "Total Credit": 0, "Total Transaction": 0
                //   };
                // }

                //accumulator[timeKey]["] += creditAmount;

                //   accumulator[timeKey][type].amount = (accumulator[timeKey][type] || 0) + creditAmount;
                //    accumulator[timeKey][type].count = (accumulator[timeKey][type] || 0) + transactions;
                // //   accumulator[timeKey][type] = (accumulator[timeKey][type] || 0) + transactions;
                //   accumulator[timeKey]["Total Credit"] += creditAmount;
                //   accumulator[timeKey]["Total Transaction"] += transactions;
              }
              return accumulator;
            }, {});

            // console.log(groupedSummary)
            let rewardResult;
            if (requestType == "analysis") { rewardResult = creditResult.filter(item => (item.Type === 'Rewards')) }
            else { rewardResult = creditResult.filter(item => (item.Type === 'Rewards' && item.TimePeriod === state.identifiers)) }
            rewardsSummary = rewardResult.reduce((accumulator, item) => {
              const timePeriod = item.TimePeriod;
              const type = item.EventType;
              const creditAmount = item.CreditAmount || 0;
              const transactions = item.Transactions || 0;

              const groupKey = `${timePeriod}_${type}`;
              const timeKey = `Total ${timePeriod}`;
              if (type != 'Unknown Type') {
                //   if (!accumulator[groupKey]) {
                //     accumulator[groupKey] = {
                //       //timePeriod: timePeriod,
                //      // Type: type,
                //       "CreditAmount": 0
                //     };
                //   }
                if (!accumulator[timeKey]) {
                  accumulator[timeKey] = {
                    TotalCredit: 0,
                    TotalTransactions: 0,
                    byType: {}
                  };
                }

                // Overall for this timePeriod

                accumulator[timeKey].TotalCredit += creditAmount;
                accumulator[timeKey].TotalTransactions += transactions;

                // Create type inside timePeriod
                if (!accumulator[timeKey].byType[type]) {
                  accumulator[timeKey].byType[type] = {
                    transactions: 0,
                    totalAmount: 0
                  };
                }

                // Type-level aggregation
                accumulator[timeKey].byType[type].transactions += transactions;
                accumulator[timeKey].byType[type].totalAmount += creditAmount;
              }
              return accumulator;
            }, {});


            medicareSummary = medicareResults.reduce((accumulator, item) => {
              const timePeriod = item.NAME;
              const med = item.MED;
              const credit = parseFloat(item["SUM(VAL)"])

              const groupKey = `${timePeriod}`;

              if (!accumulator[groupKey]) {
                accumulator[groupKey] = {
                  [med]: credit,
                  "TotalAmount": 0
                };

              }
              accumulator[groupKey][med] = credit
              accumulator[groupKey]["TotalAmount"] += credit


              return accumulator;
            }, {});

          }
        }
        // console.log(medicareSummary)

        return {
          ...state, paymentResults: { "CommissionSummary": groupedSummary, "Medicare Summary": medicareSummary, "requestType": requestType, "category": category, "RewardSummary": rewardsSummary, "TrueupSummary": trueUpResults, "PaymentCycle": paymentCycle }
        };
      }
      else {
        throw new Error('Date Format Incorrect')
      }

      // }
      // else { return { ...state } }

    }
  } catch (e) {
    console.warn('[getSapPaymentNode]] Failed to process :', e.message);
    return {
      ...state, paymentResults: []
    };
  }
}