// Spotify API Configuration - SECURE VERSION
const SPOTIFY_CLIENT_ID = '969753f2997a48a2afb69649a4f3b800'; // Replace with your actual Client ID
const SPOTIFY_REDIRECT_URI = 'https://ra-rauw.github.io/Spotify-AI/';
const SPOTIFY_SCOPES = [
    'playlist-modify-public',
    'playlist-modify-private',
    'user-top-read',
    'user-library-read',
    'user-read-private'
].join(' ');

// DOM Elements
const loginBtn = document.getElementById('loginBtn');
const loginSection = document.getElementById('login-section');
const appContent = document.getElementById('app-content');
const generateBtn = document.getElementById('generateBtn');
const confirmBtn = document.getElementById('confirmBtn');
const openSpotifyBtn = document.getElementById('openSpotifyBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const playlistResult = document.getElementById('playlistResult');
const actionButtons = document.getElementById('actionButtons');

// Global Variables
let accessToken = null;
let userId = null;
let currentPlaylistUrl = null;
let recommendedTracks = [];

// 1. Authentication
loginBtn.addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
});

// 2. Handle Authentication Response
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.has('access_token')) {
        accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');
        
        window.history.replaceState({}, document.title, window.location.pathname);
        initializeApp();
        
        setTimeout(() => {
            showError('Session expired. Please login again.');
            logout();
        }, expiresIn * 1000);
    }
});

// 3. Initialize App
async function initializeApp() {
    try {
        loginSection.style.display = 'none';
        appContent.style.display = 'block';
        
        const response = await spotifyApiRequest('https://api.spotify.com/v1/me');
        userId = response.id;
        
        const welcome = document.createElement('p');
        welcome.textContent = `Welcome, ${response.display_name || 'User'}`;
        welcome.style.textAlign = 'center';
        welcome.style.marginBottom = '20px';
        welcome.style.fontWeight = '600';
        appContent.insertBefore(welcome, appContent.firstChild);
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Failed to connect to Spotify');
    }
}

// 4. Generate Recommendations
generateBtn.addEventListener('click', async () => {
    if (!accessToken) {
        showError('Please login with Spotify first');
        return;
    }
    
    const playlistName = document.getElementById('playlistName').value || 'My Generated Playlist';
    const songCount = document.getElementById('songCount').value;
    const genre = document.getElementById('genre').value;
    
    try {
        showLoading();
        
        // Get recommendations with fallback seeds
        const recommendations = await getRecommendations(songCount, genre);
        recommendedTracks = recommendations.tracks;
        
        if (!recommendedTracks?.length) {
            throw new Error('No tracks found for these filters');
        }
        
        displayTrackPreview(recommendedTracks);
        toggleButtons(true);
        
    } catch (error) {
        console.error('Generation error:', error);
        showError(error.message || 'Failed to generate playlist. Try another genre.');
    }
});

// 5. Confirm Playlist Creation
confirmBtn.addEventListener('click', async () => {
    if (!recommendedTracks.length) return;
    
    const playlistName = document.getElementById('playlistName').value || 'My Generated Playlist';
    
    try {
        showLoading('Creating playlist on Spotify...');
        
        const playlist = await createPlaylist(playlistName);
        await addTracksToPlaylist(playlist.id, recommendedTracks);
        
        currentPlaylistUrl = playlist.external_urls.spotify;
        showSuccess(playlistName, recommendedTracks.length);
        toggleButtons(false, true);
        
    } catch (error) {
        console.error('Creation error:', error);
        showError('Failed to create playlist. Please try again.');
    }
});

