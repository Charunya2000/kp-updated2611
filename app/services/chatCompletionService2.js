import { AzureOpenAI } from "openai";
// Example setup for using js-tiktoken
// import { encodingForModel } from 'js-tiktoken';
import { countTokens } from "./countTokensService";
import { getFeatureFlag } from "./featureFlagService";
import { recordLLMInteraction, recordFailure, recordAssistantPromptSubmittedViaAPI } from "./statisticsService";
import { generateChatCompletion } from "./nexusos/completionsClient.js";
import { generateChatResponse } from "./nexusos/responsesClient.js";

import { getServerSession } from '@utils/getSession';
import { createSubscriberMRN, createFamilyMRN } from '@/app/ets/generate-test-mrn-v2/services/subscriberMRNService';
import { getSCTaskById } from '@/app/services/langgraphs/prodSupport/tools/getSCTaskById';
import { getSCTasksByKeyword, SCTASK_SEARCHABLE_COLUMNS } from '@/app/services/langgraphs/prodSupport/tools/getSCTasksByKeyword';

const tokenLimit = process.env[`kp.nexusos.org.tokenLimit`] ?? 128000;
let completionsClient = null;
let responsesClient = null;
const PROD_SUPPORT_TOOL_LOG_TAG = '[ProdSupportToolGraph]';

