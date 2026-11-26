import { setProcessEnvironment } from '../scripts/configActions.js';
import { connectToDatabase, doesDatabaseExist, doesCollectionExist } from '../db/connection.js';
import fs from 'fs';


const createUserAssistant = async (db, assistantId, user) => {
  const userAssistant = { type: 'UserAssistant', assistantId: assistantId, nuid: user.NUID, createdAt: new Date() };
  const result = await db.collection('user_collection').findOne(userAssistant);
  if (!result) {
    await db.collection('user_collection').insertOne(userAssistant);
  } else {
    console.log(`User ${user.Name} - ${user.NUID} already has assistant.`);
  }
};

const setUserAssistants = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const kpmcAssistantQuery = { type: 'assistant', name: { $in: ['kpmc-assistant', 'kp-smart-notes', 'cms-assistant'] } };
  const assistants = await db.collection('user_collection').find(kpmcAssistantQuery).toArray();

  const kimsOrgMembers = JSON.parse(fs.readFileSync('./kimsOrg.json', 'utf8'));
  const testMembers = kimsOrgMembers.slice(1);
  await Promise.all(
    testMembers.flatMap(user =>
      assistants.map(assistant => createUserAssistant(db, assistant._id, user))
    )
  );
};

const setUserSmartNoteAssistants = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const kpmcAssistantQuery = { type: 'assistant', name: 'kp-smart-notes' };
  const assistant = await db.collection('user_collection').findOne(kpmcAssistantQuery);
  const kimsOrgMembers = JSON.parse(fs.readFileSync('./kimsOrg.json', 'utf8'));
  const testMembers = kimsOrgMembers.slice(1);
  await Promise.all(testMembers.map(user => createUserAssistant(db, assistant._id, user)));
};

const setUserCMSAssistant = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const kpmcAssistantQuery = { type: 'assistant', name: 'cms-assistant' };
  const assistant = await db.collection('user_collection').findOne(kpmcAssistantQuery);
  const kimsOrgMembers = JSON.parse(fs.readFileSync('./kimsOrg.json', 'utf8'));
  // const testMembers = kimsOrgMembers.slice(0, 4);
  await Promise.all(kimsOrgMembers.map(user => createUserAssistant(db, assistant._id, user)));
};

const setAdminUserAssistants = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const kpmcAssistantQuery = { type: 'assistant', name: 'admin' };
  const assistant = await db.collection('user_collection').findOne(kpmcAssistantQuery);
  const testMembers = [{
    "Name": "Jon Seltzer",
    "NUID": "A257371",
    "Position Name": "Database and AI Architect",
    "Position Type": "Onshore Contractor",
    "Department Name": "KPIT HPTS AI Services",
    "Email": "jonathan.b.seltzer@kp.org",
    "Mgr's Name": "Zafrulla Khan",
    "Data Source": "AccessNow",
    "GL Code": "9601-30100-8919",
    "CW Company Name": "Accenture International Limited",
    "Region": "KP-IT",
    "Location City": "Sacramento",
    "Location State": "CA"
  }];
  await Promise.all(testMembers.map(user => createUserAssistant(db, assistant._id, user)));
};


const assignAllAssistantsToUser = async (nuid) => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const user = {
    "Name": "Russ Dow",
    "NUID": "C597732",
    "Position Name": "Database and AI Architect",
    "Position Type": "Onshore Contractor",
    "Department Name": "KPIT HPTS AI Services",
    "Email": "jonathan.b.seltzer@kp.org",
    "Mgr's Name": "Zafrulla Khan",
    "Data Source": "AccessNow",
    "GL Code": "9601-30100-8919",
    "CW Company Name": "Accenture International Limited",
    "Region": "KP-IT",
    "Location City": "Sacramento",
    "Location State": "CA"
  };
  const assistants = await db.collection('user_collection').find({ type: 'assistant' }).toArray();
  await Promise.all(assistants.map(assistant => {
    return createUserAssistant(db, assistant._id, user);
  }));
  console.log(`Assigned all assistants to user with NUID: ${nuid}`);
};

const createAssistant = async (db, displayName, name, category) => {
  const assistantDocument = { type: 'assistant', displayName, name, category, createdAt: new Date() };
  await db.collection('user_collection').insertOne(assistantDocument);
};

