'use client';

export async function createTag(teamName, tagName) {
    const response = await fetch(`/api/admin/ets/manageIndexTags`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagName }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to create tag');
    }

    return await response.json();
}

export async function updateTag(teamName, id, tagName) {
    const response = await fetch(`/api/admin/ets/manageIndexTags/${id}`, {
        method: 'PUT',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({ tagName }),
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to update tag');
    }

    return await response.json();
}

export async function deleteTag(teamName, id) {
    const response = await fetch(`/api/admin/ets/manageIndexTags/${id}`, {
        method: 'DELETE',
    });

    if (!response.ok) {
        throw new Error('Failed to delete tag');
    }

    return await response.json();
}

export async function getAllTags(teamName) {
    const response = await fetch(`/api/admin/ets/manageIndexTags`);

    if (!response.ok) {
        throw new Error('Failed to fetch tags');
    }

    return await response.json();
}

export async function getTagById(teamName, id) {
    const response = await fetch(`/api/admin/ets/manageIndexTags/${id}`);

    if (!response.ok) {
        throw new Error('Failed to fetch tag');
    }

    return await response.json();
}