function getCompletionsClient() {
  if (!completionsClient) {
    const envName = process.env['envName'];
    const completionsEndpoint = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.completionsEndpoint`];
    const completionsAPIKey = process.env[`host.${envName}-aiportal-web-2.aisvc.aksnp.azure.kp.org.openai.api.key`];
    const completionsDeployment = (envName === 'pp') ? 'gpt-4o' : 'gpt-4o-aisvc';
    const completionsDeploymentAPIiVersion = "2024-08-01-preview";
    completionsClient = new AzureOpenAI({
      apiVersion: completionsDeploymentAPIiVersion,
      endpoint: completionsEndpoint,
      apiKey: completionsAPIKey,
      deployment: completionsDeployment
    });
  }
  return completionsClient;
}

// used in other services to filter available tools to a specific chat
export const AVAILABLE_TOOLS = {
  getSnowTicket: 'get_snow_ticket',
  createSnowTicket: 'create_snow_ticket',
  createSubscriberMrn: 'create_subscriber_mrn',
  createFamilyMrn: 'create_family_mrn',
  getSCTaskById: 'get_sctask_by_id',
  getSCTasksByKeyword: 'get_sctasks_by_keyword'
};
// Define tool schema for ServiceNow ticket retrieval and creation
const TOOLS = [
  {
    type: "function",
    function: {
      name: "get_snow_ticket",
      description: "Look up, search for, or retrieve details about a ServiceNow (SNOW) ticket by its ticket number. Use this when users ask to find, look up, check, or get information about a SNOW ticket, incident, or case. If the user doesn't provide a ticket number, ask them for it before calling this tool.",
      parameters: {
        type: "object",
        properties: {
          ticketNo: {
            type: "string",
            description: "The ticket number (e.g., RITM1234567, INC0123456)"
          }
        },
        required: ["ticketNo"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_snow_ticket",
      description: "Create a new ServiceNow (SNOW) ticket. Use this when users ask to create, open, submit, or file a new SNOW ticket, incident, or request. All required fields must be provided before calling this tool. If any required field is missing, ask the user for it.",
      parameters: {
        type: "object",
        properties: {
          category: {
            type: "string",
            description: "The category of the ticket. It can be one of: access, compliance_audits, error, facilities, failure_broken_down, how_to, lost_stolen, performance_capacity_slow, request"
          },
          configurationItem: {
            type: "string",
            description: "<sys id> of the Configuration Item that needs to be added to the incident"
          },
          shortDescription: {
            type: "string",
            description: "A brief description of the ticket issue or request"
          },
          requestedFor: {
            type: "string",
            description: "The NUID of the person this ticket is requested for. If not provided the current user's NUID will be used."
          },
          environment: {
            type: "string",
            description: "Optional environment information. May be one of: development, test, training, staging, psup, pre-production, disaster_recovery, production"
          },
          impact: {
            type: "string",
            description: "Optional impact level. May be one of: 1, 2, 3, 4",
          },
          urgency: {
            type: "string",
            description: "Optional urgency level. May be one of: 1, 2, 3, 4"
          },
          vendorReference: {
            type: "string",
            description: "Optional vendor reference information"
          },
        },
        required: ["category", "configurationItem", "shortDescription"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_subscriber_mrn",
      description: "Create a Subscriber MRN (Medical Record Number) in a Kaiser test environment via the MemberEnrollment SOAP service. Use this when the user asks to create / provision / generate a Subscriber MRN. Required fields are region and coverageName. All other fields are optional and will be system-generated if not provided (gender and dateOfBirth are generated from memberType when omitted). Use responseFormat to control the shape of the confirmation message. If a required field is missing, ask the user for it before calling the tool.",
      parameters: {
        type: "object",
        properties: {
          region: {
            type: "string",
            enum: ["CO", "NW", "HI", "MAS", "GA", "NCAL", "SCAL"],
            description: "Region code, one of CO, NW, HI, MAS, GA, NCAL, SCAL. Mandatory and must come directly from the user. NEVER invent, guess, default, or infer the region (including from a template field left blank like 'Region:'). If the user did not explicitly provide a region, do NOT call this tool — ask the user for the region first."
          },
          gender: {
            type: "string",
            enum: ["Male", "Female", "M", "F"],
            description: "Member gender. Accepts Male, Female, M, or F only. Optional — if the user does not mention gender at all, do NOT ask for it; omit the field and the service will default to Male. Only ask the user if they explicitly included a Gender field but left it blank (e.g. in a template)."
          },
          dateOfBirth: {
            type: "string",
            description: "Member date of birth. Accepts YYYY-MM-DD or MM/DD/YYYY. Optional — if the user does not mention date of birth at all, do NOT ask for it; omit the field and the service will auto-generate one based on memberType. Only ask the user if they explicitly included a DOB / Date of Birth field but left it blank (e.g. in a template)."
          },
          coverageName: {
            type: "string",
            enum: ["HMO", "DHMO", "MEDICAID", "MEDICARE", "SELF_FUNDED", "NO_COVERAGE"],
            description: "Coverage plan name. Must be exactly one of: HMO, DHMO, MEDICAID, MEDICARE, SELF_FUNDED, NO_COVERAGE. MEDICARE and SELF_FUNDED are only offered in CO and GA (GA SELF_FUNDED is TGG1 only). NO_COVERAGE (aka NMP / Non-Member Patient) is only offered in CO, NW, GA, HI (Common Membership) and sends doesSubscriberHaveCvg=No with zeroed GroupID/SubGroupID/BillGroupID. Use NO_COVERAGE when the user asks for 'no coverage', 'NMP', or 'Non-Member Patient'. Determines GroupID/SubGroupID/BillGroupID. Mandatory. If the user says 'any', 'whatever', 'doesn't matter', or otherwise defers the choice, DEFAULT to 'HMO' and tell the user in your response that HMO was picked as the default (e.g. 'I used HMO since you didn't specify a coverage plan')."
          },
          secondaryCoverageName: {
            type: "string",
            enum: ["HMO", "DHMO", "MEDICAID", "MEDICARE", "SELF_FUNDED"],
            description: "Optional. Only for dual coverage requests (e.g. 'Create a dual coverage adult subscriber MRN with primary as HMO and secondary as MEDICAID in the CO region'). The service creates the MRN with coverageName, then adds this second coverage to the same MRN. Supported in every region. Must differ from coverageName and be offered in the same region/environment (e.g. NCAL/SCAL only offer HMO and DHMO). Not valid when coverageName is NO_COVERAGE. If the user asks for dual coverage WITHOUT naming either plan (e.g. 'Create an adult subscriber MRN with dual coverage in CO region'), DEFAULT coverageName to 'HMO' and secondaryCoverageName to 'DHMO' — do NOT ask. Omit unless the user explicitly asks for dual / secondary coverage."
          },
          relation: {
            type: "string",
            description: "Relationship code (e.g. Subscriber, Spouse, Child). Defaults to Subscriber."
          },
          firstName: { type: "string", description: "Optional. System-generated if omitted." },
          lastName: { type: "string", description: "Optional. System-generated if omitted." },
          middleName: { type: "string", description: "Optional. Null values are acceptable." },
          maritalStatus: { type: "string", description: "Optional, e.g. Married or Unmarried. System-generated if omitted." },
          addressLine1: { type: "string", description: "Optional. System-generated if omitted." },
          addressLine2: { type: "string", description: "Optional. Null values are acceptable." },
          city: { type: "string", description: "Optional. System-generated if omitted." },
          state: { type: "string", description: "Optional 2-letter state code. Defaults to the region." },
          postalCode: { type: "string", description: "Optional. System-generated if omitted." },
          phoneNumber: { type: "string", description: "Optional. Accepts any common format (e.g. 555-123-4567, (555) 123-4567, 5551234567). A random 10-digit number is generated if omitted." },
          ssn: { type: "string", description: "Optional. If the user provides an SSN, pass it through exactly as given. A unique 9-digit SSN is generated if omitted." },
          coverageEffectiveDate: { type: "string", description: "Optional YYYY-MM-DD. Maps to the user's 'Coverage effective start date'. Defaults to the first day of the current month for active/terminated coverage, or the first of the month 3 months out for preEffective." },
          environment: {
            type: "string",
            description: "Region-specific environment name. Full mapping by upstream system — Common Membership: CO → ACG5, NW → UPG6, GA → TGG1 or TGG3, HI → CICSTEST. KMATE TMS: MAS → CLONE D or CLONE E or CLONE I. Foundation Systems: NCAL → B SET or M SET or C SET, SCAL → B SET or M SET or C SET. Behavior by region: (1) CO, NW, HI have exactly one valid value — do NOT ask the user; omit this field and the tool will auto-fill it. (2) GA, MAS, NCAL, SCAL have multiple options — you MUST ask the user which environment they want before calling the tool; do not guess or default. If the user supplies a value that does not match their region's mapping, the tool returns an error listing the valid options; relay that error and ask the user to provide the correct value."
          },
          memberType: {
            type: "string",
            enum: ["adult", "teen"],
            description: "Drives the generated date-of-birth age range when dateOfBirth is omitted: adult = older than 17 (18-130), teen = under 18 (13-17). Default 'adult'."
          },
          coverageTiming: {
            type: "string",
            enum: ["active", "preEffective", "terminated"],
            description: "active = coverage effective now or on the given date; preEffective = future-dated (e.g. 'starting next month', 'pre-effective member'). When preEffective and no coverageEffectiveDate is given, the service uses the first of the month 3 months from now. terminated = the service enrolls the member and then terminates that coverage (e.g. 'subscriber with terminated HMO coverage', 'termed coverage'); only supported for CO, HI, NW, MAS, GA (NOT NCAL/SCAL), not with NO_COVERAGE, and not with secondaryCoverageName. Default 'active'."
          },
          terminationDate: {
            type: "string",
            description: "Optional. Only used when coverageTiming is 'terminated'. Maps to the user's 'Coverage effective end date'. YYYY-MM-DD or MM/DD/YYYY; must be after the coverage start date. Pass only if the user gave an explicit end/termination date — otherwise omit and the service defaults it to today (or the day after coverage start if coverage starts today or later)."
          },
          responseFormat: {
            type: "string",
            enum: ["concise", "detailed", "grouped", "minimal", "preEffective", "teen"],
            description: "Output style for the confirmation message. Pick based on the SHAPE of the user's prompt, NOT the member's attributes. memberType=teen and coverageTiming=preEffective are independent data attributes and do NOT determine responseFormat. Decision order (check top to bottom, first match wins): (1) 'grouped' = the prompt contains ANY of: 'with demographics', 'include demographics', 'and demographics', 'share demographics', 'show demographics', or asks for a sectioned 'Subscriber Details / Coverage Details / Demographics' breakdown. This wins over 'concise' and 'detailed' even when name/DOB/gender are listed inline. (2) 'detailed' = the prompt includes a Contact Details block (address/city/zip/phone/SSN) inline. (3) 'concise' = template listing name/DOB/gender with a Coverage/Plan line but NO contact details and NO 'demographics' keyword. (4) 'teen' = short bare one-liner about a teen with no demographic template (e.g. 'create a teen subscriber, HMO, CO'). (5) 'preEffective' = short bare one-liner about a future-dated member with no demographic template (e.g. 'create a pre-effective subscriber, HMO, CO'). (6) 'minimal' = short one-liner with no demographics (e.g. 'create adult subscriber, HMO, CO'). Default 'concise'."
          }
        },
        required: ["region", "coverageName"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "create_family_mrn",
      description: "Create a family of Subscriber MRNs (Subscriber plus one or more dependents) in a Kaiser test environment via the MemberEnrollment SOAP service. Use this when the user asks to create / provision / generate FAMILY test MRNs, or asks for a Subscriber together with a Spouse / Teen / Child (any combination). The tool creates the primary Subscriber first, captures the returned MRN, then creates each requested dependent linked to that subscriber MRN (same family). Required: region, coverageName, and familyComposition. All demographic fields are optional and will be system-generated if not provided. Shared address/phone at the top level are applied to every family member unless that member provides their own override.",
      parameters: {
        type: "object",
        properties: {
          region: {
            type: "string",
            enum: ["CO", "NW", "HI", "MAS", "GA", "NCAL", "SCAL"],
            description: "Region code. Mandatory and must come directly from the user. NEVER invent, guess, default, or infer the region. If the user did not explicitly provide a region, do NOT call this tool — ask for it first."
          },
          coverageName: {
            type: "string",
            enum: ["HMO", "DHMO", "MEDICAID", "MEDICARE", "SELF_FUNDED"],
            description: "Coverage plan name. Must be exactly one of: HMO, DHMO, MEDICAID, MEDICARE, SELF_FUNDED. MEDICARE and SELF_FUNDED are only offered in CO and GA (GA SELF_FUNDED is TGG1 only). NO_COVERAGE/NMP is NOT valid here — it is only supported for an individual Subscriber MRN via create_subscriber_mrn, never for a family. Applied to every family member. Mandatory. If the user says 'any', 'whatever', 'doesn't matter', or otherwise defers the choice, DEFAULT to 'HMO' and tell the user in your response that HMO was picked as the default (e.g. 'I used HMO since you didn't specify a coverage plan')."
          },
          secondaryCoverageName: {
            type: "string",
            enum: ["HMO", "DHMO", "MEDICAID", "MEDICARE", "SELF_FUNDED"],
            description: "Optional. Only for dual coverage requests. After each family member is created with coverageName, this second coverage is added to that member's MRN. Applied to every family member. Must differ from coverageName and be offered in the same region/environment. Not valid when coverageName is NO_COVERAGE. Omit unless the user explicitly asks for dual / secondary coverage."
          },
          familyComposition: {
            type: "string",
            enum: [
              "subscriber_spouse",
              "subscriber_child",
              "subscriber_teen",
              "subscriber_spouse_child",
              "subscriber_spouse_teen",
              "subscriber_spouse_teen_child"
            ],
            description: "Which members make up the family. Mandatory — pick strictly from what the user said. Mapping: 'subscriber_spouse' = Subscriber + Spouse; 'subscriber_child' = Subscriber + Child (age 0-12); 'subscriber_teen' = Subscriber + Teen (age 13-17); 'subscriber_spouse_child' = Subscriber + Spouse + Child; 'subscriber_spouse_teen' = Subscriber + Spouse + Teen; 'subscriber_spouse_teen_child' = Subscriber + Spouse + Teen + Child. If the user asks for a 'family' without specifying the members, ASK them which composition they want and list the six options above — do NOT guess. Only include member objects (spouse/teen/child) that are part of the selected composition."
          },
          coverageEffectiveDate: {
            type: "string",
            description: "Optional YYYY-MM-DD. Applied to every family member. Defaults to the first day of the current month for active coverage, or the first of the month 3 months out for preEffective."
          },
          coverageTiming: {
            type: "string",
            enum: ["active", "preEffective"],
            description: "active = coverage effective now or on the given date; preEffective = future-dated. Default 'active'."
          },
          environment: {
            type: "string",
            description: "Region-specific environment name. Full mapping by upstream system — Common Membership: CO → ACG5, NW → UPG6, GA → TGG1 or TGG3, HI → CICSTEST. KMATE TMS: MAS → CLONE D or CLONE E or CLONE I. Foundation Systems: NCAL → B SET or M SET or C SET, SCAL → B SET or M SET or C SET. Behavior by region: (1) CO, NW, HI have exactly one valid value — do NOT ask the user; omit this field and the tool will auto-fill it. (2) GA, MAS, NCAL, SCAL have multiple options — you MUST ask the user which environment they want before calling the tool; do not guess or default. If the user supplies a value that does not match their region's mapping, the tool returns an error listing the valid options; relay that error and ask the user to provide the correct value."
          },
          addressLine1: { type: "string", description: "Optional shared address for the whole family. Overridden by per-member address if supplied." },
          addressLine2: { type: "string", description: "Optional shared address line 2." },
          city: { type: "string", description: "Optional shared city." },
          state: { type: "string", description: "Optional shared 2-letter state code. Defaults to the region." },
          postalCode: { type: "string", description: "Optional shared postal code." },
          phoneNumber: { type: "string", description: "Optional shared phone number applied to every family member unless overridden." },
          subscriber: {
            type: "object",
            description: "Primary subscriber (adult). Always created. All fields optional — omitted fields are system-generated. Dependents do NOT inherit any of these fields; each dependent is generated independently. Subscriber's maritalStatus defaults to 'Married' when familyComposition includes a Spouse, otherwise 'Single'.",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              middleName: { type: "string" },
              gender: { type: "string", enum: ["Male", "Female", "M", "F"] },
              dateOfBirth: { type: "string", description: "YYYY-MM-DD or MM/DD/YYYY" },
              ssn: { type: "string" },
              maritalStatus: { type: "string" },
              addressLine1: { type: "string" },
              addressLine2: { type: "string" },
              city: { type: "string" },
              state: { type: "string" },
              postalCode: { type: "string" },
              phoneNumber: { type: "string" }
            }
          },
          spouse: {
            type: "object",
            description: "Spouse (adult). Only include when familyComposition contains 'spouse'. All fields optional and randomized if omitted. Backend forces relationshipCode='Spouse' and maritalStatus='Married'. Gender defaults to the opposite of the subscriber's gender (subscriber M -> spouse F, and vice versa) when omitted — only pass gender here if the user explicitly requested a same-sex spouse or a specific spouse gender. Dependents do NOT inherit the subscriber's lastName — each dependent gets a randomly generated lastName unless one is supplied here.",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              middleName: { type: "string" },
              gender: { type: "string", enum: ["Male", "Female", "M", "F"] },
              dateOfBirth: { type: "string" },
              ssn: { type: "string" }
            }
          },
          teen: {
            type: "object",
            description: "Teen dependent (age 13-17). Only include when familyComposition contains 'teen'. All fields optional and randomized if omitted. Backend forces relationshipCode='Child' and maritalStatus='Single'. Dependents do NOT inherit the subscriber's lastName.",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              middleName: { type: "string" },
              gender: { type: "string", enum: ["Male", "Female", "M", "F"] },
              dateOfBirth: { type: "string" },
              ssn: { type: "string" }
            }
          },
          child: {
            type: "object",
            description: "Child dependent (age 0-12). Only include when familyComposition contains 'child'. All fields optional and randomized if omitted. Backend forces relationshipCode='Child' and maritalStatus='Single'. Dependents do NOT inherit the subscriber's lastName.",
            properties: {
              firstName: { type: "string" },
              lastName: { type: "string" },
              middleName: { type: "string" },
              gender: { type: "string", enum: ["Male", "Female", "M", "F"] },
              dateOfBirth: { type: "string" },
              ssn: { type: "string" }
            }
          }
        },
        required: ["region", "coverageName", "familyComposition"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_sctask_by_id",
      description: "Look up a single Prod Support SCTask by exact SCTask number in the SM_DW database. Use this when the user references a specific SCTask ID such as SCTASK12345678 or wants details about one exact task.",
      parameters: {
        type: "object",
        properties: {
          scTaskId: {
            type: "string",
            description: "Exact SCTask identifier to retrieve, such as SCTASK12345678."
          }
        },
        required: ["scTaskId"]
      }
    }
  },
  {
    type: "function",
    function: {
      name: "get_sctasks_by_keyword",
      description: "Search Prod Support SCTasks in the SM_DW database for KPMC Prod Sup Core. Use this for related ticket search, similar ticket search, or filtered ticket lists. In most cases, put free-text terms in the Description column.",
      parameters: {
        type: "object",
        properties: {
          searchCriteria: {
            type: "array",
            description: "List of column-specific keyword criteria. Keywords are OR'd within one criterion and criteria are AND'd together. In most cases use the Description column.",
            items: {
              type: "object",
              properties: {
                column: {
                  type: "string",
                  enum: SCTASK_SEARCHABLE_COLUMNS,
                  description: "SM_DW column to search."
                },
                keywords: {
                  type: "array",
                  items: {
                    type: "string"
                  },
                  minItems: 1,
                  description: "Keywords to match against the selected column."
                }
              },
              required: ["column", "keywords"],
              additionalProperties: false
            }
          },
          scTaskExclusions: {
            type: "array",
            items: {
              type: "string"
            },
            description: "SCTask IDs to exclude from the results, such as the seed ticket when searching for similar tickets."
          },
          limit: {
            type: "integer",
            minimum: 1,
            maximum: 10,
            description: "Maximum number of rows to return. Values above 10 are capped at 10."
          }
        },
        required: ["searchCriteria"],
        additionalProperties: false
      }
    }
  }
];

// Execute tool calls.
// Returns { toolContent, directOutput }:
//   toolContent  — stringified JSON fed back to the LLM as the `tool` message.
//   directOutput — pre-rendered markdown to stream to the user verbatim,
//                  bypassing the follow-up LLM rewrite. Null when the tool
//                  has no authored message (SNOW tools, or MRN failures where
//                  we want the LLM to write a friendly error message).
async function executeToolCall(toolCall) {
  const { name, arguments: args } = toolCall.function;
  const parsedArgs = JSON.parse(args);
  const isProdSupportTool = name === 'get_sctask_by_id' || name === 'get_sctasks_by_keyword';

  if (isProdSupportTool) {
    console.log(JSON.stringify({
      kpmsg: {
        id: 'AI_PORTAL_NOTEBOOK',
        name: 'prodSupportToolExecution',
        detail: {
          tag: PROD_SUPPORT_TOOL_LOG_TAG,
          message: 'Invoking local Prod Support tool',
          toolName: name,
          argumentKeys: Object.keys(parsedArgs || {})
        }
      }
    }));
  }

  if (name === "get_snow_ticket") {
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/snow?ticketNo=${parsedArgs.ticketNo}`, {
        headers: {
          'x-internal-request': 'true',
          'x-internal-secret': process.env.AUTH_SECRET
        }
      });
      const data = await response.json();
      return { toolContent: JSON.stringify(data), directOutput: null };
    } catch (error) {
      return { toolContent: JSON.stringify({ error: `Failed to retrieve ticket: ${error.message}` }), directOutput: null };
    }
  }

  if (name === "create_snow_ticket") {
    try {
      const response = await fetch(`${process.env.NEXTAUTH_URL}/api/snow`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'x-internal-request': 'true',
          'x-internal-secret': process.env.AUTH_SECRET
        },
        body: JSON.stringify(parsedArgs)
      });
      const data = await response.json();
      return { toolContent: JSON.stringify(data), directOutput: null };
    } catch (error) {
      return { toolContent: JSON.stringify({ error: `Failed to create ticket: ${error.message}` }), directOutput: null };
    }
  }

  if (name === "create_subscriber_mrn") {
    try {
      const data = await createSubscriberMRN(parsedArgs);
      return {
        toolContent: JSON.stringify(data),
        directOutput: data?.formattedMessage || null
      };
    } catch (error) {
      return { toolContent: JSON.stringify({ error: `Failed to create Subscriber MRN: ${error.message}` }), directOutput: null };
    }
  }

  if (name === "create_family_mrn") {
    try {
      const data = await createFamilyMRN(parsedArgs);
      return {
        toolContent: JSON.stringify(data),
        directOutput: data?.formattedMessage || null
      };
    } catch (error) {
      return { toolContent: JSON.stringify({ error: `Failed to create Family MRNs: ${error.message}` }), directOutput: null };
    }
  }

  if (name === "get_sctask_by_id") {
    try {
      const record = await getSCTaskById(parsedArgs);
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'prodSupportToolExecution',
          detail: {
            tag: PROD_SUPPORT_TOOL_LOG_TAG,
            message: 'Completed local Prod Support tool',
            toolName: name,
            found: Boolean(record)
          }
        }
      }));
      return {
        toolContent: JSON.stringify({
          tool: name,
          scTaskId: parsedArgs.scTaskId,
          found: Boolean(record),
          record
        }),
        directOutput: null
      };
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'prodSupportToolExecution',
          detail: {
            tag: PROD_SUPPORT_TOOL_LOG_TAG,
            message: 'Local Prod Support tool failed',
            toolName: name,
            error: error.message
          }
        }
      }));
      return { toolContent: JSON.stringify({ error: `Failed to retrieve SCTask: ${error.message}` }), directOutput: null };
    }
  }

  if (name === "get_sctasks_by_keyword") {
    try {
      const records = await getSCTasksByKeyword(parsedArgs);
      console.log(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'prodSupportToolExecution',
          detail: {
            tag: PROD_SUPPORT_TOOL_LOG_TAG,
            message: 'Completed local Prod Support tool',
            toolName: name,
            resultCount: records.length,
            searchCriteriaCount: Array.isArray(parsedArgs.searchCriteria) ? parsedArgs.searchCriteria.length : 0,
            exclusionCount: Array.isArray(parsedArgs.scTaskExclusions) ? parsedArgs.scTaskExclusions.length : 0,
            limit: parsedArgs.limit ?? null
          }
        }
      }));
      return {
        toolContent: JSON.stringify({
          tool: name,
          resultCount: records.length,
          records
        }),
        directOutput: null
      };
    } catch (error) {
      console.error(JSON.stringify({
        kpmsg: {
          id: 'AI_PORTAL_NOTEBOOK',
          name: 'prodSupportToolExecution',
          detail: {
            tag: PROD_SUPPORT_TOOL_LOG_TAG,
            message: 'Local Prod Support tool failed',
            toolName: name,
            error: error.message
          }
        }
      }));
      return { toolContent: JSON.stringify({ error: `Failed to search SCTasks: ${error.message}` }), directOutput: null };
    }
  }

  return { toolContent: JSON.stringify({ error: "Unknown tool" }), directOutput: null };
}

