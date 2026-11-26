/**
 * Example: How to register custom nodes with implementations
 * This demonstrates the complete workflow from schema to execution
 */

import nodeRegistry from '../components/NodeRegistry.js';
import { NodeDataTypes, UIComponents } from '../services/schemas/nodeSchema.js';

/**
 * Example 1: Custom Email Node
 */
const emailNodeDefinition = {
  metadata: {
    type: "email_sender",
    version: "1.0.0",
    description: "Send emails with customizable templates",
    category: "Communication",
    icon: "📧",
    color: "#fff8e1"
  },
  inputSchema: {
    required: ["recipient", "subject", "body"],
    properties: {
      recipient: {
        type: NodeDataTypes.STRING,
        description: "Email address of the recipient",
        validation: {
          pattern: "^[\\w-\\.]+@([\\w-]+\\.)+[\\w-]{2,4}$"
        }
      },
      subject: {
        type: NodeDataTypes.STRING,
        description: "Email subject line"
      },
      body: {
        type: NodeDataTypes.STRING,
        description: "Email content body",
        ui: {
          component: UIComponents.TEXT_AREA,
          props: { rows: 6 }
        }
      },
      priority: {
        type: NodeDataTypes.SELECT,
        description: "Email priority level",
        default: "normal",
        validation: {
          options: [
            { value: "low", label: "Low Priority" },
            { value: "normal", label: "Normal Priority" },
            { value: "high", label: "High Priority" },
            { value: "urgent", label: "Urgent" }
          ]
        }
      },
      send_copy_to_self: {
        type: NodeDataTypes.BOOLEAN,
        description: "Send a copy to sender",
        default: false
      }
    }
  },
  stateSchema: {
    properties: {
      smtp_server: {
        type: NodeDataTypes.STRING,
        description: "SMTP server configuration",
        persistent: true,
        default: "smtp.gmail.com"
      },
      sent_count: {
        type: NodeDataTypes.NUMBER,
        description: "Number of emails sent",
        persistent: true,
        default: 0
      }
    }
  },
  outputSchema: {
    required: ["success", "message_id"],
    properties: {
      success: {
        type: NodeDataTypes.BOOLEAN,
        description: "Whether the email was sent successfully"
      },
      message_id: {
        type: NodeDataTypes.STRING,
        description: "Unique identifier for the sent email",
        editable: true // Allow users to manually set the message ID if needed
      },
      timestamp: {
        type: NodeDataTypes.STRING,
        description: "Timestamp when email was sent"
      }
    }
  },
  executionLogic: {
    implementation: "email_sender_impl",
    async: true,
    timeout: 10000
  }
};

