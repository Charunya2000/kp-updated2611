import { connectToDatabase, createTeamDatabase } from '../db/connection.js';

const createUserRole = async (db, roleId, user) => {
  console.log(`Creating user role for ${JSON.stringify(user)}`);
  const userRole = { type: 'userRole', roleId: roleId, userNUID: user.NUID, createdAt: new Date() };
  const result = await db.collection('user_collection').findOne(userRole);
  if (!result) {
    console.log(`User role does not exist, adding user role to db: ${JSON.stringify(user)}`);
    await db.collection('user_collection').insertOne(userRole);
  } else {
    console.log(`User ${user.Name} - ${user.NUID} already has role.`);
  }
};

const setAdminUserRoles = async () => {
  const db = await connectToDatabase();
  const kpmcRoleQuery = { type: 'role', name: 'admin' };
  const role = await db.collection('user_collection').findOne(kpmcRoleQuery);
  let nuid = 'A257371';
  if (process.env['USE_VAULT'] === 'true') {
    nuid = 'JBSELTZER@GEISINGER.EDU';
  }
  const testMembers = [{
    "Name": "Jonathan Seltzer",
    "NUID": nuid,
    "Position Name": "Database and AI Architect",
    "Position Type": "Onshore Contractor",
    "Department Name": "KPIT HPTS AI Services",
    "Email": "jbseltzer@geisinger.edu",
    "Mgr's Name": "Zafrulla Khan",
    "Data Source": "AccessNow",
    "GL Code": "9601-30100-8919",
    "CW Company Name": "Accenture International Limited",
    "Region": "KP-IT",
    "Location City": "Sacramento",
    "Location State": "CA"
  }];
  await Promise.all(testMembers.map(user => createUserRole(db, role._id, user)));
};

const createRole = async (db, displayName, name, parentName) => {
  await db.collection('user_collection').deleteMany({ type: 'role', name, parentName });
  const roleDocument = { type: 'role', displayName, name, parentName, createdAt: new Date() };
  await db.collection('user_collection').insertOne(roleDocument);
};

const checkAdminRoleAndUser = async () => {
  const db = await connectToDatabase();

  // Check if 'admin' role exists
  const adminRole = await db.collection('user_collection').findOne({ type: 'role', name: 'admin' });
  if (!adminRole) {
    console.log("Admin role does not exist.");
    return false;
  } else {
    console.log(`Admin role exists: ${JSON.stringify(adminRole)}`);
  }

  // Check if userRole for userNUID 'A257371' exists
  const userRole = await db.collection('user_collection').findOne({ type: 'userRole', roleId: adminRole._id, userNUID: 'JBSELTZER@GEISINGER.EDU' });
  if (!userRole) {
    console.log("UserRole for userNUID 'JBSELTZER@GEISINGER.EDU' does not exist.");
    const userRoleLowerCase = await db.collection('user_collection').findOne({ type: 'userRole', roleId: adminRole._id, userNUID: 'jbseltzer@geisinger.edu' });
    if (userRoleLowerCase) {
      console.log("UserRole for userNUID 'jbseltzer@geisinger.edu' does exist. Deleteing lower case entry and recreating with upper case.");
      await db.collection('user_collection').deleteOne({ _id: userRoleLowerCase._id });
    }
    return false;
  }

  console.log("Admin role and userRole for userNUID 'JBSELTZER@GEISINGER.EDU' both exist.");
  return true;
};

const roles = [

  { displayName: "Compliance AI2", parentName: 'Regulatory', name: 'complianceAI2' }
];

const addRoles = async () => {
  const db = await connectToDatabase();
  await Promise.all(roles.map(role => createRole(db, role.displayName, role.name, role.parentName)));
}

export const extractGeisingerConfigToJsonFile = async () => {
  try {
    const db = await connectToDatabase();
    const existingConfigs = await db.collection('user_collection').find({ type: 'GeisingerConfig' }).toArray();
    const fs = await import('fs');
    fs.writeFileSync('geisingerConfigs.json', JSON.stringify(existingConfigs, null, 2));
    console.log('GeisingerConfig documents exported to geisingerConfigs.json');
  } catch (error) {
    console.error('Error preloading GeisingerConfig...', error);
  }
}

export const preloadGeisingerConfig = async () => {
  try {
    createTeamDatabase('team-regulatory-db', ['user_collection', 'statistics'], 4000);
    const db = await connectToDatabase('team-regulatory-db');
    const fs = await import('fs');
    if (fs.existsSync('geisingerConfigs.json')) {
      const data = fs.readFileSync('geisingerConfigs.json', 'utf-8');
      const configs = JSON.parse(data);
      for (const config of configs) {
        const existingConfig = await db.collection('user_collection').findOne({ id: config.id, type: 'GeisingerConfig' });
        if (!existingConfig) {
          await db.collection('user_collection').insertOne(config);
          console.log(`Inserted GeisingerConfig with id: ${config.id}`);
        } else {
          console.log(`GeisingerConfig with id: ${config.id} already exists. Skipping insertion.`);
        }
      }
    }
  } catch (error) {
    console.error('Error preloading GeisingerConfig...', error);
  }
}

export const adminRoleBootScript = async () => {
  try {
    const isBootstrapped = await checkAdminRoleAndUser();
    if (!isBootstrapped) {
      await addRoles();
      await setAdminUserRoles();
    } else {
      console.log("Admin role and user already set up. No action needed.");
    }
  } catch (error) {
    console.error('Could not validate admin roles...', error);
  }
};
