const express = require('express');
const path = require('path');
const fetch = require('node-fetch');

const app = express();
const port = process.env.PORT || 3000;
const GAS_URL = process.env.GAS_URL;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

async function callGas(action, payload) {
    if (!GAS_URL) {
        console.error("FATAL: GAS_URL environment variable is not set.");
        return { status: 'error', message: 'Server configuration error.' };
    }
    
    try {
        console.log(`Calling GAS Action: ${action}`);
        const response = await fetch(GAS_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ action, payload }),
        });
        
        if (!response.ok) {
            let errorText = `GAS script error (Status: ${response.status})`;
            try {
                const text = await response.text();
                console.error(`GAS Error Response: ${text}`);
                try {
                    const jsonError = JSON.parse(text);
                    errorText = jsonError.message || text;
                } catch (parseErr) {
                    errorText = text || errorText;
                }
            } catch (readErr) {
                console.error("Could not read GAS error response body:", readErr);
            }
            throw new Error(errorText);
        }
        
        const result = await response.json();
        console.log(`GAS Response for ${action}:`, result.status);
        return result;
        
    } catch (error) {
        console.error(`Error calling GAS Action ${action}:`, error);
        return { status: 'error', message: error.message || 'Failed to communicate with backend script.' };
    }
}

app.post('/api/create-agent', async (req, res) => {
    const result = await callGas('createAgent', req.body);
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

app.post('/api/verify-agent', async (req, res) => {
    const result = await callGas('verifyAgent', req.body);
    res.status(result.status === 'success' ? 200 : (result.message === 'Invalid Agent ID' ? 401 : 500)).json(result);
});

app.post('/api/verify-school', async (req, res) => {
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

app.get('/api/get-unverified-schools', async (req, res) => {
    const result = await callGas('getUnverifiedSchools', {});
    res.status(result.status === 'success' ? 200 : 500).json(result);
});

// Let Vercel's routing handle serving index.html for non-API GET requests
// The express.static middleware above handles it during local development.

app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    if (!GAS_URL) {
        console.warn("Warning: GAS_URL environment variable is not set. API calls will fail.");
    } else {
        console.log("GAS URL is configured.");
    }
});

module.exports = app;