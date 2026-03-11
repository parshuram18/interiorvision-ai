require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const { GoogleGenAI } = require('@google/genai');
const FormData = require('form-data');
const fetch = require('node-fetch'); // Use node-fetch for multipart compatibility

const app = express();
const port = process.env.PORT || 3000;

// Initialize Google Gemini API
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
const HF_API_KEY = process.env.HF_API_KEY; // HuggingFace API key

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

// Configure Multer for in-memory file uploads
const storage = multer.memoryStorage();
const upload = multer({ storage: storage });

// AI Suggestion helper function
async function getDesignTips(style, prompt) {
    try {
        const query = `Provide 3 concise interior design tips for a ${style} room. The user described their desired look as: "${prompt}". Keep the tone professional but friendly and inspiring. Return the tips formatted as an HTML unordered list (<ul><li>...</li></ul>) without any markdown formatting blocks.`;
        
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
        });
        
        return response.text;
    } catch (error) {
        console.error("Error fetching Gemini tips:", error);
        return "<ul><li>Focus on natural light to enhance the space.</li><li>Choose a neutral color palette as a base.</li><li>Add textured fabrics to create depth.</li></ul>";
    }
}

const { HfInference } = require('@huggingface/inference');

// Image Generation helper function via Hugging Face
async function generateImage(imageBuffer, style, userPrompt) {
    const getSvgPlaceholder = (msg) => {
        const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="800" height="600" viewBox="0 0 800 600"><rect fill="#1e293b" width="800" height="600"/><text fill="#f8fafc" font-family="sans-serif" font-size="30" font-weight="bold" x="50%" y="45%" text-anchor="middle">${msg}</text><text fill="#94a3b8" font-family="sans-serif" font-size="16" x="50%" y="55%" text-anchor="middle">(Hugging Face API Key Needed for Real Images)</text></svg>`;
        return `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}`;
    };

    if (!HF_API_KEY) {
        console.log("No HF_API_KEY provided. Returning fallback SVG.");
        return getSvgPlaceholder(`AI Style: ${style}`);
    }

    try {
        const hf = new HfInference(HF_API_KEY);
        
        // Since free image-to-image APIs are temporarily offline on HF, we use state-of-the-art Text-to-Image.
        // We compose a descriptive prompt using the user's requested style and modifications.
        const prompt = `A breathtaking photorealistic interior design photography of a ${style} style room. 
The room features: ${userPrompt}. 
Masterpiece, highly detailed, perfect lighting, architectural digest quality, 8k resolution.`;

        // We use the new Serverless Inference API with FLUX for highest quality
        const response = await hf.textToImage({
            model: 'black-forest-labs/FLUX.1-schnell',
            inputs: prompt
        });

        // The response is an instance of Blob
        const arrayBuffer = await response.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);
        return `data:image/jpeg;base64,${buffer.toString('base64')}`;
        
    } catch (error) {
        console.error("Error generating image:", error);
        return getSvgPlaceholder(`API Error. Please try again.`);
    }
}

// Main Endpoint
app.post('/api/generate-design', upload.single('image'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No image uploaded' });
        }

        const { style, prompt } = req.body;
        
        // Log incoming request
        console.log(`Received request - Style: ${style}, Prompt: ${prompt}`);

        // 1. Get AI Tips asynchronously
        const tipsPromise = getDesignTips(style, prompt);
        
        // 2. Generate Image (In a real app, this might take long; here we await it)
        // Since InstructPix2Pix or Stable Diffusion Image-to-Image via free API might need specific formats,
        // we handle the generation. 
        // NOTE: If the image generation model times out, we'll try to handle it.
        const generatedImagePromise = generateImage(req.file.buffer, style, prompt);

        // Wait for both to finish
        const [tipsText, generatedImageData] = await Promise.all([tipsPromise, generatedImagePromise]);

        res.json({
            success: true,
            tips: tipsText,
            generatedImage: generatedImageData
        });

    } catch (error) {
        console.error("Generation failed:", error);
        res.status(500).json({ error: 'Failed to generate design. ' + error.message });
    }
});

app.listen(port, () => {
    console.log(`Server is running on http://localhost:${port}`);
});