// filepath: [chatCompletionService2.js](http://_vscodecontentref_/0)
async function sendChatCompletionWithImage(message, teamName, assistantName) {
  const { nuid } = await getServerSession();
  let inputTokenCount = countTokens(message);

  // Record the LLM consumption with logging count of request tokens
  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });

  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid } } }));
    return `Sorry, I'm unable to process this request. Try reducing the context you've provided.
    \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`;
  } else {
    let clientName = "HPAIS";

    try {
      const featureFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      if (!featureFlag || !featureFlag.enabled) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        const completion = await generateChatCompletion({
          temperature: 0.7,
          max_tokens: 1000,
          model: "gpt-4o-aisvc", // this param ignored: always uses gpt-4o-aisvc
          messages: [message],
          event: 'chat-completion-image',
          teamName,
          assistantName,
          user: nuid
        });

        // Count tokens in the response
        const responseTokens = countTokens([{ role: 'assistant', content: completion.final_result }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

        return completion.final_result;
      }

      const completionsClient = await getCompletionsClient();
      const response = await completionsClient.chat.completions.create({
        temperature: 0.7,
        max_completion_tokens: 1000,
        model: "gpt-4o",
        messages: [message], // Pass the message object
      });

      const responseTokens = countTokens([{ role: 'assistant', content: response.choices[0]?.message }]);
      recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

      return response.choices[0]?.message;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      throw error;
    }
  }
}

