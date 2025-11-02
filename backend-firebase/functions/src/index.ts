// FIX: Switched to Firebase Functions v2 imports for compatibility.
import {onCall, HttpsError, CallableRequest} from "firebase-functions/v2/https";
import * as logger from "firebase-functions/logger";
import * as admin from "firebase-admin";
import {GoogleGenAI, Type, Modality} from "@google/genai";
import { Buffer } from "buffer";

// --- Global Initialization ---
// This is the correct pattern for modern environments like Firebase App Hosting.
// The Firebase Admin SDK is initialized once when the container starts,
// ensuring all function instances share the same app instance.
admin.initializeApp();
const firestore = admin.firestore();
const storage = admin.storage();
const ai = process.env.API_KEY ? new GoogleGenAI({apiKey: process.env.API_KEY}) : null;

if (!ai) {
    // Log a fatal error during initialization if the API key is missing.
    // This helps diagnose setup issues immediately upon deployment.
    console.error("FATAL: API_KEY environment variable is not set. AI functions will fail.");
}


// Interface for character data, mirroring frontend
interface UserCharacter {
  id?: string;
  userId: string;
  characterName: string;
  description: string;
  keywords: string[];
  imageUrl: string;
  createdAt: admin.firestore.FieldValue;
}

// FIX: Updated context type to CallableRequest for Firebase Functions v2.
const requireAuth = (context: CallableRequest) => {
  if (!context.auth) {
    // FIX: Use HttpsError from v2 import.
    throw new HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  return context.auth.uid;
};

// A helper to ensure AI is initialized before use in any function call
const getAi = (): GoogleGenAI => {
    if (!ai) {
        // FIX: Use HttpsError from v2 import.
        throw new HttpsError(
            "failed-precondition",
            "The Gemini API key is not configured for the backend. Please set the 'API_KEY' environment variable on your Cloud Function."
        );
    }
    return ai;
}

const handleGeneralError = (error: any, context: string) => {
    // FIX: Use logger from v2 import.
    logger.error(`Error in ${context}:`, {
        fullError: error,
        errorMessage: error.message,
        errorCode: error.code,
        errorDetails: error.details,
    });
    // FIX: Use HttpsError from v2 import.
    if (error instanceof HttpsError) {
        throw error;
    }
    // FIX: Use HttpsError from v2 import.
    throw new HttpsError(
        "internal",
        `An internal server error occurred in ${context}. This might be due to a Google Cloud configuration issue. Please check the function logs and ensure that project billing and all required APIs (like Vertex AI and Cloud Storage) are enabled.`,
        { originalErrorMessage: error.message }
    );
};

// FIX: Updated function definition to Firebase Functions v2 syntax and removed hardcoded region.
export const getCharacterLibrary = onCall(async (request) => {
    const uid = requireAuth(request);
    try {
      const snapshot = await firestore
        .collection("user_characters")
        .where("userId", "==", uid)
        .get();
      const characters = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      return characters;
    } catch (error) {
        handleGeneralError(error, "getCharacterLibrary");
        return [];
    }
  });

// FIX: Updated function definition to Firebase Functions v2 syntax and removed hardcoded region.
export const getCharacterById = onCall(async (request) => {
    const uid = requireAuth(request);
    const {characterId} = request.data;

    if (!characterId) {
      // FIX: Use HttpsError from v2 import.
      throw new HttpsError(
        "invalid-argument",
        "The function must be called with a 'characterId'."
      );
    }

    try {
      const doc = await firestore
        .collection("user_characters")
        .doc(characterId)
        .get();

      if (!doc.exists || doc.data()?.userId !== uid) {
        // FIX: Use HttpsError from v2 import.
        throw new HttpsError(
          "not-found",
          "Character not found or you do not have permission to access it."
        );
      }

      return {id: doc.id, ...doc.data()};
    } catch (error) {
      handleGeneralError(error, "getCharacterById");
      return null;
    }
  });


// FIX: Updated function definition to Firebase Functions v2 syntax and removed hardcoded region.
export const createCharacterPair = onCall({timeoutSeconds: 300, memory: "1GiB"}, async (request) => {
    const localAi = getAi();
    const uid = requireAuth(request);
    const {charABase64, charAMimeType, charBBase64, charBMimeType} = request.data;

    if (!charABase64 || !charBBase64 || !charAMimeType || !charBMimeType) {
      // FIX: Use HttpsError from v2 import.
      throw new HttpsError(
        "invalid-argument",
        "Missing image data for one or both characters."
      );
    }

    const analyzeAndSaveCharacter = async (
      base64: string,
      mimeType: string
    ): Promise<UserCharacter> => {
      const buffer = Buffer.from(base64, "base64");
      const characterId = firestore.collection("user_characters").doc().id;
      const filePath = `user_uploads/${uid}/${characterId}.${mimeType.split("/")[1]}`;
      const file = storage.bucket().file(filePath);

      await file.save(buffer, {
        metadata: {contentType: mimeType},
      });
      const [imageUrl] = await file.getSignedUrl({
        action: "read",
        expires: "03-09-2491",
      });

      const response = await localAi.models.generateContent({
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
              characterName: {type: Type.STRING},
              description: {type: Type.STRING},
              keywords: {type: Type.ARRAY, items: {type: Type.STRING}},
            },
            required: ["characterName", "description", "keywords"],
          },
        },
      });

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
      
      return {...newCharacter, id: characterId};
    };

    try {
      const [charA, charB] = await Promise.all([
        analyzeAndSaveCharacter(charABase64, charAMimeType),
        analyzeAndSaveCharacter(charBBase64, charBMimeType),
      ]);
      return {characterA: charA, characterB: charB};
    } catch (error) {
        handleGeneralError(error, "createCharacterPair");
        return null;
    }
  });


