# genai-portal-notebook
This repo holds the V2 version of the GenAI Portal. It's notebook based

## Memory-Optimized Excel Processing

The system includes specialized modules for processing large Excel files efficiently with minimal memory footprint. These optimizations help handle very large spreadsheets without memory issues.

### Key Memory Optimization Features

- **Chunked Sheet Processing** - Process Excel sheets in smaller manageable chunks
- **Controlled Garbage Collection** - Strategic memory release at critical points
- **Streaming Vectorization** - Process vectors in batches to limit memory usage
- **Reference Clearing** - Explicitly clear unused references to aid garbage collection
- **Bounded Memory Usage** - Configure upper limits on chunk sizes
- **Connection Pooling** - Efficiently reuse service connections
- **Error Resilience** - Batch-level error handling prevents total job failure
- **Header Preservation** - Automatically detects and repeats table headers across chunks
- **Formatting Intelligence** - Identifies important rows based on bold text and cell shading

### Usage

The memory-optimized Excel processing is used in:

```javascript
// To process Excel files for vectorization:
import { vectorizeAndIndexDocument } from './app/services/insertChunckedFileIntoVectorDataService';

// Example usage:
const result = await vectorizeAndIndexDocument({
  type: 'UploadedDocument',
  teamName: '',
  assistantName: '',
  fileName: 'example.xlsx',
  fileContent: excelBuffer,
  parentId: 'note-123'
});
```

## Workflow Diagrams with ReactFlow

This project includes interactive workflow diagrams built with ReactFlow. These diagrams feature animated transitions to visualize workflow progress in real-time.

### Features

- **Animated step transitions** - Visual feedback as workflow steps complete
- **Interactive nodes** - Click on nodes to view detailed information
- **Customizable workflow paths** - Support for linear and branching workflows
- **Real-time status updates** - Color-coded nodes reflect current status
- **Event logging** - Track workflow execution with timestamped logs

### Demo Pages

Three example implementations are available:

1. **Basic Workflow Demo** - `/workflow-demo`
   - Simple linear workflow with play/pause controls
   - Adjustable animation speed
   - Step-by-step progression

2. **Document Processing Workflow** - `/document-processing`
   - File upload interface
   - Simulated document processing with realistic timing
   - Detailed processing log with timestamps

3. **Branching Workflow Diagram** - `/branching-workflow`
   - Multiple path options with decision points
   - Conditional branching based on decisions
   - Complex node layout with custom node types

4. **Swimlane Workflow Diagram** - `/swimlane-workflow`
   - Organizes workflow steps by department/role
   - Visual separation of responsibilities
   - Color-coded swimlanes
   - Cross-lane process flows

### Usage

To use the workflow diagram in your own components:

```jsx
import WorkflowDiagram from '../components/WorkflowDiagram';

// Define your workflow steps
const workflowSteps = [
  {
    id: 'step-0',
    label: 'Initialize',
    description: 'Starting workflow process',
    metadata: { estimatedTime: '1 min' } // Optional metadata
  },
  // ... more steps
];

// In your component
function MyComponent() {
  const [currentStep, setCurrentStep] = useState(0);
  
  return (
    <WorkflowDiagram 
      steps={workflowSteps} 
      currentStep={currentStep}
      onStepClick={handleStepClick}
    />
  );
}
```

### Customization

The workflow diagram components can be customized with:

- Custom node types for different step types
- Custom styling via CSS
- Different layout arrangements
- Animated edge transitions
- Interactive controls
