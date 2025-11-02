
import { initializeApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider } from 'firebase/auth';
import { getFunctions, httpsCallable } from 'firebase/functions';

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
const functions = getFunctions(app, 'us-central1');
const googleProvider = new GoogleAuthProvider();

// Callable Functions
const getCharacterLibrary = httpsCallable(functions, 'getCharacterLibrary');
const createCharacterPair = httpsCallable(functions, 'createCharacterPair');
const generateCharacterVisualization = httpsCallable(functions, 'generateCharacterVisualization');


export { 
  auth, 
  googleProvider,
  getCharacterLibrary,
  createCharacterPair,
  generateCharacterVisualization
};
