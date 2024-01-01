export const queryDatabase = async (absolutePath, payload) => {
    try {
        const response = await fetch(`${absolutePath}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(payload),
        });

        return response;
        
    } catch (error) {
        throw new Error(`Error submitting form: ${error.message}`);
    }
};