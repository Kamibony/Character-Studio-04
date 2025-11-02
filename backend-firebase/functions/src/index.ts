// FIX: Combined express import to resolve type errors.
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import admin from "firebase-admin";
import { GoogleGenAI, Modality, GenerateContentResponse } from "@google/genai";

// FIX: Extend Express Request type to include user object from auth middleware.
declare global {
    namespace Express {
        interface Request {
            user?: admin.auth.DecodedIdToken;
        }
    }
}

// --- Service Initialization (Lazy) ---
// We initialize services to null. They will be populated on the first request.
let db: admin.firestore.Firestore | null = null;
let storage: admin.storage.Storage | null = null;
let ai: GoogleGenAI | null = null;
let servicesInitialized = false;

// This function initializes all external services. It's designed to run only once.
const initializeServices = () => {
    if (servicesInitialized) {
        return;
    }
    console.log("Attempting to initialize external services for the first time...");
    try {
        // Initialize Firebase Admin SDK
        admin.initializeApp();
        db = admin.firestore();
        storage = admin.storage();
        console.log("Firebase Admin SDK initialized successfully.");

        // Initialize Google GenAI SDK only if the API key is present
        if (process.env.API_KEY) {
            ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
            console.log("Google GenAI SDK initialized successfully.");
        } else {
            console.warn("API_KEY environment variable not set. AI features will be disabled.");
        }
        
        servicesInitialized = true;
    } catch (error) {
        console.error("CRITICAL: Failed to initialize external services.", error);
        // We don't exit the process here, to allow the error to be logged properly.
        // The middleware will prevent requests from being processed if services fail to init.
    }
};

// --- Middleware ---

// Authentication and Service Initialization Middleware
// FIX: Use Request, Response, and NextFunction types from express.
const authMiddleware = async (req: Request, res: Response, next: NextFunction) => {
    const authorization = req.headers.authorization;
    if (!authorization || !authorization.startsWith('Bearer ')) {
        return res.status(403).json({ error: 'Unauthorized: No token provided.' });
    }

    // Initialize services on the first request
    if (!servicesInitialized) {
        initializeServices();
    }
    
    // If initialization failed, db will be null, and we should stop.
    if (!db) {
         return res.status(500).json({ error: 'Internal Server Error: Core services failed to initialize.' });
    }

    const token = authorization.split('Bearer ')[1];
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        // FIX: Use typed user property on request.
        req.user = decodedToken; // Add user info to the request object
        next();
    } catch (error) {
        console.error("Error verifying auth token:", error);
        return res.status(403).json({ error: 'Unauthorized: Invalid token.' });
    }
};

// --- App Setup ---
const app = express();
const port = Number(process.env.PORT) || 8080;

app.use(cors({ origin: true }));
app.use(express.json({ limit: '10mb' })); // Increase limit for base64 images

// --- Health Check Endpoint (No Auth) ---
// FIX: Use Request and Response types from express.
app.get("/healthz", (req: Request, res: Response) => {
    res.status(200).send("OK");
});

// All API routes below will be protected by the auth middleware
app.use(authMiddleware);

// --- API Endpoints ---

// Get all characters for the logged-in user
// FIX: Use Request and Response types from express.
app.post("/getCharacterLibrary", async (req: Request, res: Response) => {
    // FIX: Use typed user property on request.
    const userId = req.user!.uid;
    try {
        const snapshot = await db!.collection('characters').where('userId', '==', userId).orderBy('createdAt', 'desc').get();
        const characters = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        res.status(200).json(characters);
    } catch (error) {
        console.error("Error in /getCharacterLibrary:", error);
        res.status(500).json({ error: 'Failed to retrieve character library.' });
    }
});

// Get a single character by its ID
// FIX: Use Request and Response types from express.
app.post("/getCharacterById", async (req: Request, res: Response) => {
    // FIX: Use typed user property on request.
    const userId = req.user!.uid;
    const { characterId } = req.body;

    if (!characterId) {
        return res.status(400).json({ error: 'Character ID is required.' });
    }

    try {
        const doc = await db!.collection('characters').doc(characterId).get();
        if (!doc.exists) {
            return res.status(404).json({ error: 'Character not found.' });
        }
        const character = doc.data();
        if (character?.userId !== userId) {
            return res.status(403).json({ error: 'Permission denied.' });
        }
        res.status(200).json({ id: doc.id, ...character });
    } catch (error) {
        console.error("Error in /getCharacterById:", error);
        res.status(500).json({ error: 'Failed to retrieve character.' });
    }
});