// Helper Functions
async function getRecommendations(limit, genre) {
    let url = `https://api.spotify.com/v1/recommendations?limit=${limit}&market=ES`;
    
    // Try user's top tracks first
    try {
        const topTracks = await spotifyApiRequest('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term');
        if (topTracks.items.length > 0) {
            url += `&seed_tracks=${topTracks.items.slice(0, 3).map(t => t.id).join(',')}`;
        }
    } catch (e) {
        console.log("Using fallback seeds");
        url += '&seed_tracks=7GhIk7Il098yCjg4BQjzvb,0c6xIDDpzE81m2q797ordA';
    }

    // Add genre if specified
    if (genre !== 'any') {
        try {
            const artists = await spotifyApiRequest(`https://api.spotify.com/v1/search?q=genre:${genre}&type=artist&limit=3`);
            if (artists.artists.items.length > 0) {
                url += `&seed_artists=${artists.artists.items.slice(0, 2).map(a => a.id).join(',')}`;
            }
        } catch (e) {
            console.log("Couldn't find genre artists");
        }
    }

    return spotifyApiRequest(url);
}

async function createPlaylist(name) {
    return spotifyApiRequest(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        'POST',
        {
            name: name,
            description: 'Auto-generated playlist via Spotify API',
            public: false // Private by default
        }
    );
}

async function addTracksToPlaylist(playlistId, tracks) {
    return spotifyApiRequest(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        'POST',
        {
            uris: tracks.slice(0, 100).map(track => track.uri) // Spotify limits to 100 tracks
        }
    );
}

// UI Functions
function showLoading(message = 'Generating your playlist...') {
    playlistResult.innerHTML = `
        <div class="loading">
            <i class="fas fa-spinner"></i>
            <p>${message}</p>
        </div>
    `;
    actionButtons.style.display = 'none';
}

function showSuccess(name, count) {
    playlistResult.innerHTML = `
        <div class="success-message">
            <h3>Playlist created successfully!</h3>
            <p>${name} with ${count} tracks</p>
        </div>
    `;
}

function displayTrackPreview(tracks) {
    playlistResult.innerHTML = `
        <div class="track-list">
            <h3>Playlist Preview</h3>
            <ul>
                ${tracks.slice(0, 10).map(track => `
                <li>
                    <img src="${track.album.images.find(img => img.height === 64)?.url || track.album.images[0]?.url || 'https://via.placeholder.com/50'}" 
                         alt="${track.name}">
                    <div class="track-info">
                        <div class="track-name">${track.name}</div>
                        <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
                    </div>
                </li>
                `).join('')}
            </ul>
        </div>
    `;
}

function toggleButtons(showConfirm, showOpen = false) {
    confirmBtn.style.display = showConfirm ? 'inline-flex' : 'none';
    openSpotifyBtn.style.display = showOpen ? 'inline-flex' : 'none';
    actionButtons.style.display = 'flex';
}

function showError(message) {
    playlistResult.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button onclick="window.location.reload()" class="secondary-btn">
                <i class="fas fa-sync-alt"></i> Reload
            </button>
        </div>
    `;
}

function logout() {
    accessToken = null;
    userId = null;
    currentPlaylistUrl = null;
    recommendedTracks = [];
    loginSection.style.display = 'block';
    appContent.style.display = 'none';
}

// API Request Handler
async function spotifyApiRequest(url, method = 'GET', data = null) {
    try {
        const config = {
            method,
            url,
            headers: {
                'Authorization': `Bearer ${accessToken}`,
                'Content-Type': 'application/json'
            }
        };
        
        if (data) config.data = data;
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        console.error("API Error:", {
            url,
            status: error.response?.status,
            error: error.response?.data?.error || error.message
        });
        
        if (error.response?.status === 401) {
            showError('Session expired. Please login again.');
            logout();
        }
        
        throw new Error(error.response?.data?.error?.message || "Spotify API request failed");
    }
}

// Event Listeners
openSpotifyBtn.addEventListener('click', () => {
    if (currentPlaylistUrl) {
        window.open(currentPlaylistUrl, '_blank');
    }
});

newPlaylistBtn.addEventListener('click', () => {
    playlistResult.innerHTML = '';
    actionButtons.style.display = 'none';
    document.getElementById('playlistName').value = '';
    recommendedTracks = [];
});
