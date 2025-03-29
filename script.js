// Configuración de la API Spotify
const SPOTIFY_CLIENT_ID = '969753f2997a48a2afb69649a4f3b800'; // Reemplaza con tu Client ID
const SPOTIFY_REDIRECT_URI = window.location.href.includes('localhost') 
    ? 'http://localhost:8000/' 
    : 'https://ra-rauw.github.io/Spotify-AI/';
const SPOTIFY_SCOPES = [
    'playlist-modify-public',
    'playlist-modify-private',
    'user-top-read',
    'user-library-read'
].join(' ');

// Elementos del DOM
const loginBtn = document.getElementById('loginBtn');
const loginSection = document.getElementById('login-section');
const appContent = document.getElementById('app-content');
const generateBtn = document.getElementById('generateBtn');
const confirmBtn = document.getElementById('confirmBtn');
const openSpotifyBtn = document.getElementById('openSpotifyBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const playlistResult = document.getElementById('playlistResult');
const actionButtons = document.getElementById('actionButtons');

// Variables globales
let accessToken = null;
let userId = null;
let currentPlaylistUrl = null;
let recommendedTracks = [];

// 1. Autenticación con Spotify
loginBtn.addEventListener('click', () => {
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${SPOTIFY_CLIENT_ID}&redirect_uri=${encodeURIComponent(SPOTIFY_REDIRECT_URI)}&scope=${encodeURIComponent(SPOTIFY_SCOPES)}&response_type=token&show_dialog=true`;
    window.location.href = authUrl;
});

// 2. Manejar la respuesta de autenticación
window.addEventListener('load', () => {
    const hash = window.location.hash.substring(1);
    const params = new URLSearchParams(hash);

    if (params.has('access_token')) {
        accessToken = params.get('access_token');
        const expiresIn = params.get('expires_in');
        
        // Limpiar el hash de la URL
        window.history.pushState({}, document.title, window.location.pathname);
        
        // Iniciar sesión
        initializeApp();
        
        // Configurar logout automático cuando expire el token
        setTimeout(() => {
            showError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            logout();
        }, expiresIn * 1000);
    }
});

// 3. Inicializar la aplicación
async function initializeApp() {
    try {
        loginSection.style.display = 'none';
        appContent.style.display = 'block';
        
        // Obtener información del usuario
        const response = await spotifyApiRequest('https://api.spotify.com/v1/me');
        userId = response.id;
        
        // Mostrar nombre de usuario
        const welcome = document.createElement('p');
        welcome.textContent = `Hola, ${response.display_name || 'Usuario'}`;
        welcome.style.textAlign = 'center';
        welcome.style.marginBottom = '20px';
        welcome.style.fontWeight = '600';
        appContent.insertBefore(welcome, appContent.firstChild);
        
    } catch (error) {
        console.error('Error al inicializar:', error);
        showError('Error al conectar con Spotify');
    }
}

// 4. Generar recomendaciones (preview)
generateBtn.addEventListener('click', async () => {
    if (!accessToken) return;
    
    const playlistName = document.getElementById('playlistName').value || 'Mi Playlist Generada';
    const songCount = document.getElementById('songCount').value;
    const genre = document.getElementById('genre').value;
    
    try {
        // Mostrar estado de carga
        playlistResult.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <p>Generando tu playlist...</p>
            </div>
        `;
        actionButtons.style.display = 'none';
        
        // Obtener recomendaciones
        const recommendations = await getRecommendations(songCount, genre);
        recommendedTracks = recommendations.tracks;
        
        // Mostrar vista previa
        displayTrackPreview(recommendedTracks);
        
        // Mostrar botón de confirmación
        confirmBtn.style.display = 'inline-flex';
        openSpotifyBtn.style.display = 'none';
        actionButtons.style.display = 'flex';
        
    } catch (error) {
        console.error('Error al generar playlist:', error);
        showError('Error al generar la playlist. Intenta nuevamente.');
    }
});

