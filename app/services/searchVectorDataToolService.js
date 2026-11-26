'use server';

import { tool } from "@langchain/core/tools";
import { searchIndex } from '@services/searchVectorDataService';
import { z } from "zod";

export async function createSearchIndexTool() {
  return tool((input) => {
    searchIndex(input);
  },
    {
      name: 'searchIndex',
      description: 'Searh Azure AI Search',
      schema: z.object(
        {
          searchIndex: z.string().describe('Name of AI Search index to search.'),
          selectFields: z.array(z.string()).describe('An array of index fields.'),
          searchEmbedding: z.array(z.number()).describe('Embedding number array.'),
          nearestNeighbors: z.number().describe('The number of nearest neighbors matching search embedding'),
          filter: z.string().describe('Filter string to filter index data based on filterable fields.')
        })
    });
}