async function sendChatCompletionWithImage2(messages, teamName, assistantName) {
  const { nuid } = await getServerSession();
  let inputTokenCount = countTokens(messages);

  // Record the LLM consumption with logging count of request tokens
  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });
  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage2', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid } } }));
    return `Sorry, I'm unable to process this request. Try reducing the context you've provided.
    \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`;
  } else {
    let clientName = "HPAIS";
    try {
      const featureFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      if (!featureFlag || !featureFlag.enabled) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        const completion = await generateChatCompletion({
          temperature: 0,
          max_tokens: 4000,
          model: "gpt-4o-aisvc", // this param ignored: always uses gpt-4o-aisvc
          messages: messages,
          event: 'chat-completion-image2',
          teamName,
          assistantName,
          user: nuid
        });

        // Count tokens in the response
        const responseTokens = countTokens([{ role: 'assistant', content: completion.final_result }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

        return completion.final_result;
      }

      const completionsClient = await getCompletionsClient();
      const response = await completionsClient.chat.completions.create({
        temperature: 0,
        max_completion_tokens: 4000,
        model: "gpt-4o",
        messages: messages, // Pass the message object
      });
      const responseTokens = countTokens([{ role: 'assistant', content: response.choices[0]?.message }]);
      recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });
      return response.choices[0]?.message;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage2', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      throw error;
    }
  }
}

