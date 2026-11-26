import { validateAndAcquireToken } from '@/app/services/sharepointGetAccessToken';
import { getUsersByNuid } from '@/app/services/userService';
import { NextResponse } from 'next/server';

export async function POST(req) {
  const { nuids } = await req.json();
  if (!nuids || !Array.isArray(nuids) || nuids.length === 0) {
    return NextResponse.json(
      { error: 'NUIDs are required to fetch user details' },
      { status: 400 }
    );
  }

  const users = await getUsersByNuid(nuids.map(nuid => nuid.toUpperCase()));
  return NextResponse.json(users, { status: 200 });
}

// export async function GET() {

//   const token = await validateAndAcquireToken();

//   // call graph API to get user details
//   const userDetails = await fetch(`https://graph.microsoft.com/v1.0/users?$filter=employeeId eq 'C597732'`, {
//     headers: {
//       'Authorization': `Bearer ${token}`
//     }
//   });

//   if (!userDetails.ok) {
//     return NextResponse.json(
//       { error: 'Failed to fetch user details' },
//       { status: 500 }
//     );
//   }

//   const userData = await userDetails.json();
//   if (!userData || !userData.value || userData.value.length === 0) {
//     return NextResponse.json(
//       { error: 'User not found' },
//       { status: 404 }
//     );
//   }
//   return NextResponse.json(
//     { message: 'User details fetched successfully', data: userData.value[0] },
//     { status: 200 }
//   );
// }
