
import { Transaction } from 'mongodb';
import { getSapRecords } from '../querySAP';
import { chatCompletion } from "@/app/services/chatCompletionService2";

async function validateDate(dateValue) {
  const regex = /'(January|February|March|April|May|June|July|August|September|October|November|December)\s\d{4}\sWk\s[1-5]'/g;

  const matches = dateValue.match(regex);

  if (!matches) {
    throw new Error("Expected exactly values in format 'Month YYYY Wk N'");
  }


  return true;
}
export async function apValidationNode(state) {
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
Today's Date/Current Date: ${currentDate}

Extraction Rule
Using the Input Query and the Identifiers to extract the month, week and year. Use CurrentDate value to know the week, month and Year
Ex. Prepare AP Validations for "Week 3 of this month" or "August 2026 Week 3" or "Wk 3 of June 2026"

Using the given week, month and year, get the previous week of given month. If it is Week 1 of curent month, then it will Week 5 of previous month and provide in below format as output.
Ex. Given query as June 2026 Wk 3, then previous week of given Month is June 2026 Wk 2
Given query as June 2026 Wk 1, then previous week of given Month is May 2026 Wk 5

Request_Type=["analysis","general_inquiry","generate_summary","out_of_Scope"]
From the Input query, use the Request_type  to determine the request_type 
request_type to be
 - generate_summary only when user requested to Create/Generate AP Validations summary
 - analysis - when asked for analyze or analysis of validation summary
 - general_inquiry - When asked for generic queries on specific category
 - out_of_scoope - Apart from above queries

query_category to be:
- dollarReconQuery - When user ask for Commission or Reward total or general total
    - Current Period Deposits or Credits 
    - Current Period Held Incentives or Prior Period Held Incentives
- creditsNotGeneratedQuery - When user ask for Credit not generated for the period


Output Format:
{"currentWeek":"'July 2026 Wk 3'","previousWeek':"'July 2026 Wk 2'","request_type":"","query_category":"")

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
    let currentWeek = result.currentWeek
    let previousWeek = result.previousWeek
    let request_type = result.request_type
    let sqlQuery = result.query_category

    const currentWeekValidation = await validateDate(currentWeek)
    const previousWeekValidation = await validateDate(previousWeek)
    if (currentWeekValidation && previousWeekValidation) {
      const dollarReconQuery =
        `
select 'Commission', table1.cpd, table2.cpi, table3.ppi, table4.cpc, round (sum(table1.cpd+table2.cpi-table3.ppi-table4.cpc)) from
(select  coalesce(sum(value),0) cpi  from bcsprd.cs_incentive_vw
where value !=0
and periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01') 
and name in ('I Commission Held' , 'I GA Overrides Held','I Medicare Total')) table2 ,
(select coalesce(sum(value),0) cpd  from bcsprd.cs_deposit_vw 
where periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and earninggroupid='Commission') table1,
(select coalesce(sum(value),0) ppi  from bcsprd.cs_incentive_vw
where value !=0
and periodseq=(select periodseq from bcsprd.cs_period_vw where name=${previousWeek}  and removedate='2200-01-01')
and (name in ('I Commission Held','I GA Overrides Held','I Medicare Total') )) table3,
(select coalesce(sum(value),0) cpc from bcsprd.cs_credit_vw 
where periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and name in ('C PMPM Commission New','C PMPM Commission New Historical','C PMPM Commission Previous',
'C Adjust Commission','C Adjust Commission/Override - NCR','C Adjust Commission/Override - SCR','C General Agency Override',
 'C PPX Commissions Current', 'C PPX Commissions Prior', 'C Adjust override - NCR','C Adjust Override - SCR',
 'CR General Agency Override Rate 3.86%', 'CR General Agency Override Rate Slab', 'CR LISI General Agency Override', 'CR PPX Tier Commission',
'CR Disenrollment Admin Fee','CR Enrollment Commission','CR Enrollment Admin Fee','CR Disenrollment Commission','CR LISI General Agency Override NEW','CR General Agency Override Rate Slab 2016','CR Non Warner PMPM','CR Warner PMPM',
'CR GA LGS 2018','CR PSPM Commission New','CR PSPM Commission ROC')) table4 
group by table1.cpd, table2.cpi, table3.ppi, table4.cpc

union

select 'Reward', rtable1.rcpd, rtable2.rcpi, rtable3.rppi, rtable4.rcpc, sum(rtable1.rcpd+rtable2.rcpi-rtable3.rppi-rtable4.rcpc) from 
(select coalesce(sum(value),0) rcpd from bcsprd.cs_deposit_vw 
where periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and earninggroupid='Reward')rtable1,
(select coalesce(sum(value),0) rcpi from bcsprd.cs_incentive_vw
where value !=0
and periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and name='I Reward Held') rtable2,
(select coalesce(sum(value),0) rppi  from bcsprd.cs_incentive_vw
where value !=0
and periodseq=(select periodseq from bcsprd.cs_period_vw where name=${previousWeek}  	and removedate='2200-01-01')
and name='I Reward Held') rtable3,
(select coalesce(sum(rrtable1.rrcpc+rrtable2.rrcpy),0) rcpc from
 (select coalesce(sum(value),0) rrcpc from bcsprd.cs_credit_vw
where periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and name in ('C Adjust Reward','C Bonus','C Individual Reward','C Persistency Reward','C Persistency Reward Member date','CR CALTech-JPL Reward', 'CR Individual Reward 2016','CR Individual Reward FreewayInsurance','CR Individual Reward 2018 Keenan',
'CR Individual Reward KCAL 2018','CR Persistency Reward Keenan', 'CR Individual Reward QuoteSelect','CR Retention Reward PMPM 2022','CR KPIF Renewal reward PMPM 2022',
'CR Initial Reward PMPM 2022','CR Adjust GA Bonus')) rrtable1,
 (select coalesce(sum(value),0) rrcpy from bcsprd.cs_incentive_vw
where value!=0
and periodseq=(select periodseq from bcsprd.cs_period_vw where name=${currentWeek} and removedate='2200-01-01')
and name in ('I Production Reward CY','I Production Reward PY')) rrtable2) rtable4
group by rtable1.rcpd, rtable2.rcpi, rtable3.rppi, rtable4.rcpc;

;`

      const heldIncentiveCommQuery = `select p.payeeid, i.name, round(i.value, 2) from bcsprd.cs_incentive_vw i, bcsprd.cs_payee_vw p 
where i.name in ('I Commission Held') 
and i.payeeseq = p.payeeseq 
and p.removedate = '2200-01-01' 
and effectiveenddate = '2200-01-01' 
and i.periodseq = (select distinct periodseq from bcsprd.cs_period_vw where name =${currentWeek} 
) 
and round(i.value, 2) <> 0 
order by i.value desc`

      const gaIncentiveQuery = `select p.payeeid, i.name, round(i.value, 2) from bcsprd.cs_incentive_vw i, bcsprd.cs_payee_vw p 
where i.name in ('I GA Overrides Held') 
and i.payeeseq = p.payeeseq 
and p.removedate = '2200-01-01' 
and effectiveenddate = '2200-01-01' 
and i.periodseq = (select distinct periodseq from bcsprd.cs_period_vw where name =${currentWeek} )
and round(i.value, 2) <> 0 
order by i.value desc ;`


      const medicareIncentiveReport = `select p.payeeid, i.name||' Held', round(i.value, 2) from bcsprd.cs_incentive_vw i, bcsprd.cs_payee_vw p 
where i.name in ('I Medicare Total') 
and i.payeeseq = p.payeeseq 
and p.removedate = '2200-01-01' 
and effectiveenddate = '2200-01-01' 
and i.periodseq = (select distinct periodseq from bcsprd.cs_period_vw where name =${currentWeek} )
and round(i.value, 2) <> 0 
order by i.value desc ;`

      const heldIncentiveRewardQuery = `select p.payeeid, i.name, round(i.value, 2) from bcsprd.cs_incentive_vw i, bcsprd.cs_payee_vw p 
where i.name in ('I Reward Held') 
and i.payeeseq = p.payeeseq 
and p.removedate = '2200-01-01' 
and effectiveenddate = '2200-01-01' 
and i.periodseq = (select distinct periodseq from bcsprd.cs_period_vw where name = ${currentWeek} )
and round(i.value, 2) <> 0 
order by i.value desc ;`

      const creditsNotGeneratedQuery = `SELECT e.eventtypeid ,s.compensationdate , count( distinct salestransactionseq) as count FROM 
 bcsprd.cs_salestransaction_vw s, bcsprd.cs_eventtype_vw e 
where  s.compensationdate>=(SELECT MAX(p1.enddate) stdate
FROM bcsprd.cs_period_vw p1,
     bcsprd.cs_pipelinerun_vw pr1,
     bcsprd.cs_periodtype_vw pt1
WHERE p1.removedate>='2200-01-01'
    AND p1.periodseq = pr1.periodseq
    AND p1.periodtypeseq = pt1.periodtypeseq
    AND pt1.name = 'week'
    AND pr1.description LIKE '%Finalize%'
	AND pr1.description NOT LIKE '%UnFinalize%'	
    AND pr1.status = 'Successful') and s.compensationdate <=(SELECT MAX(enddate) FROM (SELECT p.enddate FROM bcsprd.cs_period_vw p, bcsprd.cs_periodtype_vw pt, (SELECT MAX(p1.enddate) eddate FROM bcsprd.cs_period_vw p1, bcsprd.cs_pipelinerun_vw pr1, bcsprd.cs_periodtype_vw pt1 WHERE p1.removedate>='2200-01-01' AND p1.periodseq = pr1.periodseq AND p1.periodtypeseq = pt1.periodtypeseq AND pt1.name = 'week' AND pr1.description LIKE '%Finalize%' AND pr1.description NOT LIKE '%UnFinalize%' AND pr1.status = 'Successful') WHERE  p.enddate > eddate AND p.periodtypeseq = pt.periodtypeseq AND pt.name = 'week' AND p.removedate>='2200-01-01' ORDER BY p.enddate ASC) limit 5)
and s.salestransactionseq not in (select distinct bcsprd.cs_credit_vw.salestransactionseq from bcsprd.cs_credit_vw 
where bcsprd.cs_credit_vw.compensationdate>=(SELECT MAX(p1.enddate) stdate
FROM bcsprd.cs_period_vw p1,
     bcsprd.cs_pipelinerun_vw pr1,
     bcsprd.cs_periodtype_vw pt1
WHERE p1.removedate>='2200-01-01'
    AND p1.periodseq = pr1.periodseq
    AND p1.periodtypeseq = pt1.periodtypeseq
    AND pt1.name = 'week'
    AND pr1.description LIKE '%Finalize%'
	AND pr1.description NOT LIKE '%UnFinalize%'	
    AND pr1.status = 'Successful') and bcsprd.cs_credit_vw.compensationdate <=(SELECT MAX(enddate) FROM (SELECT p.enddate FROM bcsprd.cs_period_vw p, bcsprd.cs_periodtype_vw pt, (SELECT MAX(p1.enddate) eddate FROM bcsprd.cs_period_vw p1, bcsprd.cs_pipelinerun_vw pr1, bcsprd.cs_periodtype_vw pt1 WHERE p1.removedate>='2200-01-01' AND p1.periodseq = pr1.periodseq AND p1.periodtypeseq = pt1.periodtypeseq AND pt1.name = 'week' AND pr1.description LIKE '%Finalize%' AND pr1.description NOT LIKE '%UnFinalize%' AND pr1.status = 'Successful') WHERE  p.enddate > eddate AND p.periodtypeseq = pt.periodtypeseq AND pt.name = 'week' AND p.removedate>='2200-01-01' ORDER BY p.enddate ASC) limit 5))
and s.eventtypeseq=e.datatypeseq
and e.removedate='2200-01-01'
group by s.compensationdate, eventtypeid
order by s.compensationdate, eventtypeid;
`
      if (sqlQuery == 'creditsNotGeneratedQuery') { sqlQuery = creditsNotGeneratedQuery }
      if (sqlQuery == 'dollarReconQuery') { sqlQuery = dollarReconQuery }

      let sapResponse = []
      let groupedSummary;
      let medicareSummary;



      let trendResults = await getSapRecords(sqlQuery);




      if (trendResults.length === 0) {
        sapResponse.push("No records available.");
      }
      else {



      }
      // console.log(medicareSummary)

      return {
        ...state, apValidationResults: { trendResults, "requestType": request_type }
      };
    }
    else {
      throw new Error('Date Format Incorrect')
    }

    // }
    // else { return { ...state } }

  } catch (e) {
    console.warn('[getSapPaymentNode]] Failed to process :', e.message);
    return {
      ...state, apValidationResults: []
    };
  }
}