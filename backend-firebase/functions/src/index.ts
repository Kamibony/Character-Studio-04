
import * as functions from "firebase-functions";
import * as admin from "firebase-admin";
import {GoogleGenAI, Type, Modality} from "@google/genai";
// FIX: The Buffer object is part of Node.js but might not be in the linter's scope.
// Importing it explicitly fixes the "Cannot find name 'Buffer'" error.
import { Buffer } from "buffer";

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

// Lazy initialization
let app: admin.app.App;
let ai: GoogleGenAI;
let firestore: admin.firestore.Firestore;
let storage: admin.storage.Storage;

const initialize = () => {
  if (!app) {
    app = admin.initializeApp();
    ai = new GoogleGenAI({apiKey: process.env.API_KEY as string});
    firestore = admin.firestore();
    storage = admin.storage();
  }
};

const requireAuth = (context: functions.https.CallableContext) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "The function must be called while authenticated."
    );
  }
  return context.auth.uid;
};

export const getCharacterLibrary = functions
  .region("us-central1")
  .https.onCall(async (data, context) => {
    initialize();
    const uid = requireAuth(context);

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
      console.error("Error fetching character library:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Unable to retrieve character library."
      );
    }
  });


export const createCharacterPair = functions
  .region("us-central1")
  .runWith({timeoutSeconds: 300, memory: "1GB"})
  .https.onCall(async (data, context) => {
    initialize();
    const uid = requireAuth(context);
    const {charABase64, charAMimeType, charBBase64, charBMimeType} = data;

    if (!charABase64 || !charBBase64 || !charAMimeType || !charBMimeType) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing image data for one or both characters."
      );
    }

    const analyzeAndSaveCharacter = async (
      base64: string,
      mimeType: string
    ): Promise<UserCharacter> => {
      // 1. Decode and upload to Storage
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

      // 2. Call Gemini to analyze image
      const response = await ai.models.generateContent({
        // FIX: The model `gemini-1.5-flash` is deprecated. Use `gemini-2.5-flash` instead.
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
      
      // 3. Save character profile to Firestore
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
      console.error("Error creating character pair:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to process and create characters."
      );
    }
  });


export const generateCharacterVisualization = functions
  .region("us-central1")
  .runWith({timeoutSeconds: 300, memory: "1GB"})
  .https.onCall(async (data, context) => {
    initialize();
    const uid = requireAuth(context);
    const {characterId, prompt} = data;

    if (!characterId || !prompt) {
      throw new functions.https.HttpsError(
        "invalid-argument",
        "Missing character ID or prompt."
      );
    }

    // 1. Fetch character and verify ownership
    const charDoc = await firestore
      .collection("user_characters")
      .doc(characterId)
      .get();
    if (!charDoc.exists || charDoc.data()?.userId !== uid) {
      throw new functions.https.HttpsError(
        "not-found",
        "Character not found or access denied."
      );
    }
    const character = charDoc.data();

    // 2. Fetch image from storage url
    const imageUrl = character?.imageUrl;
    const url = new URL(imageUrl);
    // FIX: Path from GCS signed URL needs to skip bucket name. `slice(2)` is correct.
    const filePath = decodeURIComponent(url.pathname.split("/").slice(2).join("/"));
    const file = storage.bucket().file(filePath);

    // FIX: Dynamically get mimeType from metadata instead of hardcoding.
    const [metadata] = await file.getMetadata();
    const mimeType = metadata.contentType || "image/jpeg";

    const [imageBuffer] = await file.download();
    const imageBase64 = imageBuffer.toString("base64");

    // 3. Call Gemini to generate new image
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-image",
        contents: {
          parts: [
            // FIX: Use the dynamic mimeType.
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
      console.error("Error generating visualization:", error);
      throw new functions.https.HttpsError(
        "internal",
        "Failed to generate visualization."
      );
    }
  });
