const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // Use node-fetch for backend requests

const app = express();
const port = process.env.PORT || 3000;
const GAS_URL = process.env.GAS_URL; // Get GAS URL from environment variables

// Middleware
app.use(express.json()); // Parse JSON request bodies
app.use(express.static(path.join(__dirname, 'public'))); // Serve static files

// Proxy function to call Google Apps Script
async function callGas(action, payload) {
    if (!GAS_URL) {
        console.error("FATAL: GAS_URL environment variable is not set.");
        return { status: 'error', message: 'Server configuration error.' };
    }
    
    try {
        console.log(`Calling GAS Action: ${action}`); // Log action being called
        const response = await fetch(GAS_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json', // Sending JSON to GAS
            },
            body: JSON.stringify({ action, payload }),
        });
        
        if (!response.ok) {
            // Attempt to get more detailed error from GAS response body
            let errorText = `GAS script error (Status: ${response.status})`;
            try {
                const text = await response.text();
                console.error(`GAS Error Response: ${text}`);
                // Attempt to parse if JSON, otherwise use text
                try {
                    const jsonError = JSON.parse(text);
                    errorText = jsonError.message || text; // Use message if available
                } catch (parseErr) {
                    errorText = text || errorText; // Use raw text if not JSON
                }
            } catch (readErr) {
                console.error("Could not read GAS error response body:", readErr);
            }
            throw new Error(errorText);
        }
        
        const result = await response.json();
        console.log(`GAS Response for ${action}:`, result.status); // Log status
        return result; // Return the JSON parsed response from GAS
        
    } catch (error) {
        console.error(`Error calling GAS Action ${action}:`, error);
        return { status: 'error', message: error.message || 'Failed to communicate with backend script.' };
    }
}

// --- API Routes ---

app.post('/api/create-agent', async (req, res) => {
    const result = await callGas('createAgent', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/verify-agent', async (req, res) => {
    const result = await callGas('verifyAgent', req.body);
    res.status(result.status === 'success' ? 200 : (result.message === 'Invalid Agent ID' ? 401 : 500)).json(result);
});

app.post('/api/verify-school', async (req, res) => {
    // Potential security: Ensure agentId in req.body matches logged-in user if session exists
    const result = await callGas('verifySchool', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/get-agent-verified-schools', async (req, res) => {
    const result = await callGas('getAgentVerifiedSchools', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/activate-premium', async (req, res) => {
    const result = await callGas('activatePremium', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/get-agent-dashboard', async (req, res) => {
    const result = await callGas('getAgentDashboardData', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/update-profile', async (req, res) => {
    const result = await callGas('updateAgentProfile', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

// Optional: Route for getting unverified schools (if needed)
app.get('/api/get-unverified-schools', async (req, res) => {
    const result = await callGas('getUnverifiedSchools', {}); // No payload needed usually
    res.status(result.status === 'success' ? 200 : 500).json(result);
});


// Catch-all route to serve index.html for any other GET request
app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Start server
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    if (!GAS_URL) {
        console.warn("Warning: GAS_URL environment variable is not set. API calls will fail.");
    } else {
        console.log("GAS URL is configured.");
    }
});

module.exports = app;