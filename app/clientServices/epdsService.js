'use client';

export const submitEpdsFilter = async (query, smartNoteId, teamName, sessionId, assistantName, smartNoteCreateDt) => {
    try {
        const formData = new FormData();

        formData.append('query', JSON.stringify(query));
        formData.append('smart_note_id', smartNoteId);
        formData.append('teamName', teamName);
        formData.append('sessionId', sessionId);
        formData.append('assistantName', assistantName);
        formData.append('smart_note_create_dt', smartNoteCreateDt);

        const response = await fetch('/api/case360/epds', {
            method: 'POST',
            body: formData,
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to submit EPDS filter');
        }

        return await response.json();
    } catch (error) {
        console.error('Error submitting EPDS filter:', error);
        throw error;
    }
};

export const clearEpdsFilter = async (smartNoteId, teamName) => {
    try {
        const response = await fetch('/api/case360/epds', {
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                smartNoteId,
                teamName,
            }),
        });

        if (!response.ok) {
            const errorData = await response.json();
            throw new Error(errorData.error || 'Failed to clear EPDS filter');
        }

        return await response.json();
    } catch (error) {
        console.error('Error clearing EPDS filter:', error);
        throw error;
    }
};

export const buildEpdsQuery = (criteria) => {
    return {
        filter: criteria.filter || 'latest',
        queryText: criteria.queryText || '',
        criteria: {
            exchangeSubscriberId: criteria.exchangeSubscriberId || '',
            policyId: criteria.policyId || '',
            exchange: criteria.exchange || '',
            coverageYear: criteria.coverageYear || [],
            startFileReceiveDate: criteria.startFileReceiveDate || '',
            endFileReceiveDate: criteria.endFileReceiveDate || '',
            fileTypes: criteria.fileTypes || [],
        }
    };
};
