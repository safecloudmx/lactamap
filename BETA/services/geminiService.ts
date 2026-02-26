import { GoogleGenAI, Type } from "@google/genai";
import { Amenity, GenderAccess } from "../types";

// Initialize Gemini API
// NOTE: In a production app, do not expose API keys on the client side if possible.
const apiKey = process.env.API_KEY || ''; 
const ai = new GoogleGenAI({ apiKey });

export interface ImageAnalysisResult {
  description: string;
  amenities: Amenity[];
  estimatedCleanliness: number; // 1-5
  accessType: GenderAccess;
}

/**
 * Analyzes an uploaded image of a lactation room/bathroom to auto-tag amenities.
 */
export const analyzeRoomImage = async (base64Image: string): Promise<ImageAnalysisResult> => {
  if (!apiKey) {
    console.warn("API Key not found, returning mock analysis");
    return {
      description: "Análisis simulado (Falta API Key)",
      amenities: [Amenity.CHANGING_TABLE, Amenity.SINK],
      estimatedCleanliness: 4,
      accessType: GenderAccess.NEUTRAL
    };
  }

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: "image/jpeg",
              data: base64Image
            }
          },
          {
            text: `Analyze this image of a facility. It is likely a bathroom, lactation room, or nursery.
            Identify the amenities present (Looking for: Changing table, Lactation chair, Sink, Microwave, Outlet, Fridge, Freezer, AC).
            Estimate cleanliness from 1 to 5.
            Guess the gender access (Men, Women, or Neutral/Family).
            Provide a short description in Spanish.`
          }
        ]
      },
      config: {
        responseMimeType: "application/json",
        responseSchema: {
          type: Type.OBJECT,
          properties: {
            description: { type: Type.STRING },
            amenities: { 
              type: Type.ARRAY, 
              items: { type: Type.STRING } 
            },
            estimatedCleanliness: { type: Type.NUMBER },
            accessType: { type: Type.STRING, enum: ["Mujeres", "Hombres", "Unisex/Familiar"] }
          }
        }
      }
    });

    if (response.text) {
      const json = JSON.parse(response.text);
      
      // Map string amenities to Enum
      const detectedAmenities: Amenity[] = [];
      const rawAmenities = (json.amenities || []).map((a: string) => a.toLowerCase());
      
      if (rawAmenities.some((a: string) => a.includes('chang') || a.includes('cambia'))) detectedAmenities.push(Amenity.CHANGING_TABLE);
      if (rawAmenities.some((a: string) => a.includes('chair') || a.includes('silla') || a.includes('sillon'))) detectedAmenities.push(Amenity.LACTATION_CHAIR);
      if (rawAmenities.some((a: string) => a.includes('sink') || a.includes('lavabo'))) detectedAmenities.push(Amenity.SINK);
      if (rawAmenities.some((a: string) => a.includes('micro'))) detectedAmenities.push(Amenity.MICROWAVE);
      if (rawAmenities.some((a: string) => a.includes('plug') || a.includes('enchufe'))) detectedAmenities.push(Amenity.ELECTRIC_OUTLET);
      if (rawAmenities.some((a: string) => a.includes('fridge') || a.includes('refri') || a.includes('nevera'))) detectedAmenities.push(Amenity.REFRIGERATOR);
      if (rawAmenities.some((a: string) => a.includes('freeze') || a.includes('congelador'))) detectedAmenities.push(Amenity.FREEZER);
      if (rawAmenities.some((a: string) => a.includes('ac') || a.includes('air') || a.includes('aire') || a.includes('clima'))) detectedAmenities.push(Amenity.AC);

      return {
        description: json.description || "Sin descripción generada.",
        amenities: detectedAmenities.length > 0 ? detectedAmenities : [Amenity.CHANGING_TABLE],
        estimatedCleanliness: json.estimatedCleanliness || 3,
        accessType: json.accessType as GenderAccess || GenderAccess.NEUTRAL
      };
    }
    throw new Error("No response text");

  } catch (error) {
    console.error("Gemini Analysis Error:", error);
    return {
      description: "No se pudo analizar la imagen.",
      amenities: [],
      estimatedCleanliness: 0,
      accessType: GenderAccess.NEUTRAL
    };
  }
};

export interface PlaceSearchResult {
  name: string;
  address: string;
  rating: number;
}

/**
 * Finds nearby places using Google Maps Grounding via Gemini.
 */
export const findNearbyLactationRooms = async (lat: number, lng: number): Promise<PlaceSearchResult[]> => {
    if (!apiKey) return [];

    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash",
        contents: "Find 3 places nearby that are likely to have baby changing stations or lactation rooms, like malls, family restaurants, or libraries. List their names and addresses.",
        config: {
          tools: [{ googleMaps: {} }],
          toolConfig: {
            retrievalConfig: {
              latLng: {
                latitude: lat,
                longitude: lng
              }
            }
          }
        }
      });

      const results: PlaceSearchResult[] = [];
      
      // Parsing logic same as before for demo
      const lines = response.text?.split('\n') || [];
      lines.forEach(line => {
        if (line.length > 10 && (line.includes("1.") || line.includes("- "))) {
           results.push({
             name: line.replace(/^[0-9-.\s]+/, '').split(',')[0].trim(),
             address: "Cerca de ti (Detectado por IA)",
             rating: 4.0
           });
        }
      });

      return results.slice(0, 3);

    } catch (error) {
      console.error("Search Error:", error);
      return [];
    }
};