// Implementation function for email node
async function emailSenderImplementation(inputs, state, context) {
  const { recipient, subject, body, priority, send_copy_to_self } = inputs;
  const { smtp_server, sent_count } = state;

  try {
    // Simulate email sending logic
    console.log(`Sending email to ${recipient}`);
    console.log(`Subject: ${subject}`);
    console.log(`Body: ${body.substring(0, 50)}...`);

    // In a real implementation, you would use an email service like nodemailer
    // const transporter = nodemailer.createTransporter({...});
    // const result = await transporter.sendMail({...});

    // Simulate success
    const messageId = `msg_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

    // Update state
    const newState = {
      ...state,
      sent_count: sent_count + 1
    };

    return {
      outputs: {
        success: true,
        message_id: messageId,
        timestamp: new Date().toISOString()
      },
      newState
    };
  } catch (error) {
    return {
      outputs: {
        success: false,
        message_id: "",
        timestamp: new Date().toISOString()
      },
      error: error.message
    };
  }
}

/**
 * Example 2: File Reader Node
 */
const fileReaderDefinition = {
  metadata: {
    type: "file_reader",
    version: "1.0.0",
    description: "Read content from various file formats",
    category: "File Operations",
    icon: "📁",
    color: "#f3e5f5"
  },
  inputSchema: {
    required: ["file_path"],
    properties: {
      file_path: {
        type: NodeDataTypes.STRING,
        description: "Path to the file to read"
      },
      encoding: {
        type: NodeDataTypes.SELECT,
        description: "File encoding",
        default: "utf8",
        validation: {
          options: ["utf8", "ascii", "base64", "binary"]
        }
      },
      max_size_mb: {
        type: NodeDataTypes.NUMBER,
        description: "Maximum file size to read (MB)",
        default: 10,
        validation: { min: 1, max: 100 }
      }
    }
  },
  stateSchema: {
    properties: {
      last_read_file: {
        type: NodeDataTypes.STRING,
        description: "Path of the last file read",
        persistent: false
      },
      total_files_read: {
        type: NodeDataTypes.NUMBER,
        description: "Total number of files read",
        persistent: true,
        default: 0
      }
    }
  },
  outputSchema: {
    required: ["content"],
    properties: {
      content: {
        type: NodeDataTypes.STRING,
        description: "File content as text",
        ui: {
          component: UIComponents.TEXT_AREA
        }
      },
      file_size: {
        type: NodeDataTypes.NUMBER,
        description: "Size of the file in bytes"
      },
      file_type: {
        type: NodeDataTypes.STRING,
        description: "Detected file type/extension"
      }
    }
  },
  executionLogic: {
    implementation: "file_reader_impl",
    async: true,
    timeout: 5000
  }
};

async function fileReaderImplementation(inputs, state, context) {
  const { file_path, encoding, max_size_mb } = inputs;
  const { total_files_read } = state;

  try {
    // Simulate file reading logic
    // In a real implementation, you would use fs module
    // const fs = require('fs').promises;
    // const content = await fs.readFile(file_path, encoding);

    // Simulate file content
    const content = `Simulated content from file: ${file_path}`;
    const fileSize = content.length;
    const fileType = file_path.split('.').pop() || 'unknown';

    const newState = {
      ...state,
      last_read_file: file_path,
      total_files_read: total_files_read + 1
    };

    return {
      outputs: {
        content,
        file_size: fileSize,
        file_type: fileType
      },
      newState
    };
  } catch (error) {
    return {
      outputs: {
        content: "",
        file_size: 0,
        file_type: "error"
      },
      error: error.message
    };
  }
}

/**
 * Register all example nodes
 */
export function registerExampleNodes() {
  // Register nodes with their implementations
  nodeRegistry.registerNode(emailNodeDefinition, emailSenderImplementation);
  nodeRegistry.registerNode(fileReaderDefinition, fileReaderImplementation);

  console.log('Registered example nodes:', ['email_sender', 'file_reader']);
}

/**
 * Example execution engine (simplified)
 */
export class GraphExecutor {
  constructor(stateManager) {
    this.stateManager = stateManager;
    this.implementations = new Map();
  }

  registerImplementation(nodeType, implementation) {
    this.implementations.set(nodeType, implementation);
  }

  async executeNode(nodeId, inputs = {}) {
    const nodeData = this.stateManager.getAllNodeData(nodeId);
    const nodeDefinition = nodeRegistry.getNodeDefinition(
      // Would need to store node type in state
    );

    if (!nodeDefinition) {
      throw new Error(`Node definition not found for ${nodeId}`);
    }

    const implementation = this.implementations.get(nodeDefinition.metadata.type);
    if (!implementation) {
      throw new Error(`Implementation not found for ${nodeDefinition.metadata.type}`);
    }

    try {
      const result = await implementation(
        inputs,
        nodeData.state,
        { nodeId, nodeDefinition }
      );

      // Update state if new state is provided
      if (result.newState) {
        this.stateManager.setNodeState(nodeId, result.newState);
      }

      return result;
    } catch (error) {
      console.error(`Error executing node ${nodeId}:`, error);
      throw error;
    }
  }

  async executeGraph(nodes, edges) {
    // This would implement topological sort and execution order
    // For now, just a simple example
    console.log('Executing graph with nodes:', nodes.map(n => n.id));
    console.log('Edges:', edges);

    // Implementation would:
    // 1. Analyze dependencies
    // 2. Execute nodes in correct order
    // 3. Pass data between connected nodes
    // 4. Handle errors and rollbacks

    return { success: true, message: 'Graph execution completed' };
  }
}

export { emailNodeDefinition, fileReaderDefinition };