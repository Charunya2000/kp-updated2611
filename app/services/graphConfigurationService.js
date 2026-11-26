'use server';

import { selectDocument, selectDocumentExt, selectDocuments, selectDocumentsExt } from '@db/selectDocument';
import { insertDocument } from '@db/insertDocument';
import { updateDocument } from '@db/updateDocument';
import { deleteDocument } from '@db/deleteDocument';
import { getServerSession } from '@utils/getSession';
import { validateBasicSingleByName, validateBasicMulti } from './validation';
import { prepDocument } from '../clientServices/insertDocument';
import { Description } from '@mui/icons-material';

const dbType = 'GraphConfiguration'

/**
 * Create a new graph
 * @param {Object} graph - The graph object to create
 * @param {string} teamName - The team name
 * @returns {Promise<Object>} The created graph
 */
export async function createGraph(graph, teamName) {
  const { nuid } = await getServerSession();
  const document = prepDocument({
    type: dbType,
    name: graph.name,
    displayName: graph.displayName || graph.name,
    description: graph.description || '',
    ...graph,
    createdBy: nuid,
    updatedBy: nuid
  }, graph.id);

  // Validate required fields
  if (!graph.name) {
    throw new Error('Graph name is required');
  }

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    throw new Error('Graph must have nodes array');
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    throw new Error('Graph must have edges array');
  }

  return await insertDocument(document, validateBasicSingleByName, `team-${teamName}-db`);
}

/**
 * Get all graphs for a specific team
 * @param {string} teamName - The team name
 * @returns {Promise<Array>} Array of graphs for the team
 */
export async function getAllGraphs(teamName) {
  const query = {
    type: dbType
  };

  return await selectDocumentsExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

/**
 * Get a graph by name
 * @param {string} name - The graph name
 * @param {string} teamName - The team name
 * @returns {Promise<Object|null>} The graph object or null if not found
 */
export async function getGraphByName(name, teamName) {
  const { nuid } = await getServerSession();
  const query = {
    type: dbType,
    name: name
  };

  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

/**
 * Get a graph by ID
 * @param {string} id - The graph ID
 * @param {string} teamName - The team name
 * @returns {Promise<Object|null>} The graph object or null if not found
 */
export async function getGraphById(id, teamName) {
  const query = {
    type: dbType,
    id: id
  };

  return await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
}

/**
 * Update an existing graph
 * @param {string} id - The graph ID
 * @param {Object} graph - The updated graph object (must include _id)
 * @param {string} teamName - The team name
 * @returns {Promise<Object>} The updated graph
 */
export async function updateGraph(id, graph, teamName) {
  const { nuid } = await getServerSession();
  if (!id) {
    throw new Error('Graph ID is required for update');
  }

  const document = prepDocument({
    type: dbType,
    name: graph.name,
    displayName: graph.displayName || graph.name,
    description: graph.description || '',
    ...graph,
    updatedBy: nuid
  }, graph.id);

  // Validate required fields
  if (!graph.name) {
    throw new Error('Graph name is required');
  }

  if (!graph.nodes || !Array.isArray(graph.nodes)) {
    throw new Error('Graph must have nodes array');
  }

  if (!graph.edges || !Array.isArray(graph.edges)) {
    throw new Error('Graph must have edges array');
  }

  return await updateDocument(document, { type: dbType, id: id }, validateBasicMulti, `team-${teamName}-db`);
}

/**
 * Delete a graph by ID
 * @param {string} id - The graph ID
 * @param {string} teamName - The team name
 * @returns {Promise<Object>} The deletion result
 */
export async function deleteGraph(id, teamName) {
  const query = {
    type: dbType,
    id: id
  };

  return await deleteDocument(query, validateBasicMulti, `team-${teamName}-db`);
}

/**
 * Check if a graph name already exists for the user in the team
 * @param {string} name - The graph name to check
 * @param {string} teamName - The team name
 * @param {string} [id] - Optional graph ID to exclude from check (for updates)
 * @returns {Promise<boolean>} True if name exists, false otherwise
 */
export async function graphNameExists(name, teamName, id) {
  const query = {
    type: dbType,
    name: name,
    id: { $ne: id } // Exclude current graph ID if provided
  };

  const existingGraph = await selectDocumentExt(query, validateBasicMulti, null, `team-${teamName}-db`);
  return existingGraph !== null;
}