async function chatCompletionMcp({ messages, onToken, teamName, assistantName, chatResponseConfig, mcpServers }) {

  const { nuid } = await getServerSession();
  let inputTokenCount = countTokens(messages);

  // Record the LLM consumption with logging count of request tokens
  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });

  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMcp', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid, teamName, assistantName } } }));
    onToken(`Sorry, I'm unable to process this request. Try reducing the context you've provided.
      \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`);
    return;
  } else {
    let clientName = "NexusOS";
    try {
      // Map stored MCP server configs to the gateway tools schema
      const tools = (Array.isArray(mcpServers) ? mcpServers : [])
        .filter(server => server && server.enabled !== false && server.serverUrl && server.serverLabel)
        .map(server => ({
          type: 'mcp',
          server_label: server.serverLabel,
          server_url: server.serverUrl,
          require_approval: server.requireApproval ?? 'never',
          ...(Array.isArray(server.allowedTools) && server.allowedTools.length > 0
            ? { allowed_tools: server.allowedTools }
            : {})
        }));

      if (tools.length === 0) {
        console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMcp', detail: { action: 'No MCP servers available', nuid, teamName, assistantName } } }));
        onToken("No MCP servers are configured for this assistant.");
        return;
      }

      const completion = await generateChatResponse({
        model: chatResponseConfig?.model ?? 'gpt-4o-APP-7232',
        temperature: chatResponseConfig?.temperature ?? 0.7,
        max_completion_tokens: chatResponseConfig?.max_completion_tokens ?? 4000,
        user: nuid,
        event: 'chat-completion-mcp',
        teamName,
        assistantName,
        messages,
        tools
      });

      const assistantText = (Array.isArray(completion?.output) ? completion.output : [])
        .filter(item => item?.role === 'assistant' && item?.type === 'message')
        .flatMap(item => (Array.isArray(item?.content) ? item.content : []))
        .filter(contentItem => contentItem?.type === 'output_text' && typeof contentItem?.text === 'string')
        .map(contentItem => contentItem.text)
        .join('');

      onToken(assistantText);

      const responseTokens = countTokens([{ role: 'assistant', content: assistantText }]);
      recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });
      return assistantText;

    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMcp', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      if (error.status === 400 && error.message?.includes('content management policy')) {
        onToken("The content submitted cannot be processed by the AI model due to content safety policies. Please try rephrasing your request.");
      } else {
        onToken("Your request could not be processed. Please try again.");
      }
    }
  }
}