// 5. Confirmar creación de playlist
confirmBtn.addEventListener('click', async () => {
    if (!recommendedTracks.length) return;
    
    const playlistName = document.getElementById('playlistName').value || 'Mi Playlist Generada';
    
    try {
        playlistResult.innerHTML = `
            <div class="loading">
                <i class="fas fa-spinner"></i>
                <p>Creando tu playlist en Spotify...</p>
            </div>
        `;
        
        // Crear playlist
        const playlist = await createPlaylist(playlistName);
        
        // Añadir canciones
        await addTracksToPlaylist(playlist.id, recommendedTracks);
        
        // Mostrar resultado
        currentPlaylistUrl = playlist.external_urls.spotify;
        playlistResult.innerHTML = `
            <div class="success-message">
                <h3>¡Playlist creada con éxito!</h3>
                <p>${playlistName} con ${recommendedTracks.length} canciones</p>
            </div>
        `;
        
        // Actualizar botones
        confirmBtn.style.display = 'none';
        openSpotifyBtn.style.display = 'inline-flex';
        
    } catch (error) {
        console.error('Error al confirmar playlist:', error);
        showError('Error al crear la playlist en Spotify');
    }
});

// 6. Botones de acción
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

// Funciones de la API Spotify
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
        
        if (data) {
            config.data = data;
        }
        
        const response = await axios(config);
        return response.data;
    } catch (error) {
        if (error.response?.status === 401) {
            showError('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
            logout();
        }
        throw error;
    }
}

async function getRecommendations(limit, genre) {
    let url = `https://api.spotify.com/v1/recommendations?limit=${limit}`;
    
    // Semillas por defecto (top tracks del usuario)
    let seedTracks = '';
    try {
        const topTracks = await spotifyApiRequest(
            `https://api.spotify.com/v1/me/top/tracks?limit=5`
        );
        seedTracks = topTracks.items.map(t => t.id).join(',');
    } catch (e) {
        console.log("No se pudieron obtener top tracks", e);
    }

    // Si hay género, priorizar artistas de ese género
    if (genre !== 'any') {
        const artists = await spotifyApiRequest(
            `https://api.spotify.com/v1/search?q=genre:${genre}&type=artist&limit=5`
        );
        if (artists.artists.items.length > 0) {
            url += `&seed_artists=${artists.artists.items.map(a => a.id).join(',')}`;
        } else if (seedTracks) {
            url += `&seed_tracks=${seedTracks}`;
        }
    } else if (seedTracks) {
        url += `&seed_tracks=${seedTracks}`;
    }

    return await spotifyApiRequest(url);
}

async function createPlaylist(name) {
    return await spotifyApiRequest(
        `https://api.spotify.com/v1/users/${userId}/playlists`,
        'POST',
        {
            name: name,
            description: 'Playlist generada automáticamente con Spotify API',
            public: true
        }
    );
}

async function addTracksToPlaylist(playlistId, tracks) {
    const trackUris = tracks.map(track => track.uri);
    await spotifyApiRequest(
        `https://api.spotify.com/v1/playlists/${playlistId}/tracks`,
        'POST',
        {
            uris: trackUris
        }
    );
}

// Funciones auxiliares
function displayTrackPreview(tracks) {
    let html = `
        <div class="track-list">
            <h3>Vista previa de tu playlist</h3>
            <p>Revisa las canciones antes de crear:</p>
            <ul>
    `;
    
    tracks.forEach(track => {
        html += `
            <li>
                <img src="${track.album.images.find(img => img.height === 64)?.url || track.album.images[0]?.url}" 
                     alt="${track.name}">
                <div class="track-info">
                    <div class="track-name">${track.name}</div>
                    <div class="track-artist">${track.artists.map(a => a.name).join(', ')}</div>
                </div>
            </li>
        `;
    });
    
    html += `
            </ul>
            <div class="confirm-section">
                <p>¿Listo para crear esta playlist en tu cuenta de Spotify?</p>
            </div>
        </div>
    `;
    
    playlistResult.innerHTML = html;
}

function showError(message) {
    playlistResult.innerHTML = `
        <div class="error-message">
            <p>${message}</p>
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
    playlistResult.innerHTML = '';
    actionButtons.style.display = 'none';
}
