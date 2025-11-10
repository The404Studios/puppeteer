/**
 * AuthManager.js
 * Handles authentication tokens, storage (localStorage), and attaching to headers
 */

class AuthManager {
    /**
     * Creates an authentication manager
     * @param {Object} options - Configuration options
     * @param {string} options.storageKey - LocalStorage key for token (default: 'puppeteer_auth_token')
     * @param {string} options.storageType - Storage type: 'localStorage', 'sessionStorage', or 'memory' (default: 'localStorage')
     * @param {string} options.tokenType - Token type prefix (default: 'Bearer')
     * @param {number} options.tokenExpiryBuffer - Buffer time before expiry in ms (default: 60000)
     */
    constructor(options = {}) {
        this.storageKey = options.storageKey || 'puppeteer_auth_token';
        this.storageType = options.storageType || 'localStorage';
        this.tokenType = options.tokenType || 'Bearer';
        this.tokenExpiryBuffer = options.tokenExpiryBuffer || 60000; // 1 minute

        this.token = null;
        this.tokenExpiry = null;
        this.refreshToken = null;
        this.userData = null;
        this.memoryStorage = {}; // Fallback for environments without localStorage

        this.onTokenRefreshCallback = null;
        this.onTokenExpiredCallback = null;

        // Load token from storage on init
        this._loadFromStorage();
    }

    /**
     * Sets the authentication token
     * @param {string} token - Auth token
     * @param {Object} options - Additional options
     * @param {number} options.expiresIn - Token expiry time in seconds
     * @param {string} options.refreshToken - Refresh token
     * @param {Object} options.userData - User data associated with token
     */
    setToken(token, options = {}) {
        this.token = token;
        this.refreshToken = options.refreshToken || null;
        this.userData = options.userData || null;

        // Calculate expiry time
        if (options.expiresIn) {
            this.tokenExpiry = Date.now() + (options.expiresIn * 1000);
        } else {
            this.tokenExpiry = null;
        }

        // Save to storage
        this._saveToStorage();
    }

    /**
     * Gets the current authentication token
     * @returns {string|null} Auth token or null
     */
    getToken() {
        // Check if token is expired
        if (this.isTokenExpired()) {
            return null;
        }

        return this.token;
    }

    /**
     * Gets the refresh token
     * @returns {string|null} Refresh token or null
     */
    getRefreshToken() {
        return this.refreshToken;
    }

    /**
     * Gets user data
     * @returns {Object|null} User data or null
     */
    getUserData() {
        return this.userData;
    }

    /**
     * Checks if a token is currently set and valid
     * @returns {boolean} True if authenticated
     */
    isAuthenticated() {
        return this.token !== null && !this.isTokenExpired();
    }

    /**
     * Checks if the token is expired
     * @returns {boolean} True if expired
     */
    isTokenExpired() {
        if (!this.token || !this.tokenExpiry) {
            return false; // No expiry set
        }

        return Date.now() >= this.tokenExpiry;
    }

    /**
     * Checks if token is about to expire (within buffer time)
     * @returns {boolean} True if about to expire
     */
    isTokenAboutToExpire() {
        if (!this.token || !this.tokenExpiry) {
            return false;
        }

        return Date.now() >= (this.tokenExpiry - this.tokenExpiryBuffer);
    }

    /**
     * Gets the authorization header value
     * @returns {string|null} Header value or null
     */
    getAuthHeader() {
        const token = this.getToken();
        if (!token) {
            return null;
        }

        return `${this.tokenType} ${token}`;
    }

    /**
     * Gets headers object with authorization
     * @param {Object} additionalHeaders - Additional headers to include
     * @returns {Object} Headers object
     */
    getHeaders(additionalHeaders = {}) {
        const headers = { ...additionalHeaders };

        const authHeader = this.getAuthHeader();
        if (authHeader) {
            headers['Authorization'] = authHeader;
        }

        return headers;
    }

    /**
     * Attaches auth header to a fetch request options object
     * @param {Object} fetchOptions - Fetch options
     * @returns {Object} Modified fetch options
     */
    attachToFetchOptions(fetchOptions = {}) {
        const authHeader = this.getAuthHeader();

        if (authHeader) {
            fetchOptions.headers = fetchOptions.headers || {};
            fetchOptions.headers['Authorization'] = authHeader;
        }

        return fetchOptions;
    }

