import { GoogleGenAI } from "@google/genai";

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY;

export const translateImageText = async (base64Image, targetLanguage = 'English') => {
    if (!API_KEY) {
        throw new Error("Gemini API Key is missing. Please set VITE_GEMINI_API_KEY in .env");
    }

    const ai = new GoogleGenAI({
        apiKey: API_KEY,
        systemInstruction: `You are an OCR and Translation engine. Extract text from the image slice and translate it to ${targetLanguage}. Return ONLY the translated text. Do not add any conversational filler.`
    });

    const base64Data = base64Image.split(',')[1];
    const contents = [
        {
            text: `You are an OCR and Translation engine. Extract text from the image slice and translate it to ${targetLanguage}. Return ONLY the translated text. Do not add any conversational filler.`
        },
        {
            inlineData: {
                mimeType: "image/jpeg",
                data: base64Data,
            }
        }
    ];

    try {
        const response = await ai.models.generateContent({
            model: "gemma-3-27b-it",
            contents: contents,
        });

        return response.text;

    } catch (error) {
        console.error("Gemini API Error:", error);
        throw error;
    }
};