async function chatCompletionMarkdown({ messages, onToken, teamName, assistantName, chatCompletionConfig, toolsList }) {
  const { nuid } = await getServerSession();
  let inputTokenCount = countTokens(messages);
  let streamedResponse = '';

  // Record the LLM consumption with logging count of request tokens
  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });

  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMarkdown', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid, teamName: teamName, assistantName: assistantName } } }));
    onToken(`Sorry, I'm unable to process this request. Try reducing the context you've provided.
      \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`);
  } else {
    let clientName = "HPAIS";
    try {
      const useAzureOpenAIFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      // generate-test-mrn-v2 requires tool calling, which is only wired up on
      // the Azure OpenAI path below. Only allow this bypass in lower environments
      // (not prod/psup) and only when the dedicated feature flag is enabled.
      const isProductionEnv = ['prod', 'psup'].includes(process.env.envName);
      let forceAzureForAssistant = false;
      if (assistantName === 'generate-test-mrn-v2' && !isProductionEnv) {
        const mrnAzureFlag = await getFeatureFlag('use-azure-for-generate-test-mrn');
        forceAzureForAssistant = mrnAzureFlag?.enabled === true;
      }
      if ((!useAzureOpenAIFlag || !useAzureOpenAIFlag.enabled) && !forceAzureForAssistant) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        const completion = await generateChatCompletion({
          temperature: chatCompletionConfig?.temperature ?? 0.7,
          max_tokens: chatCompletionConfig?.max_tokens ?? 4000,
          model: "gpt-4o-aisvc",
          messages: messages,
          event: 'chat-completion-markdown',
          teamName,
          assistantName,
          user: nuid
        });
        streamedResponse = completion.final_result || '';
        onToken(streamedResponse);

        const responseTokens = countTokens([{ role: 'assistant', content: streamedResponse }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

        return streamedResponse;
      }

      let response;
      const completionsClient = await getCompletionsClient();
      const useToolsFlag = await getFeatureFlag('use-tools-in-chat-completions');
      if (useToolsFlag && useToolsFlag.enabled && toolsList && toolsList.length > 0) {
        const isProdSupportLocalToolRun = toolsList.includes(AVAILABLE_TOOLS.getSCTaskById) || toolsList.includes(AVAILABLE_TOOLS.getSCTasksByKeyword);
        if (isProdSupportLocalToolRun) {
          console.log(JSON.stringify({
            kpmsg: {
              id: 'AI_PORTAL_NOTEBOOK',
              name: 'prodSupportToolExecution',
              detail: {
                tag: PROD_SUPPORT_TOOL_LOG_TAG,
                message: 'Tool-enabled local chat completion path selected',
                teamName,
                assistantName,
                toolsList
              }
            }
          }));
        }
        // First request with tools
        response = await completionsClient.chat.completions.create({
          temperature: chatCompletionConfig?.temperature ?? 0.7,
          max_completion_tokens: chatCompletionConfig?.max_tokens ?? 4000,
          model: chatCompletionConfig?.model ?? "gpt-4o",
          messages: messages,
          tools: toolsList ? TOOLS.filter(tool => toolsList.includes(tool.function.name)) : TOOLS,
          tool_choice: "auto",
          stream: false
        });

        const responseMessage = response.choices[0]?.message;
        const responseTokens = countTokens([{ role: 'assistant', content: response.choices[0]?.message }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

        // Check if the model wants to call tools
        if (responseMessage.tool_calls) {
          if (isProdSupportLocalToolRun) {
            console.log(JSON.stringify({
              kpmsg: {
                id: 'AI_PORTAL_NOTEBOOK',
                name: 'prodSupportToolExecution',
                detail: {
                  tag: PROD_SUPPORT_TOOL_LOG_TAG,
                  message: 'Model requested local tool calls',
                  toolCallNames: responseMessage.tool_calls.map(toolCall => toolCall.function?.name).filter(Boolean)
                }
              }
            }));
          }

          // Append assistant's message with tool calls
          messages.push(responseMessage);

          // Execute each tool call
          const directOutputs = [];
          for (const toolCall of responseMessage.tool_calls) {
            const { toolContent, directOutput } = await executeToolCall(toolCall);
            messages.push({
              role: "tool",
              tool_call_id: toolCall.id,
              content: toolContent
            });
            if (directOutput) directOutputs.push(directOutput);
          }

          // If any tool authored its own user-facing markdown, stream it verbatim
          // and skip the follow-up LLM rewrite so the tool's output is preserved exactly.
          if (directOutputs.length > 0) {
            if (isProdSupportLocalToolRun) {
              console.log(JSON.stringify({
                kpmsg: {
                  id: 'AI_PORTAL_NOTEBOOK',
                  name: 'prodSupportToolExecution',
                  detail: {
                    tag: PROD_SUPPORT_TOOL_LOG_TAG,
                    message: 'Returning direct tool-authored output',
                    directOutputCount: directOutputs.length
                  }
                }
              }));
            }
            const combined = directOutputs.join('\n\n');
            onToken(combined);
            const responseTokens = countTokens([{ role: 'assistant', content: combined }]);
            recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });
            return combined;
          }
        }
      }

      let inputCount = countTokens(messages);
      recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputCount });
      if (inputCount > tokenLimit) {
        console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMarkdown', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid, teamName: teamName, assistantName: assistantName } } }));
        onToken(`Sorry, I'm unable to process this request. Try reducing the context you've provided.
          \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`);

      } else {
        // Stream the response (either after tool calls or directly)
        response = await completionsClient.chat.completions.create({
          temperature: chatCompletionConfig?.temperature ?? 0.7,
          max_completion_tokens: chatCompletionConfig?.max_tokens ?? 4000,
          model: chatCompletionConfig?.model ?? "gpt-4o",
          messages: messages,
          stream: true
        });

        for await (const chunk of response) {
          if (chunk.error) {
            console.error("Streaming error:", chunk.error);
            return streamedResponse;
          }
          const content = chunk.choices[0]?.delta?.content;
          if (content) {
            onToken(content);
            streamedResponse += content;
          }
        }
        const responseTokens = countTokens([{ role: 'assistant', content: streamedResponse }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });
        return streamedResponse;

      }
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionMarkdown', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      if (streamedResponse) {
        return streamedResponse;
      }
      // Check if error is related to content management policy
      let errorResponse;
      if (error.status === 400 && error.message?.includes('content management policy')) {
        errorResponse = "The uploaded document contains content that cannot be processed by the AI model due to content safety policies. Please try rephrasing your question or using a different document.";
      } else {
        errorResponse = "Your request could not be processed. Please try again.";
      }
      onToken(errorResponse);
      return errorResponse;
    }
  }
}

