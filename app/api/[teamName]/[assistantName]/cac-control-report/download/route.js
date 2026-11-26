import { NextResponse } from 'next/server';

// export async function POST(request) {
//   const data = await request.json();
//   const { groups } = data;
//   // Create CSV content
//   let csvContent = "Group ID,Entity Name,Attribute Name,Source Value,Target Value,Match\n";
//   try {
//     groups.forEach(group => {
//       group.entities.forEach(entity => {
//         entity.attributes.forEach(attr => {
//           // if (attr.source_value !== null && typeof attr.source_value === 'object') {
//           //   const sourceValues = Object.values(attr.source_value).map(value => value).join(',');
//           //   csvContent += `${group.id},${entity.name},${attr.name},${sourceValues},${attr.target_value},${attr.match}\n`;
//           // } else {
//           csvContent += `"${group.id}","${entity.name}","${attr.name}","${attr.source_value}","${attr.target_value}","${attr.match}"\n`;
//           // }
//         });
//       });
//     });

//     // Convert CSV content to a buffer
//     const csvBuffer = Buffer.from(csvContent, 'utf-8');

//     // Return the buffer as a downloadable response
//     return new NextResponse(csvBuffer, {
//       headers: {
//         'Content-Type': 'text/csv',
//         'Content-Disposition': 'attachment; filename="compare_results.csv"',
//       },
//     });
//   } catch (error) {
//     console.error('Error generating CSV:', error);
//     return new Response('Error generating CSV', { status: 500 });
//   }
// }