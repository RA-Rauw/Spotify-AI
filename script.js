// Spotify API Configuration
const SPOTIFY_CLIENT_ID = 'TU_CLIENT_ID'; // ¡Reemplaza esto!
const SPOTIFY_REDIRECT_URI = 'https://ra-rauw.github.io/Spotify-AI/';
const SPOTIFY_SCOPES = [
    'playlist-modify-public',
    'user-top-read',
    'user-library-read'
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

// State Management
let accessToken = null;
let userId = null;
let currentPlaylistUrl = null;
let recommendedTracks = [];

// 1. Authentication Flow
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
        
        // Clean URL
        window.history.replaceState({}, document.title, window.location.pathname);
        
        initializeApp();
        
        // Auto-logout when token expires
        setTimeout(() => {
            showError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            logout();
        }, expiresIn * 1000);
    }
});

// 3. App Initialization
async function initializeApp() {
    try {
        loginSection.style.display = 'none';
        appContent.style.display = 'block';
        
        const userData = await spotifyApiRequest('https://api.spotify.com/v1/me');
        userId = userData.id;
        
        displayWelcomeMessage(userData.display_name || 'Usuario');
        
    } catch (error) {
        console.error('Initialization error:', error);
        showError('Error al conectar con Spotify');
    }
}

// 4. Recommendation Generation
generateBtn.addEventListener('click', async () => {
    if (!accessToken) {
        showError('Por favor inicia sesión primero');
        return;
    }
    
    const playlistName = document.getElementById('playlistName').value || 'Mi Playlist';
    const songCount = parseInt(document.getElementById('songCount').value) || 20;
    const genre = document.getElementById('genre').value;
    
    try {
        showLoading('Generando tu playlist...');
        
        const recommendations = await getRecommendations(songCount, genre);
        recommendedTracks = recommendations.tracks;
        
        if (!recommendedTracks?.length) {
            throw new Error('No se encontraron canciones con estos filtros');
        }
        
        displayTrackPreview(recommendedTracks);
        toggleButtons(true);
        
    } catch (error) {
        console.error('Generation error:', error);
        showError(error.message || 'Error al generar. Intenta con otro género.');
    }
});

// 5. Playlist Creation
confirmBtn.addEventListener('click', async () => {
    if (!recommendedTracks.length) return;
    
    const playlistName = document.getElementById('playlistName').value || 'Mi Playlist';
    
    try {
        showLoading('Creando playlist en Spotify...');
        
        const playlist = await createPlaylist(playlistName);
        await addTracksToPlaylist(playlist.id, recommendedTracks);
        
        currentPlaylistUrl = playlist.external_urls.spotify;
        showSuccess(playlistName, recommendedTracks.length);
        toggleButtons(false, true);
        
    } catch (error) {
        console.error('Creation error:', error);
        showError('Error al crear la playlist');
    }
});

// Core Functions
async function getRecommendations(limit, genre) {
    // Validate parameters
    limit = Math.min(Math.max(limit, 5), 100); // Force between 5-100
    
    let url = `https://api.spotify.com/v1/recommendations?limit=${limit}&market=ES`;
    
    // 1. Get seed tracks (user's top tracks or fallback)
    try {
        const topTracks = await spotifyApiRequest('https://api.spotify.com/v1/me/top/tracks?limit=5&time_range=short_term');
        if (topTracks.items.length > 0) {
            url += `&seed_tracks=${topTracks.items[0].id}`;
        } else {
            // Fallback seeds (global hits)
            url += '&seed_tracks=7GhIk7Il098yCjg4BQjzvb,0c6xIDDpzE81m2q797ordA';
        }
    } catch (error) {
        console.error('Failed to get top tracks:', error);
        url += '&seed_tracks=5CeL9C3bsoe4yzYS1Qz8cw'; // Additional fallback
    }

    // 2. Add genre if specified
    if (genre !== 'any') {
        try {
            const artists = await spotifyApiRequest(`https://api.spotify.com/v1/search?q=genre:${genre}&type=artist&limit=1`);
            if (artists.artists.items.length > 0) {
                url += `&seed_artists=${artists.artists.items[0].id}`;
            }
        } catch (error) {
            console.error('Failed to get genre artists:', error);
        }
    }

    console.log('Final recommendations URL:', url); // Debug
    return spotifyApiRequest(url);
}

async function createPlaylist(name) {
    return spotifyApiRequest(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        'POST',
        {
            name: name,
            description: 'Creada con Spotify API',
            public: false
        }
    );
}

async function addTracksToPlaylist(playlistId, tracks) {
    return spotifyApiRequest(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        'POST',
        {
            uris: tracks.map(track => track.uri).slice(0, 100) // Spotify limit
        }
    );
}

// UI Functions
function displayWelcomeMessage(name) {
    const welcome = document.createElement('p');
    welcome.textContent = `Hola, ${name}`;
    welcome.style.textAlign = 'center';
    welcome.style.marginBottom = '20px';
    welcome.style.fontWeight = '600';
    appContent.insertBefore(welcome, appContent.firstChild);
}

function showLoading(message) {
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
            <h3>¡Playlist creada!</h3>
            <p>${name} con ${count} canciones</p>
        </div>
    `;
}

function displayTrackPreview(tracks) {
    playlistResult.innerHTML = `
        <div class="track-list">
            <h3>Vista previa</h3>
            <ul>
                ${tracks.slice(0, 10).map(track => `
                <li>
                    <img src="${track.album.images.find(img => img.height === 64)?.url || track.album.images[0]?.url}" 
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
    confirmBtn.style.display = showConfirm ? 'flex' : 'none';
    openSpotifyBtn.style.display = showOpen ? 'flex' : 'none';
    actionButtons.style.display = 'flex';
}

function showError(message) {
    playlistResult.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
            <button onclick="window.location.reload()" class="secondary-btn">
                <i class="fas fa-sync-alt"></i> Reintentar
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
        console.error('API Error:', {
            url,
            status: error.response?.status,
            error: error.response?.data?.error || error.message
        });
        
        if (error.response?.status === 401) {
            showError('Sesión expirada. Por favor inicia sesión nuevamente.');
            logout();
        } else if (error.response?.status === 404) {
            throw new Error('No se encontraron resultados. Prueba con otros parámetros.');
        }
        
        throw new Error(error.response?.data?.error?.message || 'Error en la API de Spotify');
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
