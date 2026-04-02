const API_URL = 'http://localhost:3000';

async function apiCall(endpoint, method = 'GET', data = null) {
    const options = { method, headers: {} };
    if (data) {
        if(data instanceof FormData) {
            options.body = data; // Browser sets multipart/form-data boundary automatically
        } else {
            options.headers['Content-Type'] = 'application/json';
            options.body = JSON.stringify(data);
        }
    }
    try {
        const response = await fetch(`${API_URL}${endpoint}`, options);
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        alert('Network error. Is the backend running?');
        return null;
    }
}

const user = JSON.parse(localStorage.getItem('ai_food_user') || 'null');

function logout() {
    localStorage.removeItem('ai_food_user');
    window.location.href = 'login.html';
}

function checkAuth(allowedRoles) {
    if (!user) {
        window.location.href = 'login.html';
        return;
    }
    if (allowedRoles && !allowedRoles.includes(user.role)) {
        alert('Access denied!');
        window.location.href = 'home.html';
    }
}