    /**
     * Attaches auth to a WebSocket URL as a query parameter
     * @param {string} url - WebSocket URL
     * @returns {string} Modified URL with token
     */
    attachToWebSocketURL(url) {
        const token = this.getToken();
        if (!token) {
            return url;
        }

        const separator = url.includes('?') ? '&' : '?';
        return `${url}${separator}token=${encodeURIComponent(token)}`;
    }

    /**
     * Clears the authentication token
     */
    clearToken() {
        this.token = null;
        this.tokenExpiry = null;
        this.refreshToken = null;
        this.userData = null;

        this._clearStorage();
    }

    /**
     * Attempts to refresh the token using the refresh token
     * @param {Function} refreshFunction - Async function to refresh token
     * @returns {Promise<boolean>} True if refresh succeeded
     */
    async refreshTokenIfNeeded(refreshFunction) {
        if (!this.isTokenAboutToExpire()) {
            return true; // Token is still valid
        }

        if (!this.refreshToken) {
            console.warn('No refresh token available');
            if (this.onTokenExpiredCallback) {
                this.onTokenExpiredCallback();
            }
            return false;
        }

        try {
            const result = await refreshFunction(this.refreshToken);

            if (result && result.token) {
                this.setToken(result.token, {
                    expiresIn: result.expiresIn,
                    refreshToken: result.refreshToken || this.refreshToken,
                    userData: result.userData || this.userData
                });

                if (this.onTokenRefreshCallback) {
                    this.onTokenRefreshCallback(result.token);
                }

                return true;
            }

            return false;
        } catch (error) {
            console.error('Token refresh failed:', error);

            if (this.onTokenExpiredCallback) {
                this.onTokenExpiredCallback();
            }

            return false;
        }
    }

    /**
     * Saves token to storage
     * @private
     */
    _saveToStorage() {
        const data = {
            token: this.token,
            tokenExpiry: this.tokenExpiry,
            refreshToken: this.refreshToken,
            userData: this.userData
        };

        const serialized = JSON.stringify(data);

        try {
            if (this.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
                localStorage.setItem(this.storageKey, serialized);
            } else if (this.storageType === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
                sessionStorage.setItem(this.storageKey, serialized);
            } else {
                // Fallback to memory
                this.memoryStorage[this.storageKey] = serialized;
            }
        } catch (error) {
            console.error('Failed to save token to storage:', error);
        }
    }

    /**
     * Loads token from storage
     * @private
     */
    _loadFromStorage() {
        try {
            let serialized = null;

            if (this.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
                serialized = localStorage.getItem(this.storageKey);
            } else if (this.storageType === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
                serialized = sessionStorage.getItem(this.storageKey);
            } else {
                // Fallback to memory
                serialized = this.memoryStorage[this.storageKey];
            }

            if (serialized) {
                const data = JSON.parse(serialized);
                this.token = data.token;
                this.tokenExpiry = data.tokenExpiry;
                this.refreshToken = data.refreshToken;
                this.userData = data.userData;

                // Check if loaded token is expired
                if (this.isTokenExpired()) {
                    console.warn('Loaded token is expired');
                    this.clearToken();
                }
            }
        } catch (error) {
            console.error('Failed to load token from storage:', error);
        }
    }

    /**
     * Clears token from storage
     * @private
     */
    _clearStorage() {
        try {
            if (this.storageType === 'localStorage' && typeof localStorage !== 'undefined') {
                localStorage.removeItem(this.storageKey);
            } else if (this.storageType === 'sessionStorage' && typeof sessionStorage !== 'undefined') {
                sessionStorage.removeItem(this.storageKey);
            } else {
                delete this.memoryStorage[this.storageKey];
            }
        } catch (error) {
            console.error('Failed to clear token from storage:', error);
        }
    }

    /**
     * Sets callback for token refresh
     * @param {Function} callback - Callback function
     */
    onTokenRefresh(callback) {
        this.onTokenRefreshCallback = callback;
    }

    /**
     * Sets callback for token expiration
     * @param {Function} callback - Callback function
     */
    onTokenExpired(callback) {
        this.onTokenExpiredCallback = callback;
    }

    /**
     * Gets time until token expiry
     * @returns {number|null} Milliseconds until expiry, or null
     */
    getTimeUntilExpiry() {
        if (!this.tokenExpiry) {
            return null;
        }

        return Math.max(0, this.tokenExpiry - Date.now());
    }
}

// Export for different module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthManager;
}
