'use client';

import { useEffect, useState } from 'react';
import {
    Button,
    Box,
    Checkbox,
    FormControlLabel,
    Typography,
} from '@mui/material';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import EpdsFilterModal from './EpdsFilterModal';
import { submitEpdsFilter, buildEpdsQuery, clearEpdsFilter } from '@/app/clientServices/epdsService';

function normalizeText(value) {
    return String(value || '').trim();
}

function normalizeTextArray(value) {
    if (Array.isArray(value)) {
        return value.map((item) => normalizeText(item)).filter(Boolean);
    }

    const normalized = normalizeText(value);
    return normalized ? [normalized] : [];
}

function epdsValueArrayToCriteria(valueArray) {
    if (!Array.isArray(valueArray) || !valueArray.length) {
        return null;
    }

    return {
        exchangeSubscriberId: normalizeText(valueArray[0]),
        policyId: normalizeText(valueArray[1]),
        exchange: normalizeText(valueArray[2]),
        coverageYear: normalizeTextArray(valueArray[3]),
        startFileReceiveDate: normalizeText(valueArray[4]),
        endFileReceiveDate: normalizeText(valueArray[5]),
        fileTypes: normalizeTextArray(valueArray[6]),
    };
}

const EPDS_QUERY_TEXT = 'Retrieve epds file details';

