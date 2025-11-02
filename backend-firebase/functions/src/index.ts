


// FIX: Changed import to use default export of express and also import specific types to avoid type conflicts with global Request/Response types.
import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import admin from "firebase-admin";
import { GoogleGenAI, Type, Modality, GenerateContentResponse } from "@google/genai";

// Define an interface for requests that have been authenticated
// This extends the default Express Request to include our user property
// FIX: Explicitly extend Request from express to avoid type conflicts.
interface AuthenticatedRequest extends Request {
  user?: admin.auth.DecodedIdToken;
}

// --- Main Application Startup ---
try {
    console.log("Initializing application...");

    // --- Global Initialization ---
    console.log("Initializing Firebase Admin SDK...");
    admin.initializeApp();
    console.log("Firebase Admin SDK initialized successfully.");

    const firestore = admin.firestore();
    const storage = admin.storage();

    console.log("Checking for API_KEY...");
    const ai = process.env.API_KEY ? new GoogleGenAI({ apiKey: process.env.API_KEY }) : null;

    if (!ai) {
        console.error("WARNING: API_KEY environment variable is not set. AI functions will be disabled.");
    } else {
        console.log("Gemini AI client initialized.");
    }

    const app = express();
    const port = Number(process.env.PORT) || 8080;
    console.log(`Configuring server for port: ${port}`);

    // --- Middleware ---
    app.use(cors({ origin: true }));
    app.use(express.json({ limit: '10mb' }));

    // Auth middleware to verify Firebase ID tokens
    // FIX: Use explicit Request, Response, and NextFunction types from express to ensure correct type resolution.
    const authMiddleware = async (req: AuthenticatedRequest, res: Response, next: NextFunction) => {
        const { authorization } = req.headers;
        if (!authorization || !authorization.startsWith('Bearer ')) {
            return res.status(401).send({ error: 'Unauthorized: No token provided.' });
        }
        const idToken = authorization.split('Bearer ')[1];
        try {
            const decodedToken = await admin.auth().verifyIdToken(idToken);
            req.user = decodedToken; // Attach user info to the request object
            next();
        } catch (error) {
            console.error('Error verifying auth token:', error);
            return res.status(403).send({ error: 'Unauthorized: Invalid token.' });
        }
    };

    // Helper to ensure AI is initialized before use
    const getAi = (): GoogleGenAI => {
        if (!ai) {
            throw new Error("The Gemini API key is not configured for the backend.");
        }
        return ai;
    }

    // Interface for character data
    interface UserCharacter {
        id?: string;
        userId: string;
        characterName: string;
        description: string;
        keywords: string[];
        imageUrl: string;
        createdAt: admin.firestore.FieldValue | admin.firestore.Timestamp;
    }

    // --- API Endpoints ---

    // FIX: Use explicit Response type from express for handler.
    app.post("/getCharacterLibrary", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) return res.status(403).json({ error: "Authentication details are missing." });
        const uid = req.user.uid;
        try {
            const snapshot = await firestore
                .collection("user_characters")
                .where("userId", "==", uid)
                .get();
            const characters = snapshot.docs.map((doc) => ({
                id: doc.id,
                ...doc.data(),
            }));
            res.status(200).json(characters);
        } catch (error) {
            console.error("Error in getCharacterLibrary:", error);
            res.status(500).json({ error: "Internal server error." });
        }
    });

    // FIX: Use explicit Response type from express for handler.
    app.post("/getCharacterById", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) return res.status(403).json({ error: "Authentication details are missing." });
        const uid = req.user.uid;
        const { characterId } = req.body;

        if (!characterId) {
            return res.status(400).json({ error: "Missing 'characterId'." });
        }

        try {
            const doc = await firestore
                .collection("user_characters")
                .doc(characterId)
                .get();

            if (!doc.exists || doc.data()?.userId !== uid) {
                return res.status(404).json({ error: "Character not found or permission denied." });
            }

            res.status(200).json({ id: doc.id, ...doc.data() });
        } catch (error) {
            console.error("Error in getCharacterById:", error);
            res.status(500).json({ error: "Internal server error." });
        }
    });

    const analyzeAndSaveCharacter = async (
        base64: string,
        mimeType: string,
        uid: string
    ): Promise<UserCharacter> => {
        const localAi = getAi();
        const buffer = Buffer.from(base64, "base64");
        const characterId = firestore.collection("user_characters").doc().id;
        const filePath = `user_uploads/${uid}/${characterId}.${mimeType.split("/")[1]}`;
        const file = storage.bucket().file(filePath);

        await file.save(buffer, {
            metadata: { contentType: mimeType },
        });
        const [imageUrl] = await file.getSignedUrl({
            action: "read",
            expires: "03-09-2491",
        });

        const response: GenerateContentResponse = await localAi.models.generateContent({
            model: "gemini-2.5-flash",
            contents: {
                parts: [{
                    inlineData: {
                        data: base64,
                        mimeType: mimeType,
                    },
                },
                {
                    text: "Analyze this character image. Provide a creative name, a brief 2-3 sentence description, and 5 keywords that describe their appearance or mood.",
                },
                ],
            },
            config: {
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.OBJECT,
                    properties: {
                        characterName: { type: Type.STRING },
                        description: { type: Type.STRING },
                        keywords: { type: Type.ARRAY, items: { type: Type.STRING } },
                    },
                    required: ["characterName", "description", "keywords"],
                },
            },
        });

        if (!response.text) {
          throw new Error("AI analysis returned an empty response.");
        }
        const analysis = JSON.parse(response.text);

        const newCharacter: UserCharacter = {
            userId: uid,
            characterName: analysis.characterName,
            description: analysis.description,
            keywords: analysis.keywords,
            imageUrl: imageUrl,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
        };

        await firestore
            .collection("user_characters")
            .doc(characterId)
            .set(newCharacter);

        const docSnap = await firestore.collection("user_characters").doc(characterId).get();
        const createdData = docSnap.data() as UserCharacter;

        return { ...createdData, id: characterId };
    };

    // FIX: Use explicit Response type from express for handler.
    app.post("/createCharacterPair", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) return res.status(403).json({ error: "Authentication details are missing." });
        const uid = req.user.uid;
        const { charABase64, charAMimeType, charBBase64, charBMimeType } = req.body;

        if (!charABase64 || !charBBase64 || !charAMimeType || !charBMimeType) {
            return res.status(400).json({ error: "Missing image data." });
        }

        try {
            const [charA, charB] = await Promise.all([
                analyzeAndSaveCharacter(charABase64, charAMimeType, uid),
                analyzeAndSaveCharacter(charBBase64, charBMimeType, uid),
            ]);
            res.status(200).json({ characterA: charA, characterB: charB });
        } catch (error: any) {
            console.error("Error in createCharacterPair:", error);
            res.status(500).json({ error: "Internal server error.", details: error.message });
        }
    });

    // FIX: Use explicit Response type from express for handler.
    app.post("/generateCharacterVisualization", authMiddleware, async (req: AuthenticatedRequest, res: Response) => {
        if (!req.user) return res.status(403).json({ error: "Authentication details are missing." });
        const localAi = getAi();
        const uid = req.user.uid;
        const { characterId, prompt } = req.body;

        if (!characterId || !prompt) {
            return res.status(400).json({ error: "Missing character ID or prompt." });
        }

        try {
            const charDoc = await firestore
                .collection("user_characters")
                .doc(characterId)
                .get();
            if (!charDoc.exists || charDoc.data()?.userId !== uid) {
                return res.status(404).json({ error: "Character not found or access denied." });
            }
            const character = charDoc.data();

            if (!character?.imageUrl) {
                return res.status(404).json({ error: "Character image URL is missing." });
            }

            const imageUrl = character.imageUrl;
            const url = new URL(imageUrl);
            const filePath = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
            const file = storage.bucket().file(filePath);

            const [metadata] = await file.getMetadata();
            const mimeType = metadata.contentType || "image/jpeg";

            const [imageBuffer] = await file.download();
            const imageBase64 = imageBuffer.toString("base64");

            const response: GenerateContentResponse = await localAi.models.generateContent({
                model: "gemini-2.5-flash-image",
                contents: {
                    parts: [
                        { inlineData: { data: imageBase64, mimeType: mimeType } },
                        { text: `Using this character as a reference, create a new image based on the following prompt: "${prompt}"` },
                    ],
                },
                config: {
                    responseModalities: [Modality.IMAGE],
                },
            });

            // Robust check for the generated image data
            const generatedPart = response.candidates?.[0]?.content?.parts?.[0];
            if (generatedPart && generatedPart.inlineData?.data) {
                res.status(200).json({ imageBase64: generatedPart.inlineData.data });
            } else {
                throw new Error("No image data returned from AI model.");
            }
        } catch (error: any) {
            console.error("Error in generateCharacterVisualization:", error);
            res.status(500).json({ error: "Internal server error.", details: error.message });
        }
    });

    // --- Start Server ---
    app.listen(port, "0.0.0.0", () => {
        console.log(`Server successfully started and listening on port ${port} and host 0.0.0.0`);
    });

} catch (error) {
    console.error("CRITICAL: A fatal error occurred during application startup.", error);
    (process as any).exit(1);
}
