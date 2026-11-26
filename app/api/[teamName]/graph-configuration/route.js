import {
  getAllGraphs,
  createGraph,
  graphNameExists
} from "@/app/services/graphConfigurationService";
import { NextResponse } from "next/server";

/**
 * GET /api/[teamName]/graphs
 * Get all graphs for the team
 */
export async function GET(req, { params }) {
  try {
    const { teamName } = await params;

    // Get all graphs for the team
    const graphs = await getAllGraphs(teamName);
    return NextResponse.json(graphs, { status: 200 });

  } catch (error) {
    console.error('Error in GET /api/[teamName]/graphs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

/**
 * POST /api/[teamName]/graphs
 * Create a new graph
 */
export async function POST(req, { params }) {
  try {
    const { teamName } = await params;
    const graphData = await req.json();

    // Check if graph name already exists
    if (await graphNameExists(graphData.name, teamName)) {
      return NextResponse.json({
        error: `Graph with name "${graphData.name}" already exists`
      }, { status: 409 });
    }

    const createdGraph = await createGraph(graphData, teamName);
    return NextResponse.json(createdGraph, { status: 201 });
  } catch (error) {
    console.error('Error in POST /api/[teamName]/graphs:', error);
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}