export default function EpdsFilterDisplay({
    smartNote,
    smartNoteId,
    teamName,
    sessionId,
    assistantName,
    smartNoteCreateDt,
    chatInputRef,
    onFilterApplied,
    onEnabledChange,
    enabled,
    featureEnabled = true,
}) {
    if (!featureEnabled) {
        return null;
    }

    const [epdsFilters, setEpdsFilters] = useState(null);
    const [modalOpen, setModalOpen] = useState(false);
    const [loading, setLoading] = useState(false);
    const [isEnabled, setIsEnabled] = useState(false);

    useEffect(() => {
        const rawEpdsFilters = smartNote?.epdsFilters;
        let latestEpdsFilter = null;

        if (Array.isArray(rawEpdsFilters)) {
            if (!rawEpdsFilters.length) {
                latestEpdsFilter = null;
            } else if (rawEpdsFilters[0] && typeof rawEpdsFilters[0] === 'object' && !Array.isArray(rawEpdsFilters[0])) {
                latestEpdsFilter = rawEpdsFilters[0];
            } else {
                latestEpdsFilter = epdsValueArrayToCriteria(rawEpdsFilters);
            }
        } else if (rawEpdsFilters && typeof rawEpdsFilters === 'object') {
            latestEpdsFilter = rawEpdsFilters;
        }

        if (latestEpdsFilter) {
            const { submittedAt, ...criteria } = latestEpdsFilter;
            setEpdsFilters(criteria);
            setIsEnabled(true);
            if (onEnabledChange) {
                onEnabledChange(true, criteria);
            }
        } else {
            setEpdsFilters(null);
            setIsEnabled(false);
            if (onEnabledChange) {
                onEnabledChange(false, null);
            }
        }
    }, [smartNote?.epdsFilters, onEnabledChange]);

    useEffect(() => {
        if (typeof enabled !== 'boolean') {
            return;
        }

        setIsEnabled(enabled);
    }, [enabled]);

    const hasFilters = epdsFilters !== null;

    const handleEditClick = () => {
        setModalOpen(true);
    };

    const handleModalClose = () => {
        setModalOpen(false);
    };

    const handleFilterSubmit = async (formData) => {
        try {
            setLoading(true);

            const payloadFormData = {
                ...formData,
                queryText: EPDS_QUERY_TEXT,
            };

            // Apply UI state immediately (optimistic update)
            setEpdsFilters(payloadFormData);
            setIsEnabled(true);
            if (onEnabledChange) {
                onEnabledChange(true, payloadFormData);
            }
            if (onFilterApplied) {
                onFilterApplied(payloadFormData);
            }

            const query = buildEpdsQuery(payloadFormData);

            await submitEpdsFilter(
                query,
                smartNoteId,
                teamName,
                sessionId,
                assistantName,
                smartNoteCreateDt
            );

            // Mirror MRN behavior: trigger retrieval immediately after filter submit.
            if (chatInputRef?.current) {
                chatInputRef.current.dataset.epdsEnabled = 'true';
                chatInputRef.current.dataset.epdsFilters = JSON.stringify(payloadFormData);
                chatInputRef.current.dataset.case360PromptCategory = 'epds';
                chatInputRef.current.value = query.queryText || EPDS_QUERY_TEXT;

                const form = chatInputRef.current.closest('form');
                if (form) {
                    const submitEvent = new Event('submit', {
                        bubbles: true,
                        cancelable: true,
                    });
                    form.dispatchEvent(submitEvent);
                }
            }
        } catch (error) {
            console.error('Error applying filters:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleClearFilters = async () => {
        try {
            setLoading(true);
            await clearEpdsFilter(smartNoteId, teamName);
            setEpdsFilters(null);
            setIsEnabled(false);
            if (chatInputRef?.current) {
                chatInputRef.current.dataset.epdsEnabled = 'false';
                delete chatInputRef.current.dataset.epdsFilters;
                delete chatInputRef.current.dataset.case360PromptCategory;
            }
            if (onEnabledChange) {
                onEnabledChange(false, null);
            }
        } catch (error) {
            console.error('Error clearing filters:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleEnabledChange = (e) => {
        const enabled = e.target.checked;
        setIsEnabled(enabled);
        if (chatInputRef?.current) {
            chatInputRef.current.dataset.epdsEnabled = enabled ? 'true' : 'false';
            if (enabled && epdsFilters) {
                chatInputRef.current.dataset.epdsFilters = JSON.stringify(epdsFilters);
            }
            if (!enabled) {
                delete chatInputRef.current.dataset.epdsFilters;
                delete chatInputRef.current.dataset.case360PromptCategory;
            }
        }
        if (onEnabledChange) {
            onEnabledChange(enabled, enabled ? epdsFilters : null);
        }
    };

    return (
        <>
            {/* EPDS Filter Box */}
            <Box sx={{
                border: '1px solid',
                borderColor: 'divider',
                borderRadius: 1,
                p: 2,
                mb: 2,
                display: 'flex',
                flexDirection: 'column',
                gap: 3,
            }}>
                {/* Title */}
                <Typography variant="subtitle1" sx={{ fontWeight: 500 }}>
                    EPDS Filters
                </Typography>

                {/* Actions row: Edit | enabled checkbox | Clear */}
                <Box sx={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'space-between',
                }}>
                    <Button
                        variant="text"
                        startIcon={<EditIcon />}
                        onClick={handleEditClick}
                        disabled={loading}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        Edit
                    </Button>

                    <FormControlLabel
                        control={
                            <Checkbox
                                checked={isEnabled}
                                onChange={handleEnabledChange}
                                disabled={!hasFilters || loading}
                                size="small"
                            />
                        }
                        label="Enabled"
                        sx={{ m: 0, '& .MuiFormControlLabel-label': { fontSize: '0.875rem' } }}
                    />

                    <Button
                        variant="text"
                        startIcon={<DeleteIcon />}
                        onClick={handleClearFilters}
                        disabled={!hasFilters || loading}
                        size="small"
                        sx={{ textTransform: 'none' }}
                    >
                        Clear
                    </Button>
                </Box>
            </Box>

            {/* EPDS Filter Modal Drawer */}
            <EpdsFilterModal
                open={modalOpen}
                onClose={handleModalClose}
                onSubmit={handleFilterSubmit}
                onClear={handleClearFilters}
                initialData={epdsFilters ? { criteria: epdsFilters } : null}
            />
        </>
    );
}