const assistants = [
  { displayName: "admin", category: 'Admin', name: 'admin' },
  { displayName: "KP Smart Notes", category: 'Efficiency Tools', name: 'kp-smart-notes' },
  { displayName: "KPMC AI Assistant", category: 'Membership', name: 'kpmc-ai-assistant' },
  { displayName: "CAC Data Control Report", category: 'Efficiency Tools', name: 'cac-data-control-report' },
  { displayName: "Invoice Variance", category: 'Membership', name: 'invoice-variance' },
  { displayName: "KPIF Virtual Expert AI", category: 'Membership', name: 'kpif-virtual-expert-ai' },
  { displayName: "ID Cards AI Assistant", category: 'Membership', name: 'id-cards-ai-assistant' },
  { displayName: "HPPDM Assistant", category: 'Provider Management', name: 'hppdm-assistant' },
  { displayName: "CMS Assistant", category: 'Regulatory', name: 'cms-assistant' },
  { displayName: "Medicaid Assistant", category: 'Regulatory', name: 'medicaid-assistant' },
  { displayName: "Sales & Marketing", category: 'Sales & Marketing', name: 'sales-and-marketing' },
  { displayName: "KPIF Marketing & Products", category: 'KPIF IT', name: 'kpif-marketing-and-products' },
  { displayName: "Desk Level Procedure", category: 'Administrative', name: 'desk-level-procedure' },
  { displayName: "Document Management Shared Service", category: 'Membership', name: 'document-management-shared-service' },
  { displayName: "KPIF", category: 'KPIF IT', name: 'kpif' },
  { displayName: "Marketing", category: 'KPIF IT', name: 'marketing' },

  // Add new workflow here to support new spreadsheets
  { displayName: "Products", category: 'KPIF IT', name: 'products' },

  { displayName: "Broker and Regulatory Products", category: 'Sales & Marketing', name: 'broker-and-regulatory-products' }
];

const addAssistants = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  await Promise.all(assistants.map(assistant => createAssistant(db, assistant.displayName, assistant.name, assistant.category)));
}

// filepath: c:\Users\A257371\Documents\development\software\node\projects3\genai-portal-notebook\utils\userAssistantScript.js
const viewAssistants = async () => {
  await setProcessEnvironment();
  if (await doesDatabaseExist() && await doesCollectionExist()) {
    console.log("Database exists, proceeding to view assistants...");
    const db = await connectToDatabase();
    const query = { type: 'assistant' };
    const assistants = await db.collection('user_collection').find(query).toArray(); // Removed sort
    console.log(JSON.stringify(assistants));
  }
};

const deleteAllAssistants = async () => {

  await setProcessEnvironment();
  const query = { type: 'assistant' };
  const db = await connectToDatabase();
  const deleteResultUserAssistant = await db.collection('user_collection').deleteMany({ type: 'UserAssistant' });
  console.log(`Deleted ${deleteResultUserAssistant.deletedCount} UserAssistant documents.`);
  const result = await db.collection('user_collection').deleteMany(query);
  console.log(`Deleted ${result.deletedCount} assistant documents.`);
};

const viewUserAssistants = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const userAssistantQuery = { type: 'UserAssistant', nuid: 'A257371' };
  const userAssistants = await db.collection('user_collection').find(userAssistantQuery).toArray();
  const assistants = await Promise.all(userAssistants.map(async (userAssistant) => {
    const assistant = await db.collection('user_collection').findOne({ type: 'assistant', _id: userAssistant.assistantId });
    return assistant;
  }));
  console.log(`User Assistants for A257371: ${JSON.stringify(assistants)}`);
}


const getServerInfo = async () => {
  await setProcessEnvironment();
  const db = await connectToDatabase();
  const result = await db.command({ buildInfo: 1 });
  console.log(`result: ${JSON.stringify(result)}`);
}


const main = async () => {
  // await setUserCMSAssistant();
  // await setUserAssistants();
  // await setUserSmartNoteAssistants();
  // await setAdminUserAssistants();
  // await viewUserAssistants();
  // await addAssistants();
  await assignAllAssistantsToUser();
  // await getServerInfo();
  // await viewAssistants();
  // await deleteAllAssistants();
  process.exit(0);
};

main().catch(err => {
  console.error('Error executing main function:', err);
  process.exit(1);
});