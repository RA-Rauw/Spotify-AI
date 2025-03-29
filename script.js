// Configuración de la API Spotify
const SPOTIFY_CLIENT_ID = 'TU_CLIENT_ID'; // Reemplaza con tu Client ID
const SPOTIFY_REDIRECT_URI = window.location.href.includes('localhost') 
    ? 'http://localhost:8000/' 
    : 'TU_URL_PRODUCCION/';
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
const openSpotifyBtn = document.getElementById('openSpotifyBtn');
const newPlaylistBtn = document.getElementById('newPlaylistBtn');
const playlistResult = document.getElementById('playlistResult');
const actionButtons = document.getElementById('actionButtons');

// Variables globales
let accessToken = null;
let userId = null;
let currentPlaylistUrl = null;

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
            alert('Tu sesión ha expirado. Por favor inicia sesión nuevamente.');
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

// 4. Generar playlist
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
        
        // Paso 1: Obtener recomendaciones
        const recommendations = await getRecommendations(songCount, genre);
        
        // Paso 2: Crear playlist
        const playlist = await createPlaylist(playlistName);
        
        // Paso 3: Añadir canciones
        await addTracksToPlaylist(playlist.id, recommendations.tracks);
        
        // Mostrar resultado
        currentPlaylistUrl = playlist.external_urls.spotify;
        playlistResult.innerHTML = `
            <div class="success-message">
                <h3>¡Playlist creada con éxito!</h3>
                <p>${playlistName} con ${recommendations.tracks.length} canciones</p>
            </div>
        `;
        actionButtons.style.display = 'flex';
        
    } catch (error) {
        console.error('Error al generar playlist:', error);
        showError('Error al generar la playlist. Intenta nuevamente.');
    }
});

// 5. Botones de acción
openSpotifyBtn.addEventListener('click', () => {
    if (currentPlaylistUrl) {
        window.open(currentPlaylistUrl, '_blank');
    }
});

newPlaylistBtn.addEventListener('click', () => {
    playlistResult.innerHTML = '';
    actionButtons.style.display = 'none';
    document.getElementById('playlistName').value = '';
});

// Funciones de la API Spotify
async function spotifyApiRequest(url, method = 'GET', data = null) {
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
}

async function getRecommendations(limit, genre) {
    let url = `https://api.spotify.com/v1/recommendations?limit=${limit}`;
    
    // Añadir filtro de género si no es "any"
    if (genre !== 'any') {
        // Primero obtenemos artistas semilla del género seleccionado
        const artists = await spotifyApiRequest(`https://api.spotify.com/v1/search?q=genre:${genre}&type=artist&limit=5`);
        if (artists.artists.items.length > 0) {
            const seedArtists = artists.artists.items.map(a => a.id).join(',');
            url += `&seed_artists=${seedArtists}`;
        }
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
    loginSection.style.display = 'block';
    appContent.style.display = 'none';
    playlistResult.innerHTML = '';
    actionButtons.style.display = 'none';
}