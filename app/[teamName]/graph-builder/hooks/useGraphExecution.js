'use client'

import { useState, useCallback } from 'react';

// API helper functions
const callValidationAPI = async (graph, action) => {
  const response = await fetch('/api/graph/validate', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ graph, action }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Validation API call failed');
  }

  return response.json();
};

const callExecutionAPI = async (graph, options, action) => {
  const response = await fetch('/api/graph/execute', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ graph, options, action }),
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(error.error || 'Execution API call failed');
  }

  return response.json();
};

export function useGraphExecution() {
  const [executionResult, setExecutionResult] = useState(null);
  const [isExecuting, setIsExecuting] = useState(false);
  const [executionOrder, setExecutionOrder] = useState([]);
  const [validationResult, setValidationResult] = useState(null);
  const [executionCapabilities, setExecutionCapabilities] = useState(null);

  const validateAndPrepare = useCallback(async (graph) => {
    try {
      const validation = await callValidationAPI(graph, 'validate');
      setValidationResult(validation);

      if (validation.isValid) {
        const orderResult = await callValidationAPI(graph, 'generateExecutionOrder');
        if (orderResult.success) {
          setExecutionOrder(orderResult.executionOrder);
        }
      }

      return validation;
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        errors: [{ message: error.message, type: 'VALIDATION_ERROR' }],
        warnings: [],
        validationDetails: {}
      };
    }
  }, []);

  const executeGraphWorkflow = useCallback(async (graph, options = {}) => {
    setIsExecuting(true);
    setExecutionResult(null);

    try {
      // First validate
      const validation = await validateAndPrepare(graph);
      if (!validation.isValid) {
        const errorMessage = validation.errors.map(e => e.message).join(', ');
        throw new Error(`Graph validation failed: ${errorMessage}`);
      }

      // Execute the graph
      const result = await callExecutionAPI(graph, options, 'execute');
      setExecutionResult(result);

      return result;
    } catch (error) {
      console.error('Execution error:', error);
      const errorResult = {
        success: false,
        error: error.message,
        executionId: null,
        executionLog: [],
        startTime: new Date().toISOString(),
        endTime: new Date().toISOString()
      };
      setExecutionResult(errorResult);
      return errorResult;
    } finally {
      setIsExecuting(false);
    }
  }, [validateAndPrepare]);

  const getCapabilities = useCallback(async () => {
    try {
      const capabilities = await callExecutionAPI(null, null, 'getCapabilities');
      setExecutionCapabilities(capabilities);
      return capabilities;
    } catch (error) {
      console.error('Failed to get execution capabilities:', error);
      return null;
    }
  }, []);

  const checkCanExecute = useCallback(async (graph) => {
    try {
      const status = await callValidationAPI(graph, 'getValidationStatus');
      return status.canExecute;
    } catch (error) {
      console.error('Failed to check execution status:', error);
      return false;
    }
  }, []);

  const getExecutionSummary = useCallback(() => {
    if (!executionResult) return null;

    if (!executionResult.success) {
      return {
        status: 'failed',
        error: executionResult.error,
        nodeId: executionResult.nodeId,
        executionTime: 0,
        nodesExecuted: 0
      };
    }

    const startTime = new Date(executionResult.startTime);
    const endTime = new Date(executionResult.endTime);
    const executionTime = endTime - startTime;

    return {
      status: 'success',
      executionTime,
      nodesExecuted: executionResult.nodeCount,
      finalResults: executionResult.finalResults,
      executionOrder: executionResult.executionOrder,
      totalNodes: executionResult.nodeCount
    };
  }, [executionResult]);

  const clearResults = useCallback(() => {
    setExecutionResult(null);
    setValidationResult(null);
    setExecutionOrder([]);
  }, []);

  return {
    // State
    executionResult,
    isExecuting,
    executionOrder,
    validationResult,
    executionCapabilities,

    // Actions
    validateAndPrepare,
    executeGraphWorkflow,
    getCapabilities,
    checkCanExecute,
    clearResults,

    // Computed
    getExecutionSummary,
    canExecute: validationResult?.isValid || false,
    hasValidationErrors: validationResult?.errors?.length > 0 || false,
    hasValidationWarnings: validationResult?.warnings?.length > 0 || false
  };
}