async function chatCompletionPrompts({ messages, teamName, assistantName }) {
  const { nuid } = await getServerSession();


  let inputTokenCount = countTokens(messages);
  // TODO: consider if we want to record this type of prompt generation as an LLM interaction in our stats
  //await recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });
  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionPrompts', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid, teamName: teamName, assistantName: assistantName } } }));
    onToken(`Sorry, I'm unable to process this request. Try reducing the context you've provided.
      \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`);
  } else {
    let clientName = "HPAIS";
    try {
      const featureFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      if (!featureFlag || !featureFlag.enabled) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        const completion = await generateChatCompletion({
          temperature: 0.7,
          max_completion_tokens: 1000,
          model: "gpt-4o-aisvc", // this param ignored: always uses gpt-4o-aisvc
          messages: messages,
          event: 'get-suggested-prompts',
          teamName,
          assistantName,
          user: nuid
        });
        return completion.final_result.trim().split('~!~').map(prompt => prompt.trim());
      }

      const completionsClient = await getCompletionsClient();
      const completion = await completionsClient.chat.completions.create({
        temperature: 0.7,
        max_completion_tokens: 1000,
        model: "gpt-4o",
        messages: messages
      });

      const { message: { content } } = completion.choices[0];

      // Do we want to record this as an interaction even though it's not a user triggered completion?
      // TODO: consider if we want to differentiate this type of interaction in our stats
      // const responseTokens = countTokens([{ role: 'assistant', content }]);
      // await recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

      const suggestedPrompts = content.trim().split('~!~').map(prompt => prompt.trim());
      return suggestedPrompts;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionPrompts', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      return [];
    }
  }
}

