'use server';

import { selectDocumentExt, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateDocumentDelete, validateBasicSingle, validateBasicMulti } from '../../../../services/validation';
import { prepDocument } from '../../../../clientServices/insertDocument';

export async function createTag(teamName, tagName) {
    const { nuid } = await getServerSession();

    const tag = prepDocument({
        type: "EtsIndexTag",
        tag: tagName,
        createdBy: nuid,
        updatedBy: nuid
    });

    return await insertDocument(tag, validateBasicMulti, `team-${teamName}-db`);
}

export async function updateTag(teamName, id, tagName) {
    const { nuid } = await getServerSession();

    const query = { type: "EtsIndexTag", id: id };
    const tag = {
        tag: tagName,
        type: "EtsIndexTag",
        updatedBy: nuid
    };
    return await updateDocument(tag, query, validateBasicMulti, `team-${teamName}-db`);
}

export async function deleteTag(teamName, id) {
    const { nuid } = await getServerSession();

    return await deleteDocument({ type: "EtsIndexTag", id }, validateDocumentDelete, `team-${teamName}-db`);
}

export async function getAllTags(teamName) {
    try {
        const { nuid } = await getServerSession();
        const tags = await selectDocumentsExt({ type: "EtsIndexTag" }, validateBasicMulti, null, `team-${teamName}-db`);
        return tags || [];
    } catch (error) {
        console.error('Error fetching tags:', error);
        return [];
    }
}

export async function getTagById(teamName, id) {
    const { nuid } = await getServerSession();

    const query = { type: "EtsIndexTag", id: id };
    return await selectDocumentExt(query, validateBasicSingle, null, `team-${teamName}-db`);
}