// Create a new character pair profile
// FIX: Use Request and Response types from express.
app.post("/createCharacterPair", async (req: Request, res: Response) => {
    if (!ai) {
        return res.status(503).json({ error: 'AI service is not available. Check server configuration.' });
    }
    
    // FIX: Use typed user property on request.
    const userId = req.user!.uid;
    const { charABase64, charAMimeType, charBBase64, charBMimeType } = req.body;

    if (!charABase64 || !charAMimeType || !charBBase64 || !charBMimeType) {
        return res.status(400).json({ error: "Missing image data for one or both characters." });
    }
    
    try {
        const model = 'gemini-2.5-flash';
        const prompt = `Analyze these two images of characters.
        For the character in the first image, create a detailed profile including:
        - A descriptive name (e.g., "Cyberpunk Mercenary", "Forest Spirit").
        - A short, compelling description (2-3 sentences).
        - A list of 5-7 relevant keywords (e.g., "sci-fi", "armor", "neon lights", "serious").

        Format the output as a JSON object with the keys "characterName", "description", and "keywords". Do not include any markdown formatting.
        `;
        
        const imagePartA = { inlineData: { data: charABase64, mimeType: charAMimeType } };
        const imagePartB = { inlineData: { data: charBBase64, mimeType: charBMimeType } };

        // Generate profile for Character A
        const responseA: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }, imagePartA, imagePartB] },
            config: { responseMimeType: 'application/json' }
        });
        const profileA = JSON.parse(responseA.text);

        // Generate profile for Character B
        const responseB: GenerateContentResponse = await ai.models.generateContent({
            model: model,
            contents: { parts: [{ text: prompt }, imagePartB, imagePartA] }, // Swapped order
            config: { responseMimeType: 'application/json' }
        });
        const profileB = JSON.parse(responseB.text);

        const bucket = storage!.bucket();
        
        // Upload images and save profiles
        const uploadAndSave = async (profile: any, base64: string, mimeType: string) => {
            const docRef = db!.collection('characters').doc();
            const fileName = `${userId}/${docRef.id}.${mimeType.split('/')[1]}`;
            const file = bucket.file(fileName);
            
            await file.save(Buffer.from(base64, 'base64'), {
                metadata: { contentType: mimeType },
            });
            await file.makePublic();
            const imageUrl = file.publicUrl();

            const characterData = {
                ...profile,
                userId,
                imageUrl,
                createdAt: admin.firestore.FieldValue.serverTimestamp()
            };
            await docRef.set(characterData);
            return { id: docRef.id, ...characterData };
        };

        const [savedCharA, savedCharB] = await Promise.all([
            uploadAndSave(profileA, charABase64, charAMimeType),
            uploadAndSave(profileB, charBBase64, charBMimeType)
        ]);
        
        res.status(201).json({ characterA: savedCharA, characterB: savedCharB });

    } catch (error: any) {
        console.error("Error in /createCharacterPair:", error);
        res.status(500).json({ error: 'Failed to create character pair.', details: error.message });
    }
});


// Generate a visualization for a character
// FIX: Use Request and Response types from express.
app.post("/generateCharacterVisualization", async (req: Request, res: Response) => {
    if (!ai) {
        return res.status(503).json({ error: 'AI service is not available. Check server configuration.' });
    }

    const { characterId, prompt } = req.body;
    if (!characterId || !prompt) {
        return res.status(400).json({ error: "Character ID and prompt are required." });
    }

    try {
        const doc = await db!.collection('characters').doc(characterId).get();
        if (!doc.exists) {
            return res.status(404).json({ error: "Character not found." });
        }
        const character = doc.data() as any;

        // FIX: Add security check to ensure user owns the character.
        const userId = req.user!.uid;
        if (character?.userId !== userId) {
            return res.status(403).json({ error: 'Permission denied.' });
        }

        // Combine character data with user prompt for a richer generation context
        const fullPrompt = `
        Generate an image based on the following character profile and scene description.
        Character Name: ${character.characterName}
        Character Description: ${character.description}
        Character Keywords: ${character.keywords.join(', ')}
        Scene: ${prompt}
        `;

        const response: GenerateContentResponse = await ai.models.generateContent({
            model: 'gemini-2.5-flash-image', // Using the dedicated image generation model
            contents: { parts: [{ text: fullPrompt }] },
            config: { responseModalities: [Modality.IMAGE] }
        });

        const generatedPart = response.candidates?.[0]?.content?.parts?.[0];
        if (generatedPart && generatedPart.inlineData) {
            res.status(200).json({ imageBase64: generatedPart.inlineData.data });
        } else {
            throw new Error("No image data received from the AI model.");
        }
    } catch (error: any) {
        console.error("Error in /generateCharacterVisualization:", error);
        res.status(500).json({ error: 'Failed to generate visualization.', details: error.message });
    }
});


// --- Start Server ---
app.listen(port, "0.0.0.0", () => {
    console.log(`Server is listening on http://0.0.0.0:${port}`);
});