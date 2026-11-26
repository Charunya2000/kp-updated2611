// import { formatName } from '../formatting.js';

// // Test cases with expected results
// const testCases = [
//   {
//     input: "admin",
//     expected: "admin",
//   },
//   {
//     input: "C&C Data Control Report",
//     expected: "cac-data-control-report",
//   },
//   {
//     input: "Invoice Variance",
//     expected: "invoice-variance",
//   },
//   {
//     input: "KPIF Virtual Expert AI",
//     expected: "kpif-virtual-expert-ai",
//   },
//   {
//     input: "KPMC Assistant",
//     expected: "kpmc-assistant",
//   },
//   {
//     input: "CMS Assistant",
//     expected: "cms-assistant",
//   },
//   {
//     input: "Medicaid AI Assistant",
//     expected: "medicaid-ai-assistant",
//   },
//   {
//     input: "Sales & Marketing",
//     expected: "sales-and-marketing",
//   },
//   {
//     input: "KPIF Marketing & Products",
//     expected: "kpif-marketing-and-products",
//   },
//   {
//     input: "KP Smart Notes",
//     expected: "kp-smart-notes",
//   },
//   {
//     input: "Desk Level Procedure",
//     expected: "desk-level-procedure",
//   },
//   {
//     input: "KPIF",
//     expected: "kpif",
//   },
//   {
//     input: "Marketing",
//     expected: "marketing",
//   },
//   {
//     input: "Products",
//     expected: "products",
//   },
//   {
//     input: "Broker and Regulatory Products",
//     expected: "broker-and-regulatory-products",
//   },
//   {
//     input: "HPPDM Assistant",
//     expected: "hppdm-assistant",
//   },
//   {
//     input: "Foundation Systems",
//     expected: "foundation-systems",
//   },
//   {
//     input: "PDF Analyzer",
//     expected: "pdf-analyzer",
//   },
//   {
//     input: "Invoice Variance PPROD",
//     expected: "invoice-variance-pprod",
//   },
//   {
//     input: "Invoice Variance PROD",
//     expected: "invoice-variance-prod",
//   },
//   {
//     input: "Case 360 Assistant",
//     expected: "case-360-assistant",
//   },
//   {
//     input: "scheduleToPay",
//     expected: "scheduletopay",
//   },
//   {
//     input: "Enterprise Testing Assistant",
//     expected: "enterprise-testing-assistant",
//   },
//   {
//     input: "HPPDM TDG",
//     expected: "hppdm-tdg",
//   },
//   {
//     input: "complianceAI",
//     expected: "complianceai",
//   },
//   {
//     input: "TeamAdmin",
//     expected: "teamadmin",
//   },
//   {
//     input: "bcsChatBot",
//     expected: "bcschatbot",
//   },
//   {
//     input: "GeisingerRegulations",
//     expected: "geisingerregulations",
//   },
//   {
//     input: "MDW Assistant",
//     expected: "mdw-assistant",
//   },
//   {
//     input: "Test",
//     expected: "test",
//   },
//   {
//     input: "PR09&10",
//     expected: "pr09-and-10",
//   },
//   {
//     input: "PRONine&PROTen",
//     expected: "pronine-and-proten",
//   }
// ];

// console.log('Testing formatName function:');
// console.log('='.repeat(80));

// let passedTests = 0;
// let failedTests = 0;

// testCases.forEach((testCase, index) => {
//   const result = formatName(testCase.input);
//   const passed = result === testCase.expected;
//   const status = passed ? '✅ PASS' : '❌ FAIL';

//   if (passed) {
//     passedTests++;
//   } else {
//     failedTests++;
//   }

//   console.log(`${index + 1}. ${status}`);
//   console.log(`   Input:    "${testCase.input}"`);
//   console.log(`   Expected: "${testCase.expected}"`);
//   console.log(`   Actual:   "${result}"`);

//   if (!passed) {
//     console.log(`   ⚠️  Mismatch detected!`);
//   }

//   console.log('');
// });

// console.log('='.repeat(80));
// console.log(`SUMMARY: ${passedTests} passed, ${failedTests} failed out of ${testCases.length} tests`);

// if (failedTests === 0) {
//   console.log('🎉 All tests passed!');
// } else {
//   console.log('❌ Some tests failed. Please review the results above.');
// }
