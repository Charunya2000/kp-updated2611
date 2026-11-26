import {
  getGraphById,
  updateGraph,
  deleteGraph,
  graphNameExists
} from "@/app/services/graphConfigurationService";
import { NextResponse } from "next/server";

/**
 * GET /api/[teamName]/graphs/[id]
 * Get a specific graph by ID
 */
export async function GET(req, { params }) {
  try {
    const { teamName, id } = await params;

    const graph = await getGraphById(id, teamName);
    if (!graph) {
      return NextResponse.json({ error: 'Graph not found' }, { status: 404 });
    }

    return NextResponse.json(graph, { status: 200 });
  } catch (error) {
    console.error('Error in GET /api/[teamName]/graphs/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * PUT /api/[teamName]/graphs/[id]
 * Update a specific graph
 */
export async function PUT(req, { params }) {
  try {
    const { teamName, id } = await params;
    const graphData = await req.json();

    // Check for name uniqueness
    const nameExists = await graphNameExists(graphData.name, teamName, id);
    if (nameExists) {
      return NextResponse.json({ error: 'Graph name already exists' }, { status: 409 });
    }

    const updatedGraph = await updateGraph(id, graphData, teamName);
    return NextResponse.json(updatedGraph, { status: 200 });
  } catch (error) {
    console.error('Error in PUT /api/[teamName]/graphs/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * DELETE /api/[teamName]/graphs/[id]
 * Delete a specific graph
 */
export async function DELETE(req, { params }) {
  try {
    const { teamName, id } = await params;

    const result = await deleteGraph(id, teamName);
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    console.error('Error in DELETE /api/[teamName]/graphs/[id]:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}