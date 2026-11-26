'use client'

import { useState, useCallback, useEffect } from 'react';
import {
  validateGraph,
  quickValidateTerminal,
  getValidationStatus
} from '../services/validation/graphValidator.js';

export function useGraphValidation() {
  const [validationResult, setValidationResult] = useState(null);
  const [isValidating, setIsValidating] = useState(false);
  const [validationStatus, setValidationStatus] = useState({
    hasTerminalNode: false,
    hasErrors: false,
    hasWarnings: false,
    errorCount: 0,
    warningCount: 0,
    canExecute: false
  });

  const performFullValidation = useCallback(async (graph) => {
    setIsValidating(true);
    try {
      const result = await validateGraph(graph);
      setValidationResult(result);
      return result;
    } catch (error) {
      console.error('Validation error:', error);
      return {
        isValid: false,
        errors: [{ message: 'Client validation error', type: 'CLIENT_ERROR' }],
        warnings: [],
        validationDetails: {}
      };
    } finally {
      setIsValidating(false);
    }
  }, []);

  const checkTerminalNodes = useCallback(async (graph) => {
    try {
      return await quickValidateTerminal(graph);
    } catch (error) {
      console.error('Terminal validation error:', error);
      return false;
    }
  }, []);

  const updateValidationStatus = useCallback(async (graph) => {
    try {
      const status = await getValidationStatus(graph);
      setValidationStatus(status);
      return status;
    } catch (error) {
      console.error('Status validation error:', error);
      return validationStatus;
    }
  }, [validationStatus]);

  // Debounced validation for real-time feedback
  const debouncedValidation = useCallback(
    debounce(async (graph) => {
      await updateValidationStatus(graph);
    }, 500),
    [updateValidationStatus]
  );

  return {
    validationResult,
    validationStatus,
    isValidating,
    performFullValidation,
    checkTerminalNodes,
    updateValidationStatus,
    debouncedValidation
  };
}

// Simple debounce utility
function debounce(func, wait) {
  let timeout;
  return function executedFunction(...args) {
    const later = () => {
      clearTimeout(timeout);
      func(...args);
    };
    clearTimeout(timeout);
    timeout = setTimeout(later, wait);
  };
}