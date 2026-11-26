import { v4 as uuidv4 } from 'uuid';

export const prepDocument = (document, id) => {
  return {
    ...document,
    id: id || uuidv4(),
    createdAt: new Date(),
    updatedAt: new Date()
  }
}