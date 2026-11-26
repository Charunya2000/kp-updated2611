/**
 * @typedef {Object} Document
 * @property {string} [nuid] - The NUID of a user
 * @property {string} [userNUID] - The NUID of a user
 * @property {string} [createdByNUID] - The NUID of a user
 * @property {string} [createdNUID] - The NUID of a user
 * @property {string} [updatedByNUID] - The NUID of a user
 */

/**
 * 
 * @param {Document} document 
 * @returns The document with an uppercase nuid if it exists
 */
export function formatDocument(document) {
  if (document?.nuid && typeof document.nuid === 'string') {
    document.nuid = document.nuid.toUpperCase();
  }
  if (document?.userNUID && typeof document.userNUID === 'string') {
    document.userNUID = document.userNUID.toUpperCase();
  }
  if (document?.createdNUID && typeof document.createdNUID === 'string') {
    document.createdNUID = document.createdNUID.toUpperCase();
  }
  if (document?.createdByNUID && typeof document.createdByNUID === 'string') {
    document.createdByNUID = document.createdByNUID.toUpperCase();
  }
  if (document?.updatedByNUID && typeof document.updatedByNUID === 'string') {
    document.updatedByNUID = document.updatedByNUID.toUpperCase();
  }

  return document;
}

/**
 * Formats a name string by applying various transformations:
 * 
 * - Convert to lowercase
 * - Replace spaces with hyphens
 * - Remove any characters that aren't letters, numbers, or hyphens
 * - Replace multiple consecutive hyphens with single hyphen
 * - Remove leading/trailing hyphens
 * - Remove numbers from the beginning
 * @param {string} name 
 * @example " 123 Hello World! " -> "hello-world"
 * @example "My   Smart--Note!!" -> "my-smart-note"
 * 
 * @returns {string} The formatted name
 */
export function formatName(name) {
  return name
    .replace(/\s+/g, '-')                   // Replace spaces with hyphens
    .replace(/(?<=[a-z])&(?=[a-z])/g, 'a')  // replace ampersand surrounded by lower case letters with the letter "a"
    .replace(/(?<=[A-Z])&(?=[A-Z])/g, 'a')  // replace ampersand surrounded by upper case letters with the letter "a"
    .replace(/&/g, '-and-')                 // Replace "&" with "-and-"
    .replace(/[^a-zA-Z0-9-]/g, '')          // Remove any characters that aren't letters, numbers, or hyphens
    .replace(/-+/g, '-')                    // Replace multiple consecutive hyphens with single hyphen
    .replace(/^-+|-+$/g, '')                // Remove leading/trailing hyphens
    .replace(/^\d+/, '')                    // Remove numbers from the beginning
    .toLowerCase();                         // Convert to lowercase
};