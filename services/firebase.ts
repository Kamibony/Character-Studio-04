import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, browserLocalPersistence, setPersistence } from 'firebase/auth';

const firebaseConfig = {
  apiKey: "AIzaSyARuwcn4hMmt7MD5tTTp_r2HVqSu8Zno20",
  authDomain: "character-studio-comics.firebaseapp.com",
  projectId: "character-studio-comics",
  storageBucket: "character-studio-comics.appspot.com",
  messagingSenderId: "673014807195",
  appId: "1:673014807195:web:979046c375fe0b7e26e43e",
  measurementId: "G-4BT7DFW596"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const googleProvider = new GoogleAuthProvider();

// Explicitly set persistence to localStorage.
setPersistence(auth, browserLocalPersistence)
  .catch((error) => {
    console.error("Firebase Persistence Error: Could not set persistence.", error);
  });

// The backend URL will be relative, assuming App Hosting proxies it.
const API_BASE_URL = ''; 

const callApi = async (endpoint: string, body: object = {}) => {
    const user = auth.currentUser;
    if (!user) {
        throw new Error("User not authenticated.");
    }
    
    const token = await user.getIdToken();
    const response = await fetch(`${API_BASE_URL}/${endpoint}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const errorData = await response.json().catch(() => ({ error: 'An unknown error occurred' }));
        const error: any = new Error(errorData.error || response.statusText);
        error.code = response.status;
        throw error;
    }
    
    return await response.json();
}

// Re-implement the callable function interfaces using our new fetch helper
export const getCharacterLibrary = async () => {
    const data = await callApi('getCharacterLibrary');
    return { data }; // Wrap in `data` to match HttpsCallableResult
};

export const getCharacterById = async (requestData: { characterId: string }) => {
    const data = await callApi('getCharacterById', requestData);
    return { data };
};

export const createCharacterPair = async (requestData: {
  charABase64: string,
  charAMimeType: string,
  charBBase64: string,
  charBMimeType: string
}) => {
    const data = await callApi('createCharacterPair', requestData);
    return { data };
};

export const generateCharacterVisualization = async (requestData: { characterId: string; prompt: string }) => {
    const data = await callApi('generateCharacterVisualization', requestData);
    return { data };
};

export { 
  auth, 
  googleProvider,
};