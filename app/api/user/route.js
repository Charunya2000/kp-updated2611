import { prepDocument } from '@/app/clientServices/insertDocument';
import { recordUserActive } from '@/app/services/statisticsService';
import { upsertUser } from '@/app/services/userService';
import { NextResponse } from 'next/server';

export async function POST(request) {
  try {
    const body = await request.json();
    const { firstName, lastName, email, nuid, groups } = body;

    const isGeisinger = process.env.USE_VAULT === 'true';
    const invalidFirstName = !firstName && !isGeisinger;
    const invalidLastName = !lastName;
    const invalidEmail = !email;
    const invalidNuid = !nuid;

    if (invalidFirstName || invalidLastName || invalidEmail || invalidNuid) {
      return NextResponse.json(
        { error: 'Missing required fields: firstName, lastName, email, and nuid are required' },
        { status: 400 }
      );
    }

    recordUserActive(nuid, new Date());

    // add the user to the DB
    const user = prepDocument({
      firstName,
      lastName,
      email,
      nuid,
      groups
    });

    upsertUser(user);

    return NextResponse.json({ message: 'Success' }, { status: 200 });
  } catch (error) {
    console.error('Error processing user data:', error);
    return NextResponse.json(
      { error: 'Failed to process request', details: error.message },
      { status: 500 }
    );
  }
}