async function chatCompletion({ messages, temperature = 0.7, max_tokens = 1000, model = "gpt-4o", assistantName, teamName, nuid }) {
  if (!nuid) {
    const { nuid: userNuid } = await getServerSession();
    nuid = nuid || userNuid; // Use nuid from parameters if provided, otherwise use from session
  }
  let inputTokenCount = countTokens(messages);

  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });

  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletion', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid: nuid } } }));
    return `Sorry, I'm unable to process this request. Try reducing the context you've provided.
      \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`;
  } else {
    let clientName = "HPAIS";
    try {
      const featureFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      if (!featureFlag || !featureFlag.enabled) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'sendChatCompletionWithImage', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        const completion = await generateChatCompletion({
          temperature: temperature,
          max_tokens: max_tokens,
          model: "gpt-4o-aisvc", // this param ignored: always uses gpt-4o-aisvc
          messages: messages,
          event: 'chat-completion',
          teamName,
          assistantName,
          user: nuid
        });
        const responseTokens = countTokens([{ role: 'assistant', content: completion.final_result }]);
        recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

        return completion.final_result;
      }

      const completionsClient = getCompletionsClient();
      const response = await completionsClient.chat.completions.create({
        temperature: temperature,
        max_completion_tokens: max_tokens,
        model: model,
        messages: messages
      });

      const responseTokens = countTokens([{ role: 'assistant', content: response.choices[0]?.message }]);
      recordLLMInteraction(nuid, new Date(), teamName, assistantName, { responseTokens });

      return response.choices[0]?.message?.content || "";
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletion', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      return "Your request could not be processed. Please try again.";
    }
  }
}

async function chatCompletionFromAPI({ messages, model = 'gpt-4o-aisvc', temperature = 0.7, max_tokens = 4000, nuid, teamName, assistantName, event, sessionId }) {
  let inputTokenCount = countTokens(messages);

  // Record the LLM consumption with logging count of request tokens
  recordLLMInteraction(nuid, new Date(), teamName, assistantName, { requestTokens: inputTokenCount });

  if (inputTokenCount > tokenLimit) {
    console.warn(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionFromAPI', detail: { message: `${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`, nuid, teamName, assistantName } } }));
    return {
      error: `Sorry, I'm unable to process this request. Try reducing the context you've provided.
      \n\n${tokenLimit} Token limit exceeded (your token count: ${inputTokenCount})`
    };
  } else {
    let clientName = "HPAIS";
    try {
      const requiredParams = {
        messages: messages,
        model: 'gpt-4o-aisvc', // nexus os only supports this model for now
        temperature: temperature || 0.7,
        max_tokens: max_tokens || 4000,
        user: nuid,
        teamName: teamName,
        assistantName: assistantName
      };

      const optionalParams = {};
      event ? (optionalParams.event = event) : null;
      sessionId ? (optionalParams.sessionId = sessionId) : null;

      let completion;
      const featureFlag = await getFeatureFlag('use-hpais-azure-instance-chat')
      if (!featureFlag || !featureFlag.enabled) {
        clientName = "NexusOS";
        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionFromAPI', detail: { action: 'Using NexusOS for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is not configured, or is disabled' } } }));

        completion = await generateChatCompletion({
          ...requiredParams,
          ...optionalParams,
        });
      }
      else {
        // call directly
        const completionsClient = getCompletionsClient();
        const response = await completionsClient.chat.completions.create({
          temperature: temperature,
          max_completion_tokens: max_tokens,
          model: model,
          messages: messages
        });

        completion = response;

        console.log(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionFromAPI', detail: { action: 'Using HPAIS Azure instance for chat completion', message: 'Feature flag use-hpais-azure-instance-chat is enabled' } } }));
      }

      recordAssistantPromptSubmittedViaAPI(
        nuid,
        new Date(),
        teamName,
        assistantName
      );

      const responseTokens = countTokens([{ role: 'assistant', content: completion.final_result }]);
      recordLLMInteraction(nuid,
        new Date(),
        teamName,
        assistantName,
        { responseTokens }
      );

      return completion;
    } catch (error) {
      console.error(JSON.stringify({ kpmsg: { id: 'AI_PORTAL_NOTEBOOK', name: 'chatCompletionFromAPI', detail: { action: `Error creating chat completion with ${clientName}`, error: error.message } } }));
      recordFailure(nuid, new Date(), teamName, assistantName, error.length || 1);
      // Check if error is related to content management policy
      if (error.status === 400 && error.message?.includes('content management policy')) {
        return { error: "The context submitted contains content that cannot be processed by the AI model due to content safety policies. Please try rephrasing your question or using different context." };
      } else {
        return { error: "Your request could not be processed. Please try again." };
      }
    }
  }
}

export {
  sendChatCompletionWithImage,
  sendChatCompletionWithImage2,
  chatCompletionMarkdown,
  chatCompletionPrompts,
  chatCompletion,
  getCompletionsClient,
  chatCompletionFromAPI,
  chatCompletionMcp
};