// FIX: Updated function definition to Firebase Functions v2 syntax and removed hardcoded region.
export const generateCharacterVisualization = onCall({timeoutSeconds: 300, memory: "1GiB"}, async (request) => {
    const localAi = getAi();
    const uid = requireAuth(request);
    const {characterId, prompt} = request.data;

    if (!characterId || !prompt) {
      // FIX: Use HttpsError from v2 import.
      throw new HttpsError(
        "invalid-argument",
        "Missing character ID or prompt."
      );
    }

    const charDoc = await firestore
      .collection("user_characters")
      .doc(characterId)
      .get();
    if (!charDoc.exists || charDoc.data()?.userId !== uid) {
      // FIX: Use HttpsError from v2 import.
      throw new HttpsError(
        "not-found",
        "Character not found or access denied."
      );
    }
    const character = charDoc.data();
    
    if (!character?.imageUrl) {
        // FIX: Use HttpsError from v2 import.
         throw new HttpsError("not-found", "Character image URL is missing.");
    }

    const imageUrl = character.imageUrl;
    const url = new URL(imageUrl);
    const filePath = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    const file = storage.bucket().file(filePath);
    
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType || "image/jpeg";

    const [imageBuffer] = await file.download();
    const imageBase64 = imageBuffer.toString("base64");

    try {
      const response = await localAi.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            {inlineData: {data: imageBase64, mimeType: mimeType}},
            {text: `Using this character as a reference, create a new image based on the following prompt: "${prompt}"`},
          ],
        },
        config: {
          responseModalities: [Modality.IMAGE],
        },
      });

      const generatedPart = response.candidates?.[0]?.content.parts[0];
      if (generatedPart && generatedPart.inlineData) {
        return {imageBase64: generatedPart.inlineData.data};
      } else {
        throw new Error("No image data returned from AI model.");
      }
    } catch (error) {
      handleGeneralError(error, "generateCharacterVisualization");
      return null;
    }
  });