const express = require('express');
const path = require('path');
const fetch = require('node-fetch'); // Use node-fetch v2 for CJS

const app = express();
const port = process.env.PORT || 3000;
const GAS_URL = process.env.GAS_URL;

// Middleware
// Increase payload size limit for base64 photo data
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// --- Proxy Function ---
async function callGas(action, payload) {
    if (!GAS_URL) {
        console.error("FATAL: GAS_URL environment variable is not set.");
        // Return a structure consistent with expected JSON responses
        return { status: 'error', message: 'Server configuration error.', statusCode: 500 };
    }
    
    let response; // Define response outside try block
    try {
        console.log(`Calling GAS Action: ${action}`);
        response = await fetch(GAS_URL, {
            method: 'POST',
            redirect: 'follow',
            headers: {
                'Content-Type': 'application/json',
            },
            // Ensure payload is always an object, even if empty
            body: JSON.stringify({ action, payload: payload || {} }),
            // Add a timeout (e.g., 60 seconds) as GAS can be slow
            timeout: 60000
        });
        
        // Attempt to parse JSON regardless of status code
        const result = await response.json();
        console.log(`GAS Raw Response Status for ${action}: ${response.status}`);
        console.log(`GAS Raw Response Body for ${action}: ${JSON.stringify(result)}`);
        
        
        if (!response.ok) {
            // Use message from GAS JSON response if available
            const errorMessage = result.message || `GAS script error (Status: ${response.status})`;
            console.error(`Error from GAS for action ${action}: ${errorMessage}`);
            // Determine appropriate status code
            let statusCode = 500; // Default internal server error
            if (response.status === 400 || (result.message && result.message.toLowerCase().includes("missing"))) statusCode = 400; // Bad request
            if (response.status === 401 || (result.message && result.message.toLowerCase().includes("invalid"))) statusCode = 401; // Unauthorized/Invalid creds
            if (response.status === 404 || (result.message && result.message.toLowerCase().includes("not found"))) statusCode = 404; // Not Found
            
            return { status: 'error', message: errorMessage, statusCode: statusCode };
        }
        
        // Check for application-level errors even if status is 2xx
        if (result.status === 'error') {
            console.warn(`Application error from GAS for action ${action}: ${result.message}`);
            // Determine status code based on message content
            let statusCode = 400; // Default bad request for application errors
            if (result.message && result.message.toLowerCase().includes("exist")) statusCode = 409; // Conflict (e.g., email exists)
            if (result.message && result.message.toLowerCase().includes("invalid")) statusCode = 401; // Or 400 depending on context
            
            return { status: 'error', message: result.message, statusCode: statusCode };
        }
        
        console.log(`GAS Success Response for ${action}:`, result.status);
        return { ...result, statusCode: 200 }; // Add statusCode for success
        
    } catch (error) {
        console.error(`Network or Parsing Error calling GAS Action ${action}:`, error);
        // Handle fetch timeouts specifically
        if (error.name === 'FetchError' && error.type === 'request-timeout') {
            return { status: 'error', message: 'Request to backend script timed out.', statusCode: 504 }; // Gateway timeout
        }
        // Handle JSON parsing errors from response.json()
        if (error instanceof SyntaxError) {
            console.error("Failed to parse JSON response from GAS.");
            return { status: 'error', message: 'Invalid response received from backend script.', statusCode: 502 }; // Bad gateway
        }
        // General error
        return { status: 'error', message: error.message || 'Failed to communicate with backend script.', statusCode: 500 };
    }
}

// --- API Routes ---

// Centralized error handling for API routes
const handleApiResponse = (res, result) => {
    // Use the statusCode determined by callGas
    res.status(result.statusCode || 500).json(result);
};

app.post('/api/create-agent', async (req, res) => {
    const result = await callGas('createAgent', req.body);
    handleApiResponse(res, result);
});

app.post('/api/verify-agent', async (req, res) => {
    const result = await callGas('verifyAgent', req.body);
    handleApiResponse(res, result);
});

app.post('/api/verify-school', async (req, res) => {
    const result = await callGas('verifySchool', req.body);
    handleApiResponse(res, result);
});

app.post('/api/get-agent-verified-schools', async (req, res) => {
    const result = await callGas('getAgentVerifiedSchools', req.body);
    handleApiResponse(res, result);
});

app.post('/api/activate-premium', async (req, res) => {
    const result = await callGas('activatePremium', req.body);
    handleApiResponse(res, result);
});

app.post('/api/get-agent-dashboard', async (req, res) => {
    const result = await callGas('getAgentDashboardData', req.body);
    handleApiResponse(res, result);
});

app.post('/api/update-profile', async (req, res) => {
    const result = await callGas('updateAgentProfile', req.body);
    handleApiResponse(res, result);
});

app.get('/api/get-unverified-schools', async (req, res) => {
    const result = await callGas('getUnverifiedSchools', {}); // GET request, no payload needed in body
    handleApiResponse(res, result);
});

// --- Frontend Catch-all ---
app.get('*', (req, res) => {
    // Avoid sending index.html for API-like paths if they weren't matched above
    if (req.path.startsWith('/api/')) {
        return res.status(404).json({ status: 'error', message: 'API endpoint not found.' });
    }
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// --- Server Start ---
app.listen(port, () => {
    console.log(`Server listening at http://localhost:${port}`);
    if (!GAS_URL) {
        console.warn("------------------------------------------------------");
        console.warn("Warning: GAS_URL environment variable is not set.");
        console.warn("The application proxy backend will not function.");
        console.warn("------------------------------------------------------");
    } else {
        console.log("Google Apps Script URL is configured.");
    }
});

module.exports = app;