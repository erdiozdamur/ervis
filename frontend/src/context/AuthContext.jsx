import React, { createContext, useState, useContext, useEffect } from 'react';
import axios from 'axios';

const AuthContext = createContext(null);
const NOT_FOUND_RETRY_COUNT_KEY = '__ervisNotFoundRetryCount';
const MAX_NOT_FOUND_RETRIES = 2;

const shouldRetryNotFound = (error) => {
    const status = error?.response?.status;
    const detail = error?.response?.data?.detail;
    const config = error?.config;
    const url = config?.url || '';
    const retryCount = config?.[NOT_FOUND_RETRY_COUNT_KEY] || 0;

    if (!config || status !== 404) return false;
    if (!url.startsWith('/api/')) return false;
    if (retryCount >= MAX_NOT_FOUND_RETRIES) return false;
    if (detail && detail !== 'Not Found') return false;

    return true;
};

const withRetryBuster = (url) => {
    const joiner = url.includes('?') ? '&' : '?';
    return `${url}${joiner}_r=${Date.now()}`;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const storedToken = localStorage.getItem('token');
        const storedUser = localStorage.getItem('user');
        if (storedToken && storedUser) {
            const userData = JSON.parse(storedUser);
            setUser(userData);
            axios.defaults.headers.common['Authorization'] = `Bearer ${storedToken}`;
        }
        setLoading(false);
    }, []);

    const login = async (email, password) => {
        const formData = new FormData();
        formData.append('username', email);
        formData.append('password', password);

        try {
            const response = await axios.post('/api/auth/login', formData);
            const { access_token, user_id, username } = response.data;
            
            const userData = { user_id, username, email };
            setUser(userData);
            localStorage.setItem('token', access_token);
            localStorage.setItem('user', JSON.stringify(userData));
            axios.defaults.headers.common['Authorization'] = `Bearer ${access_token}`;
            return { success: true };
        } catch (error) {
            console.error('Login error:', error);
            return { success: false, message: error.response?.data?.detail || 'Giriş yapılamadı' };
        }
    };

    const register = async (username, email, password) => {
        try {
            await axios.post('/api/auth/register', {
                username,
                email,
                password
            });
            return { success: true };
        } catch (error) {
            console.error('Registration error:', error);
            return { success: false, message: error.response?.data?.detail || 'Kayıt olunamadı' };
        }
    };

    const logout = () => {
        setUser(null);
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        delete axios.defaults.headers.common['Authorization'];
    };

    // Global Axios interceptor for 401 handling
    useEffect(() => {
        const interceptor = axios.interceptors.response.use(
            (response) => response,
            async (error) => {
                if (shouldRetryNotFound(error)) {
                    const retryCount = error.config?.[NOT_FOUND_RETRY_COUNT_KEY] || 0;
                    const retryConfig = {
                        ...error.config,
                        [NOT_FOUND_RETRY_COUNT_KEY]: retryCount + 1,
                        url: withRetryBuster(error.config.url),
                        headers: {
                            ...(error.config.headers || {}),
                            'x-ervis-retry': '1',
                        },
                    };
                    await new Promise((resolve) => setTimeout(resolve, 220));
                    return axios.request(retryConfig);
                }

                if (error.response?.status === 401) {
                    console.warn('Session expired or unauthorized. Logging out...');
                    logout();
                }
                return Promise.reject(error);
            }
        );

        return () => {
            axios.interceptors.response.eject(interceptor);
        };
    }, []);

    return (
        <AuthContext.Provider value={{ user, login, register, logout, loading }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => useContext(AuthContext);
